#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 || "$#" -gt 3 ]]; then
  echo "Usage: $0 <rpc-url> <router-address> [dist-directory]" >&2
  exit 2
fi

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="$1"
ROUTER_ADDRESS="$2"
DIST_DIRECTORY="${3:-${REPOSITORY_ROOT}/apps/explorer/dist}"
CAST_BIN="${CAST_BIN:-cast}"
WORK_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/resurrect-onchain-verify.XXXXXX")"
trap 'rm -rf "${WORK_DIRECTORY}"' EXIT INT TERM

CHAIN_ID="$("${CAST_BIN}" chain-id --rpc-url "${RPC_URL}")"
if [[ "${CHAIN_ID}" != "1" && "${CHAIN_ID}" != "31337" ]]; then
  echo "Refusing to verify unexpected chain ID ${CHAIN_ID}" >&2
  exit 1
fi

EXPECTED_MODE="0x3532313900000000000000000000000000000000000000000000000000000000"
ACTUAL_MODE="$("${CAST_BIN}" call "${ROUTER_ADDRESS}" 'resolveMode()(bytes32)' --rpc-url "${RPC_URL}")"
test "${ACTUAL_MODE}" = "${EXPECTED_MODE}"

verify_resource() {
  local path="$1"
  local content_type="$2"
  local response_file="${WORK_DIRECTORY}/${path}.json"
  local body_file="${WORK_DIRECTORY}/${path}.body"
  local resource_argument

  if [[ "${path}" = "index.html" ]]; then
    resource_argument='[]'
  else
    resource_argument="[\"${path}\"]"
  fi

  "${CAST_BIN}" call "${ROUTER_ADDRESS}" \
    'request(string[],(string,string)[])(uint16,string,(string,string)[])' \
    "${resource_argument}" '[]' --rpc-url "${RPC_URL}" --json >"${response_file}"

  jq -e --arg content_type "${content_type}" \
    '.[0] == 200 and .[2] == [["Content-Type", $content_type], ["Cache-Control", "public, max-age=31536000, immutable"]]' \
    "${response_file}" >/dev/null
  jq -j '.[1]' "${response_file}" >"${body_file}"
  cmp "${DIST_DIRECTORY}/${path}" "${body_file}"

  "${CAST_BIN}" call "${ROUTER_ADDRESS}" \
    'resourceInfo(string)(bool,string,uint256,address[])' "${path}" \
    --rpc-url "${RPC_URL}" --json \
    | jq -e --arg content_type "${content_type}" \
        --arg length "$(wc -c <"${DIST_DIRECTORY}/${path}" | tr -d ' ')" \
        '.[0] == true and .[1] == $content_type and (.[2] | tostring) == $length and (.[3] | length) > 0' \
        >/dev/null
}

verify_resource "index.html" "text/html; charset=utf-8"
verify_resource "index.css" "text/css; charset=utf-8"
verify_resource "app.js" "text/javascript; charset=utf-8"
verify_resource "rolldown-runtime.js" "text/javascript; charset=utf-8"
verify_resource "peer-record.js" "text/javascript; charset=utf-8"
verify_resource "peer-probe.js" "text/javascript; charset=utf-8"

"${CAST_BIN}" call "${ROUTER_ADDRESS}" \
  'request(string[],(string,string)[])(uint16,string,(string,string)[])' \
  '["index.html"]' '[]' --rpc-url "${RPC_URL}" --json \
  | jq -e '.[0] == 200' >/dev/null

"${CAST_BIN}" call "${ROUTER_ADDRESS}" \
  'request(string[],(string,string)[])(uint16,string,(string,string)[])' \
  '["missing"]' '[]' --rpc-url "${RPC_URL}" --json \
  | jq -e '.[0] == 404 and .[1] == "not found\n"' >/dev/null

echo "All onchain explorer resources match ${DIST_DIRECTORY}"
