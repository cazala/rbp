//! Swarm integration for the Resurrect bootstrap controller.
//!
//! [`Behaviour`] is a [`NetworkBehaviour`] that an application composes into
//! its own `Swarm` alongside whatever discovery it already runs. It opens no
//! streams and defines no wire protocol: it exists to turn dial requests from
//! [`resurrect_bootstrap::BootstrapController`] into `Swarm` dials and to
//! report the outcome back.
//!
//! The controller is `async` and the behaviour is a poll-based state machine,
//! so the two halves are connected by a channel rather than by direct calls.
//! [`connector`] returns the [`Connector`] half, which implements
//! [`PeerConnector`] and is driven from an ordinary async task; the
//! [`Behaviour`] half lives in the `Swarm` and is polled by it.
//!
//! Nothing here reaches the network until the controller asks for a dial, and
//! the controller asks for nothing while [`PeerConnector::connected_peers`]
//! already meets its target, so a healthy node pays no cost for this.

use std::{
    collections::{HashMap, HashSet, VecDeque},
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    task::{Context, Poll},
    time::Duration,
};

use async_trait::async_trait;
use libp2p_core::{Endpoint, transport::PortUse};
use libp2p_identity::PeerId;
use libp2p_swarm::{
    ConnectionDenied, ConnectionId, FromSwarm, NetworkBehaviour, THandler, THandlerInEvent,
    THandlerOutEvent, ToSwarm, dial_opts::DialOpts, dummy,
};
use multiaddr::Multiaddr;
use resurrect_bootstrap::PeerConnector;
use resurrect_core::{PeerCandidate, RECORD_TYPE_LIBP2P};
use tokio::sync::{mpsc, oneshot};

/// Why a candidate never reached the transport.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rejection {
    /// The candidate is not a libp2p signed peer record.
    UnsupportedRecordType,
    /// The candidate's identity bytes are not a valid peer id.
    InvalidPeerId,
    /// No endpoint parsed as a multiaddress.
    NoDialableEndpoint,
}

/// Observable results of Resurrect-driven dialing.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Event {
    /// A registry candidate was handed to the `Swarm` as a dial.
    Dialing(PeerId),
    /// A Resurrect-dialed peer completed its connection.
    Connected(PeerId),
    /// A Resurrect-dialed peer could not be reached.
    DialFailed(PeerId),
    /// A candidate was discarded before any dial was attempted.
    Rejected(Rejection),
}

struct DialRequest {
    peer: PeerCandidate,
    outcome: oneshot::Sender<bool>,
}

/// Connection count shared with the connector half.
#[derive(Debug, Default)]
struct Connectivity {
    connected: AtomicUsize,
}

/// The [`PeerConnector`] half, driven from an async task.
///
/// Cloning is cheap and every clone addresses the same [`Behaviour`].
#[derive(Clone, Debug)]
pub struct Connector {
    dials: mpsc::Sender<DialRequest>,
    connectivity: Arc<Connectivity>,
}

impl std::fmt::Debug for DialRequest {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("DialRequest")
            .field("peer_id", &self.peer.peer_id)
            .finish_non_exhaustive()
    }
}

#[async_trait]
impl PeerConnector for Connector {
    async fn connected_peers(&self) -> usize {
        self.connectivity.connected.load(Ordering::SeqCst)
    }

    async fn connect(&self, peer: PeerCandidate, timeout: Duration) -> bool {
        let (outcome, result) = oneshot::channel();
        if self
            .dials
            .send(DialRequest { peer, outcome })
            .await
            .is_err()
        {
            // The behaviour was dropped, which means the Swarm is gone.
            return false;
        }
        // The behaviour also resolves the waiter on dial failure, but a
        // transport that neither connects nor errors must not stall the cycle.
        (tokio::time::timeout(timeout, result).await).is_ok_and(|dialed| dialed.unwrap_or(false))
    }
}

/// Resurrect discovery as a composable [`NetworkBehaviour`].
pub struct Behaviour {
    dials: mpsc::Receiver<DialRequest>,
    waiters: HashMap<PeerId, Vec<oneshot::Sender<bool>>>,
    connected: HashSet<PeerId>,
    connectivity: Arc<Connectivity>,
    queue: VecDeque<ToSwarm<Event, THandlerInEvent<Self>>>,
}

impl std::fmt::Debug for Behaviour {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Behaviour")
            .field("connected", &self.connected.len())
            .field("pending_dials", &self.waiters.len())
            .finish_non_exhaustive()
    }
}

