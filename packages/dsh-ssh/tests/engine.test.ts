/**
 * Engine integration tests against the embedded ssh2 test server:
 * exec (success/exit codes/stderr/timeout), connection pooling and
 * reconnect, key auth, cluster, PTY shell, local-port-forward tunnel,
 * SFTP upload/download/ls, and the connection probe.
 */

import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connect, createServer, type AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SshEngine } from '../src/engine.ts'
import { HostStore } from '../src/store.ts'
import type { HostPayload } from '../src/protocol.ts'
import { TEST_PASSWORD, TEST_USER, TestSshServer } from './helpers/ssh-server.ts'
import { TestSshd } from './helpers/sshd.ts'

let server: TestSshServer
let store: HostStore
let engine: SshEngine
const dir = mkdtempSync(join(tmpdir(), 'dsh-ssh-engine-'))

function addHost(alias: string, overrides: Partial<HostPayload> = {}): void {
  store.create({
    alias,
    host: '127.0.0.1',
    port: server.port,
    user: TEST_USER,
    auth: { kind: 'password', password: TEST_PASSWORD },
    ...overrides,
  } as HostPayload)
}

beforeAll(async () => {
  server = await TestSshServer.start()
  store = new HostStore(join(dir, 'hosts.json'))
  engine = new SshEngine(store, { idleTimeoutMs: 60_000, connectTimeoutMs: 5_000, defaultExecTimeoutMs: 5_000 })
})

afterAll(async () => {
  engine.dispose()
  await server.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('exec', () => {
  it('runs a command and captures stdout', async () => {
    addHost('exec-ok')
    const result = await engine.exec('exec-ok', 'echo hello')
    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('hello')
    expect(result.durationMs).toBeGreaterThan(0)
  })

  it('reports remote exit codes as failures', async () => {
    addHost('exec-code')
    const result = await engine.exec('exec-code', 'exit 7')
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(7)
  })

  it('captures stderr separately', async () => {
    addHost('exec-err')
    const result = await engine.exec('exec-err', 'out-and-err')
    expect(result.stdout).toContain('hello out')
    expect(result.stderr).toContain('hello err')
  })

  it('times out and reports timedOut', async () => {
    addHost('exec-timeout')
    const started = Date.now()
    const result = await engine.exec('exec-timeout', 'hang', 400)
    expect(result.timedOut).toBe(true)
    expect(result.success).toBe(false)
    expect(Date.now() - started).toBeLessThan(5_000)
  })

  it('fails cleanly for unknown aliases', async () => {
    await expect(engine.exec('nope', 'true')).rejects.toThrow(/not found/)
  })

  it('fails cleanly on authentication errors', async () => {
    addHost('exec-badauth', { auth: { kind: 'password', password: 'wrong' } })
    await expect(engine.exec('exec-badauth', 'true')).rejects.toThrow(/authentication/i)
  })
})

describe('connection pool', () => {
  it('reuses one connection across execs', async () => {
    addHost('pool-reuse')
    const before = server.connectCount
    await engine.exec('pool-reuse', 'true')
    await engine.exec('pool-reuse', 'echo hello')
    expect(server.connectCount).toBe(before + 1)
  })

  it('reconnects after the server drops the connection', async () => {
    addHost('pool-reconnect')
    await engine.exec('pool-reconnect', 'true')
    const before = server.connectCount
    server.killAllClients()
    await new Promise(resolve => setTimeout(resolve, 150))
    const result = await engine.exec('pool-reconnect', 'echo hello')
    expect(result.success).toBe(true)
    expect(server.connectCount).toBe(before + 1)
  })
})

describe('key auth', () => {
  it('connects with a generated private key', async () => {
    addHost('key-auth', { auth: { kind: 'key', keyPath: server.keyPair.privateKey } })
    const result = await engine.exec('key-auth', 'echo hello')
    expect(result.success).toBe(true)
    expect(result.stdout).toContain('hello')
  })
})

describe('cluster', () => {
  it('runs one command on every matched host concurrently', async () => {
    addHost('cluster-a')
    addHost('cluster-b')
    addHost('cluster-c', { environment: 'staging' })
    // The store accumulates hosts from every test; scope by explicit aliases.
    const aliases = ['cluster-a', 'cluster-b', 'cluster-c']
    const results = await engine.cluster({ command: 'echo hello', aliases })
    expect(results).toHaveLength(3)
    for (const result of results) {
      expect(result.ok).toBe(true)
      expect(result.stdout).toContain('hello')
    }
    const scoped = await engine.cluster({ command: 'true', aliases: ['cluster-a'] })
    expect(scoped).toHaveLength(1)
    expect(scoped[0]?.alias).toBe('cluster-a')
    const staging = await engine.cluster({ command: 'true', aliases, environment: 'staging' })
    expect(staging).toHaveLength(1)
    expect(staging[0]?.alias).toBe('cluster-c')
    const none = await engine.cluster({ command: 'true', aliases, environment: 'production' })
    expect(none).toHaveLength(0)
  })
})

describe('shell', () => {
  it('opens a PTY, echoes input, resizes, and exits', async () => {
    addHost('shell-host')
    const session = await engine.openShell('shell-host', { cols: 80, rows: 24 })
    const outputs: string[] = []
    let exited = false
    session.onData = (data) => outputs.push(data.toString('utf8'))
    session.onExit = () => { exited = true }
    await new Promise(resolve => setTimeout(resolve, 200))
    // Bidirectional flow: input written to the shell is echoed back.
    session.send('ping\r')
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(outputs.join('')).toContain('ping')
    session.resize(100, 30)
    await new Promise(resolve => setTimeout(resolve, 100))
    session.close()
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(exited).toBe(true)
  })
})

describe('tunnel', () => {
  it('forwards a local port to the remote echo server', async () => {
    addHost('tunnel-host')
    const tunnel = await engine.startTunnel('tunnel-host', { remotePort: server.echoPort })
    expect(tunnel.localPort).toBeGreaterThan(0)
    expect(engine.listTunnels()).toHaveLength(1)
    const reply = await new Promise<string>((resolve, reject) => {
      const socket = connect(tunnel.localPort, '127.0.0.1')
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('tunnel echo timed out')) }, 3_000)
      socket.on('connect', () => socket.write('ping-through-tunnel'))
      socket.on('data', (chunk: Buffer) => {
        clearTimeout(timer)
        socket.destroy()
        resolve(chunk.toString('utf8'))
      })
      socket.on('error', (error) => { clearTimeout(timer); reject(error) })
    })
    expect(reply).toBe('ping-through-tunnel')
    expect(engine.stopTunnel(tunnel.id)).toBe(true)
    expect(engine.listTunnels()).toHaveLength(0)
  })
})

