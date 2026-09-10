export function sameAddress(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase()
}

export function shortHex(value, head = 8, tail = 6) {
  if (typeof value !== 'string' || value.length <= head + tail + 1) return value
  return `${value.slice(0, head + 2)}…${value.slice(-tail)}`
}

export function addGasMargin(gas, percent = 20n) {
  if (gas < 0n || percent < 0n) throw new RangeError('Gas values cannot be negative.')
  return (gas * (100n + percent) + 99n) / 100n
}

export function toQuantity(value) {
  if (value < 0n) throw new RangeError('RPC quantities cannot be negative.')
  return `0x${value.toString(16)}`
}

export function formatEther(wei, precision = 6) {
  const unit = 10n ** 18n
  const whole = wei / unit
  const fraction = (wei % unit).toString().padStart(18, '0').slice(0, precision).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

export function walletError(error) {
  if (error && typeof error === 'object') {
    if (error.code === 4001) return 'Request rejected in the wallet.'
    for (const key of ['shortMessage', 'reason', 'message']) {
      if (typeof error[key] === 'string' && error[key].trim()) return error[key]
    }
    if (error.data && typeof error.data === 'object' && typeof error.data.message === 'string') {
      return error.data.message
    }
  }
  return typeof error === 'string' ? error : 'The wallet returned an unknown error.'
}