/// Creates the swarm half and the controller half of the integration.
///
/// `queue_depth` bounds how many dial requests may be in flight before the
/// controller's next `connect` call waits, which keeps a stalled `Swarm` from
/// accumulating unbounded work.
#[must_use]
pub fn connector(queue_depth: usize) -> (Behaviour, Connector) {
    let (dials, receiver) = mpsc::channel(queue_depth.max(1));
    let connectivity = Arc::new(Connectivity::default());
    let behaviour = Behaviour {
        dials: receiver,
        waiters: HashMap::new(),
        connected: HashSet::new(),
        connectivity: Arc::clone(&connectivity),
        queue: VecDeque::new(),
    };
    (
        behaviour,
        Connector {
            dials,
            connectivity,
        },
    )
}

impl Behaviour {
    /// Peers currently connected through any dial, Resurrect's or the
    /// application's.
    #[must_use]
    pub fn connected_peers(&self) -> usize {
        self.connected.len()
    }

    fn resolve(&mut self, peer_id: &PeerId, dialed: bool) {
        if let Some(waiters) = self.waiters.remove(peer_id) {
            for waiter in waiters {
                let _ = waiter.send(dialed);
            }
        }
    }

    fn reject(&mut self, request: DialRequest, rejection: Rejection) {
        let _ = request.outcome.send(false);
        self.queue
            .push_back(ToSwarm::GenerateEvent(Event::Rejected(rejection)));
    }

    fn accept(&mut self, request: DialRequest) {
        if request.peer.record_type != RECORD_TYPE_LIBP2P {
            self.reject(request, Rejection::UnsupportedRecordType);
            return;
        }
        let Ok(peer_id) = PeerId::from_bytes(&request.peer.peer_id) else {
            self.reject(request, Rejection::InvalidPeerId);
            return;
        };
        if self.connected.contains(&peer_id) {
            // Already reachable; report success without disturbing the Swarm.
            let _ = request.outcome.send(true);
            return;
        }
        let addresses: Vec<Multiaddr> = request
            .peer
            .endpoints
            .iter()
            .filter_map(|endpoint| endpoint.address.parse().ok())
            .collect();
        if addresses.is_empty() {
            self.reject(request, Rejection::NoDialableEndpoint);
            return;
        }
        self.waiters
            .entry(peer_id)
            .or_default()
            .push(request.outcome);
        self.queue.push_back(ToSwarm::Dial {
            opts: DialOpts::peer_id(peer_id).addresses(addresses).build(),
        });
        self.queue
            .push_back(ToSwarm::GenerateEvent(Event::Dialing(peer_id)));
    }
}

impl NetworkBehaviour for Behaviour {
    type ConnectionHandler = dummy::ConnectionHandler;
    type ToSwarm = Event;

    fn handle_established_inbound_connection(
        &mut self,
        _connection_id: ConnectionId,
        _peer: PeerId,
        _local_addr: &Multiaddr,
        _remote_addr: &Multiaddr,
    ) -> Result<THandler<Self>, ConnectionDenied> {
        Ok(dummy::ConnectionHandler)
    }

    fn handle_established_outbound_connection(
        &mut self,
        _connection_id: ConnectionId,
        _peer: PeerId,
        _addr: &Multiaddr,
        _role_override: Endpoint,
        _port_use: PortUse,
    ) -> Result<THandler<Self>, ConnectionDenied> {
        Ok(dummy::ConnectionHandler)
    }

    fn on_connection_handler_event(
        &mut self,
        _peer_id: PeerId,
        _connection_id: ConnectionId,
        event: THandlerOutEvent<Self>,
    ) {
        // dummy::ConnectionHandler never produces an event.
        match event {}
    }

    fn on_swarm_event(&mut self, event: FromSwarm) {
        match event {
            FromSwarm::ConnectionEstablished(established) => {
                let peer_id = established.peer_id;
                if self.connected.insert(peer_id) {
                    self.connectivity
                        .connected
                        .store(self.connected.len(), Ordering::SeqCst);
                }
                // Publish connectivity before waking the waiter: the controller
                // reads the count immediately after a successful dial to decide
                // whether it has met its target.
                if self.waiters.contains_key(&peer_id) {
                    self.resolve(&peer_id, true);
                    self.queue
                        .push_back(ToSwarm::GenerateEvent(Event::Connected(peer_id)));
                }
            }
            FromSwarm::ConnectionClosed(closed) if closed.remaining_established == 0 => {
                if self.connected.remove(&closed.peer_id) {
                    self.connectivity
                        .connected
                        .store(self.connected.len(), Ordering::SeqCst);
                }
            }
            FromSwarm::DialFailure(failure) => {
                if let Some(peer_id) = failure.peer_id
                    && self.waiters.contains_key(&peer_id)
                {
                    self.resolve(&peer_id, false);
                    self.queue
                        .push_back(ToSwarm::GenerateEvent(Event::DialFailed(peer_id)));
                }
            }
            _ => {}
        }
    }