describe('sftp (real sshd)', () => {
  it('uploads, lists, and downloads files', async () => {
    const sshd = await TestSshd.start()
    try {
      store.create({
        alias: 'sftp-real',
        host: '127.0.0.1',
        port: sshd.port,
        user: process.env.USER ?? 'root',
        auth: { kind: 'key', keyPath: sshd.clientKey },
      })
      const remoteDir = join(sshd.root, 'up')
      const local = join(sshd.root, 'payload.txt')
      const content = 'sftp roundtrip payload ' + Math.random()
      writeFileSync(local, content, 'utf8')

      const uploaded = await engine.upload('sftp-real', local, join(remoteDir, 'payload.txt'), false)
      expect(uploaded.bytes).toBe(content.length)

      const listing = await engine.ls('sftp-real', remoteDir)
      expect(listing.some(entry => entry.name === 'payload.txt' && entry.type === 'file')).toBe(true)

      const downloaded = await engine.download('sftp-real', join(remoteDir, 'payload.txt'), join(sshd.root, 'out.txt'))
      expect(downloaded.bytes).toBe(content.length)
      expect(readFileSync(join(sshd.root, 'out.txt'), 'utf8')).toBe(content)
    } finally {
      sshd.stop()
    }
  })
})


describe('cluster filters', () => {
  it('matches hosts carrying ALL requested tags', async () => {
    addHost('tag-web', { tags: ['web'] })
    addHost('tag-both', { tags: ['web', 'staging'] })
    addHost('tag-staging', { tags: ['staging'] })
    const results = await engine.cluster({ command: 'true', tags: ['web', 'staging'] })
    expect(results.map(r => r.alias)).toEqual(['tag-both'])
  })

  it('rejects invalid maxWorkers', async () => {
    await expect(engine.cluster({ command: 'true', maxWorkers: 0 })).rejects.toThrow(/maxWorkers/)
    await expect(engine.cluster({ command: 'true', maxWorkers: -2 })).rejects.toThrow(/maxWorkers/)
  })
})

