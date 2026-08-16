/**
 * LAN address derivation for the pairing URLs. Mirrors the dsh CLI's
 * boot-time sampling (apps/cli/src/app-cli-entry.ts `resolveLanTrust`): the
 * pairing links may only name addresses the /api trust fence was configured
 * with, so the same non-internal IPv4 derivation applies here — an external
 * plugin cannot read the CLI's sampled snapshot, but the fence accepts
 * exactly these literals, which is the property that matters.
 *
 * 私有网段优先排序：192.168 网段排最前（家用/办公局域网最常见，手机同网
 * 可达），10. / 172.16-31. 次之，其余（VPN / 虚拟网卡等，如 26.x）排最后
 * ——QR 面板默认选中第一个，保证手机优先连 192 网段。
 */

import { networkInterfaces } from 'node:os'

/** 地址优先级：192.168 最高（0），10. / 172.16-31. 次之（1/2），其余（3）。 */
function addressRank(ip: string): number {
  if (ip.startsWith('192.168.')) return 0
  if (ip.startsWith('10.')) return 1
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2
  return 3
}

/**
 * Non-internal IPv4 interface addresses of this machine — the IP-literal
 * authorities an all-interfaces bind is reachable by on the LAN.
 * @returns the addresses, private-network segments first (192.168 top).
 */
export function lanIPv4Addresses(): string[] {
  return Object.values(networkInterfaces()).flat()
    .filter((iface): iface is NonNullable<typeof iface> => { return iface !== undefined && iface.family === 'IPv4' && !iface.internal })
    .map(iface => iface.address)
    .sort((a, b) => addressRank(a) - addressRank(b))
}