    fn poll(
        &mut self,
        cx: &mut Context<'_>,
    ) -> Poll<ToSwarm<Self::ToSwarm, THandlerInEvent<Self>>> {
        if let Some(action) = self.queue.pop_front() {
            return Poll::Ready(action);
        }
        // Admit controller dial requests only once the queue is drained, so a
        // burst of candidates cannot starve the actions already accepted.
        while let Poll::Ready(Some(request)) = self.dials.poll_recv(cx) {
            self.accept(request);
            if let Some(action) = self.queue.pop_front() {
                return Poll::Ready(action);
            }
        }
        Poll::Pending
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use libp2p_core::ConnectedPoint;
    use libp2p_identity::Keypair;
    use libp2p_swarm::{
        ConnectionId, DialError,
        behaviour::{ConnectionClosed, ConnectionEstablished, DialFailure},
    };
    use resurrect_core::{DiscoverySourceKind, Endpoint as ResurrectEndpoint};
    use std::task::Waker;

    fn identity() -> PeerId {
        PeerId::from(Keypair::generate_ed25519().public())
    }

    fn candidate(peer_id: &PeerId, address: &str) -> PeerCandidate {
        PeerCandidate {
            record_type: RECORD_TYPE_LIBP2P,
            peer_id: peer_id.to_bytes(),
            sequence: 1,
            endpoints: vec![ResurrectEndpoint {
                address: address.to_owned(),
            }],
            raw_signed_record: vec![1],
            expires_at: u64::MAX,
            source: DiscoverySourceKind::ResurrectRegistry,
            announcement_block: None,
            announcement_log_index: None,
        }
    }

    /// Polls the behaviour until it yields an action, giving the connector task
    /// room to run between attempts.
    async fn next_action(behaviour: &mut Behaviour) -> ToSwarm<Event, THandlerInEvent<Behaviour>> {
        let mut context = Context::from_waker(Waker::noop());
        for _ in 0..1_000 {
            if let Poll::Ready(action) = behaviour.poll(&mut context) {
                return action;
            }
            tokio::task::yield_now().await;
        }
        panic!("behaviour never produced an action");
    }

    async fn assert_pending(behaviour: &mut Behaviour) {
        let mut context = Context::from_waker(Waker::noop());
        for _ in 0..50 {
            assert!(
                behaviour.poll(&mut context).is_pending(),
                "behaviour produced an unexpected action"
            );
            tokio::task::yield_now().await;
        }
    }

    fn established(behaviour: &mut Behaviour, peer_id: PeerId) {
        let point = ConnectedPoint::Dialer {
            address: "/ip4/127.0.0.1/tcp/4001".parse().unwrap(),
            role_override: Endpoint::Dialer,
            port_use: PortUse::Reuse,
        };
        behaviour.on_swarm_event(FromSwarm::ConnectionEstablished(ConnectionEstablished {
            peer_id,
            connection_id: ConnectionId::new_unchecked(1),
            endpoint: &point,
            failed_addresses: &[],
            other_established: 0,
        }));
    }

    #[tokio::test]
    async fn a_registry_candidate_becomes_a_swarm_dial() {
        let (mut behaviour, connector) = connector(8);
        let peer_id = identity();
        let dialing = tokio::spawn({
            let candidate = candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001");
            async move { connector.connect(candidate, Duration::from_secs(5)).await }
        });

        match next_action(&mut behaviour).await {
            ToSwarm::Dial { opts } => assert_eq!(opts.get_peer_id(), Some(peer_id)),
            other => panic!("expected a dial, got {other:?}"),
        }
        match next_action(&mut behaviour).await {
            ToSwarm::GenerateEvent(Event::Dialing(dialed)) => assert_eq!(dialed, peer_id),
            other => panic!("expected a Dialing event, got {other:?}"),
        }

        // The controller stays blocked until the Swarm reports an outcome.
        established(&mut behaviour, peer_id);
        assert!(dialing.await.unwrap());
        assert_eq!(behaviour.connected_peers(), 1);
    }

    #[tokio::test]
    async fn connectivity_is_published_before_the_controller_is_woken() {
        let (mut behaviour, connector) = connector(8);
        let peer_id = identity();
        let dialing = tokio::spawn({
            let candidate = candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001");
            let connector = connector.clone();
            async move {
                let dialed = connector.connect(candidate, Duration::from_secs(5)).await;
                // The bootstrap controller reads the count immediately after a
                // successful dial; it must already include this connection.
                (dialed, connector.connected_peers().await)
            }
        });
        let _ = next_action(&mut behaviour).await;
        established(&mut behaviour, peer_id);
        assert_eq!(dialing.await.unwrap(), (true, 1));
    }

    #[tokio::test]
    async fn a_dial_failure_releases_the_controller() {
        let (mut behaviour, connector) = connector(8);
        let peer_id = identity();
        let dialing = tokio::spawn({
            let candidate = candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001");
            async move { connector.connect(candidate, Duration::from_secs(5)).await }
        });
        let _ = next_action(&mut behaviour).await;

        let error = DialError::Aborted;
        behaviour.on_swarm_event(FromSwarm::DialFailure(DialFailure {
            peer_id: Some(peer_id),
            error: &error,
            connection_id: ConnectionId::new_unchecked(1),
        }));
        assert!(!dialing.await.unwrap());
        assert_eq!(behaviour.connected_peers(), 0);
    }

    #[tokio::test]
    async fn a_silent_transport_cannot_stall_the_cycle() {
        let (mut behaviour, connector) = connector(8);
        let peer_id = identity();
        let dialing = tokio::spawn({
            let candidate = candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001");
            async move {
                connector
                    .connect(candidate, Duration::from_millis(20))
                    .await
            }
        });
        let _ = next_action(&mut behaviour).await;
        // The Swarm never reports anything back.
        assert!(!dialing.await.unwrap());
    }

    #[tokio::test]
    async fn an_already_connected_peer_is_not_redialed() {
        let (mut behaviour, connector) = connector(8);
        let peer_id = identity();
        established(&mut behaviour, peer_id);

        let dialing = tokio::spawn({
            let candidate = candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001");
            async move { connector.connect(candidate, Duration::from_secs(5)).await }
        });
        // Drives the request through poll without emitting any action.
        assert_pending(&mut behaviour).await;
        assert!(dialing.await.unwrap());
    }

    #[tokio::test]
    async fn undialable_candidates_are_rejected_without_touching_the_swarm() {
        let peer_id = identity();
        let cases = [
            (
                PeerCandidate {
                    record_type: 1,
                    ..candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001")
                },
                Rejection::UnsupportedRecordType,
            ),
            (
                PeerCandidate {
                    peer_id: vec![0xff],
                    ..candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001")
                },
                Rejection::InvalidPeerId,
            ),
            (
                candidate(&peer_id, "not-a-multiaddress"),
                Rejection::NoDialableEndpoint,
            ),
        ];

        for (rejected, expected) in cases {
            let (mut behaviour, connector) = connector(8);
            let dialing =
                tokio::spawn(
                    async move { connector.connect(rejected, Duration::from_secs(5)).await },
                );
            match next_action(&mut behaviour).await {
                ToSwarm::GenerateEvent(Event::Rejected(rejection)) => {
                    assert_eq!(rejection, expected);
                }
                other => panic!("expected {expected:?}, got {other:?}"),
            }
            assert!(!dialing.await.unwrap());
        }
    }

    #[tokio::test]
    async fn closing_the_last_connection_lowers_the_reported_count() {
        let (mut behaviour, connector) = connector(8);
        let peer_id = identity();
        established(&mut behaviour, peer_id);
        assert_eq!(connector.connected_peers().await, 1);

        let point = ConnectedPoint::Dialer {
            address: "/ip4/127.0.0.1/tcp/4001".parse().unwrap(),
            role_override: Endpoint::Dialer,
            port_use: PortUse::Reuse,
        };
        behaviour.on_swarm_event(FromSwarm::ConnectionClosed(ConnectionClosed {
            peer_id,
            connection_id: ConnectionId::new_unchecked(1),
            endpoint: &point,
            cause: None,
            remaining_established: 0,
        }));
        assert_eq!(connector.connected_peers().await, 0);
    }

    #[tokio::test]
    async fn a_dropped_swarm_fails_dials_instead_of_hanging() {
        let (behaviour, connector) = connector(8);
        let peer_id = identity();
        drop(behaviour);
        let candidate = candidate(&peer_id, "/ip4/127.0.0.1/tcp/4001");
        assert!(!connector.connect(candidate, Duration::from_secs(5)).await);
    }
}