describe('tunnel safety', () => {
  it('rejects out-of-range ports', async () => {
    addHost('tun-port')
    await expect(engine.startTunnel('tun-port', { remotePort: 0 })).rejects.toThrow(/remotePort/)
    await expect(engine.startTunnel('tun-port', { remotePort: 70_000 })).rejects.toThrow(/remotePort/)
    await expect(engine.startTunnel('tun-port', { remotePort: 22, localPort: 0 })).rejects.toThrow(/localPort/)
  })

  it('rolls back the connection when the local port is taken', async () => {
    addHost('tun-conflict')
    const blocker = createServer(() => undefined)
    await new Promise<void>((resolve) => { blocker.listen(0, '127.0.0.1', resolve) })
    const takenPort = (blocker.address() as AddressInfo).port
    await expect(
      engine.startTunnel('tun-conflict', { remotePort: server.echoPort, localPort: takenPort }),
    ).rejects.toThrow()
    expect(engine.listTunnels()).toHaveLength(0)
    // The failed tunnel must not pin a leaked connection: exec still works.
    const result = await engine.exec('tun-conflict', 'true')
    expect(result.success).toBe(true)
    await new Promise<void>((resolve) => { blocker.close(() => resolve()) })
  })

  it('stops tunnels scoped by alias', async () => {
    addHost('tun-a')
    addHost('tun-b')
    const a = await engine.startTunnel('tun-a', { remotePort: server.echoPort })
    const b = await engine.startTunnel('tun-b', { remotePort: server.echoPort })
    const stopped = engine.stopAllTunnels('tun-a')
    expect(stopped).toBe(1)
    expect(engine.listTunnels().map(t => t.id)).toEqual([b.id])
    expect(engine.stopTunnel(b.id)).toBe(true)
    expect(engine.listTunnels()).toHaveLength(0)
  })
})

describe('shell isolation', () => {
  it('shell sessions use their own connection and never disturb pooled execs', async () => {
    addHost('shell-iso')
    await engine.exec('shell-iso', 'true')
    const before = server.connectCount
    const session = await engine.openShell('shell-iso', { cols: 80, rows: 24 })
    // Opening the shell must not reuse the pooled connection.
    expect(server.connectCount).toBe(before + 1)
    session.close()
    await new Promise(resolve => setTimeout(resolve, 300))
    const result = await engine.exec('shell-iso', 'echo hello')
    expect(result.success).toBe(true)
    expect(result.stdout).toContain('hello')
    // The exec reused the ORIGINAL pooled connection (no new connect).
    expect(server.connectCount).toBe(before + 1)
  })
})

describe('sweep safety', () => {
  it('does not sweep an in-flight exec past the idle timeout', async () => {
    addHost('sweep-exec')
    const engine2 = new SshEngine(store, { idleTimeoutMs: 300, defaultExecTimeoutMs: 2_000 })
    try {
      let resolved = false
      const pending = engine2.exec('sweep-exec', 'hang', 1_500).then(result => {
        resolved = true
        return result
      })
      await new Promise(resolve => setTimeout(resolve, 800))
      // Still running well past the idle timeout: the sweep must not kill it.
      expect(resolved).toBe(false)
      const result = await pending
      expect(result.timedOut).toBe(true)
    } finally {
      engine2.dispose()
    }
  })
})

describe('upload path rules', () => {
  it('rejects relative remote paths', async () => {
    addHost('rel-path')
    await expect(
      engine.upload('rel-path', join(process.cwd(), 'package.json'), 'relative/dir/file.txt', false),
    ).rejects.toThrow(/absolute/)
  })
})

describe('probe', () => {
  it('reports a working connection', async () => {
    addHost('probe-host')
    const result = await engine.test('probe-host')
    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThan(0)
  })

  it('reports failures', async () => {
    addHost('probe-bad', { auth: { kind: 'password', password: 'nope' } })
    const result = await engine.test('probe-bad')
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })
})
