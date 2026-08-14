/**
 * The SSH engine: a per-alias persistent connection pool (ssh2) with
 * multi-hop jump support, command execution, PTY shells, SFTP transfers,
 * local port-forward tunnels and cluster execution — the DSH counterpart of
 * ssh-skill's daemon + scripts, living entirely in the host process.
 */

import { createServer, type Server as NetServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, statSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { Client, type ClientChannel, type ConnectConfig } from 'ssh2'
import type { ClusterResult, ExecResult, SshHostEntry, SshHostSummary, TestResult, TransferProgress, TunnelInfo } from './protocol.ts'
import { expandHome, type HostStore } from './store.ts'

/** Default engine knobs. */
export interface EngineOptions {
  /** Connections idle longer than this are closed (ms). */
  idleTimeoutMs?: number
  /** SSH handshake timeout (ms). */
  connectTimeoutMs?: number
  /** Keepalive ping interval (ms). */
  keepaliveIntervalMs?: number
  /** Cap on captured stdout/stderr bytes per exec (ms). */
  maxOutputBytes?: number
  /** Default exec timeout (ms). */
  defaultExecTimeoutMs?: number
  /** Default cluster concurrency. */
  defaultMaxWorkers?: number
  /** SFTP concurrent channel count for transfers. */
  sftpConcurrency?: number
}

const DEFAULTS: Required<EngineOptions> = {
  idleTimeoutMs: 30 * 60_000,
  connectTimeoutMs: 15_000,
  keepaliveIntervalMs: 15_000,
  maxOutputBytes: 2 * 1024 * 1024,
  defaultExecTimeoutMs: 60_000,
  defaultMaxWorkers: 8,
  sftpConcurrency: 8,
}

/** One pooled connection record. */
interface PoolRecord {
  client: Client
  /** Jump-chain clients kept alive under the target. */
  hops: Client[]
  idleAt: number
  /** Pinned connections (tunnels) are never swept. */
  pinned: boolean
  broken: boolean
  /** Operations currently running on this connection (sweep guard). */
  inFlight: number
}

/** A live PTY shell session. */
export interface ShellSession {
  /** Assign to receive remote output. */
  onData?: (data: Buffer) => void
  /** Assign to be notified when the channel closes. */
  onExit?: (code: number | null, error?: string) => void
  /** Write raw input to the shell. */
  send(data: string): void
  /** Resize the remote PTY. */
  resize(cols: number, rows: number): void
  /** Close the session and its channel. */
  close(): void
  /** Pause remote output delivery (transport backpressure). */
  pause(): void
  /** Resume remote output delivery. */
  resume(): void
}

/** One active tunnel record (server + pinned client + live sockets). */
interface TunnelRecord {
  info: TunnelInfo
  server: NetServer
  alias: string
  sockets: Set<import('node:net').Socket>
}

/** Build the ssh2 connect config for one entry (key read from disk). */
function buildConnectConfig(entry: SshHostEntry, sock?: ConnectConfig['sock']): ConnectConfig {
  const config: ConnectConfig = {
    host: entry.host,
    port: entry.port,
    username: entry.user,
    readyTimeout: 15_000,
    keepaliveInterval: 15_000,
    keepaliveCountMax: 3,
  }
  if (sock !== undefined) config.sock = sock
  if (entry.auth.kind === 'password') {
    config.password = entry.auth.password
  } else {
    const keyPath = entry.auth.keyPath === undefined ? undefined : expandHome(entry.auth.keyPath)
    if (keyPath === undefined || !existsSync(keyPath)) {
      throw new Error(`private key not found: '${entry.auth.keyPath ?? '(unset)'}'`)
    }
    config.privateKey = readFileSync(keyPath, 'utf8')
    if (entry.auth.passphrase !== undefined && entry.auth.passphrase !== '') {
      config.passphrase = entry.auth.passphrase
    }
  }
  return config
}

/** Connect one ssh2 client (resolve on ready, reject on error/close). */
function connectClient(config: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    let settled = false
    client.once('ready', () => {
      if (settled) return
      settled = true
      resolve(client)
    })
    client.once('error', (error) => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error)))
    })
    try {
      client.connect(config)
    } catch (error) {
      if (!settled) {
        settled = true
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
  })
}

/** Cap captured output at the configured byte budget (marks truncation). */
function appendOutput(target: { text: string; truncated: boolean }, chunk: Buffer, maxBytes: number): void {
  if (target.truncated) return
  if (target.text.length + chunk.length > maxBytes) {
    let cut = chunk.toString('utf8').slice(0, maxBytes - target.text.length)
    // Never split a surrogate pair at the cut boundary.
    if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1)
    target.text += cut + '…[output truncated]'
    target.truncated = true
    return
  }
  target.text += chunk.toString('utf8')
}

/** Walk a local directory, collecting relative paths of every file. */
function walkLocalDir(root: string): string[] {
  const files: string[] = []
  const visit = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const stat = statSync(full)
      if (stat.isDirectory()) visit(full)
      else if (stat.isFile()) files.push(relative(root, full))
    }
  }
  visit(root)
  return files
}

/**
 * The engine. Owns the pool, tunnels, and all operations. One instance per
 * plugin apply; dispose() closes every connection.
 */
export class SshEngine {
  private readonly store: HostStore
  private readonly opts: Required<EngineOptions>
  private readonly pool = new Map<string, PoolRecord>()
  private readonly tunnels = new Map<string, TunnelRecord>()
  private sweepTimer: NodeJS.Timeout | undefined
  private nextTunnelId = 1

  /**
   * @param store - the host config store.
   * @param options - engine knobs (defaults applied).
   */
  constructor(store: HostStore, options?: EngineOptions) {
    this.store = store
    this.opts = { ...DEFAULTS, ...options }
    this.sweepTimer = setInterval(() => this.sweep(), Math.max(10_000, this.opts.idleTimeoutMs / 4))
    this.sweepTimer.unref?.()
  }

  // ---------------------------------------------------------------- config

  /** Secret-free host list (filtered by the optional query). */
  list(query?: string): SshHostSummary[] {
    const needle = query?.trim().toLowerCase()
    return this.store.list()
      .filter(entry => needle === undefined || needle === ''
        || entry.alias.toLowerCase().includes(needle)
        || (entry.description ?? '').toLowerCase().includes(needle)
        || entry.host.toLowerCase().includes(needle)
        || entry.tags.some(tag => tag.toLowerCase().includes(needle)))
      .map(entry => this.store.summarize(entry))
  }

  /** One host summary by alias. */
  find(alias: string): SshHostSummary | undefined {
    const entry = this.store.find(alias)
    return entry === undefined ? undefined : this.store.summarize(entry)
  }

  // -------------------------------------------------------------- pool

  /**
   * Run `fn` with a live client for `alias`, reconnecting (up to the
   * attempt budget) when the connection broke mid-flight.
   */
  private async withClient<T>(alias: string, fn: (client: Client) => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let record = this.pool.get(alias)
      if (record === undefined || record.broken) {
        if (record !== undefined) this.disposeRecord(alias, record)
        record = await this.acquire(alias)
      }
      record.idleAt = Date.now()
      record.inFlight += 1
      try {
        const result = await fn(record.client)
        record.idleAt = Date.now()
        return result
      } finally {
        record.inFlight -= 1
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  /**
   * Build one full jump chain for an entry: hop clients connected through in
   * order, each forwarding a stream to the next destination, ending with the
   * target client. Shared by the pool and standalone shell sessions.
   */
  private async connectChain(entry: SshHostEntry): Promise<{ client: Client; hops: Client[] }> {
    const hops: Client[] = []
    let sock: ConnectConfig['sock']
    const chain = entry.proxyJump
    for (let index = 0; index < chain.length; index += 1) {
      const hopAlias = chain[index]
      const hop = this.store.find(hopAlias)
      if (hop === undefined) {
        for (const client of hops) client.end()
        throw new Error(`proxyJump alias '${hopAlias}' not found — create it first`)
      }
      const hopClient = await connectClient(buildConnectConfig(hop, sock))
      hops.push(hopClient)
      const next = index + 1 < chain.length ? this.store.find(chain[index + 1]) : undefined
      const nextHost = next !== undefined ? next.host : entry.host
      const nextPort = next !== undefined ? next.port : entry.port
      sock = await new Promise<ConnectConfig['sock']>((resolve, reject) => {
        hopClient.forwardOut('127.0.0.1', 0, nextHost, nextPort, (error, stream) => {
          if (error !== undefined) {
            for (const client of hops) client.end()
            reject(error)
          } else {
            resolve(stream)
          }
        })
      })
    }
    try {
      const client = await connectClient(buildConnectConfig(entry, sock))
      return { client, hops }
    } catch (error) {
      for (const client of hops) client.end()
      throw error
    }
  }

  /** In-flight acquire promises, deduped per alias (concurrent first use). */
  private readonly acquireQueue = new Map<string, Promise<PoolRecord>>()

  /** Connect (or reuse) the pooled chain for one alias; pins nothing. */
  private async acquire(alias: string): Promise<PoolRecord> {
    const pending = this.acquireQueue.get(alias)
    if (pending !== undefined) return pending
    const task = this.doAcquire(alias)
    this.acquireQueue.set(alias, task)
    try {
      return await task
    } finally {
      if (this.acquireQueue.get(alias) === task) this.acquireQueue.delete(alias)
    }
  }

  private async doAcquire(alias: string): Promise<PoolRecord> {
    const entry = this.store.find(alias)
    if (entry === undefined) throw new Error(`alias '${alias}' not found — add it first`)
    const { client, hops } = await this.connectChain(entry)
    const record: PoolRecord = { client, hops, idleAt: Date.now(), pinned: false, broken: false, inFlight: 0 }
    client.on('error', () => { record.broken = true })
    client.on('close', () => { record.broken = true })
    this.pool.set(alias, record)
    return record
  }

  /**
   * Tear down one alias's record. When `record` is given and no longer the
   * pooled record for the alias (a concurrent acquire replaced it), nothing
   * is torn down — the connection belongs to someone else now.
   */
  private disposeRecord(alias: string, record?: PoolRecord): void {
    const current = this.pool.get(alias)
    if (record !== undefined && current !== record) return
    if (current === undefined) return
    this.pool.delete(alias)
    try { current.client.end() } catch { /* already closed */ }
    for (const hop of current.hops) {
      try { hop.end() } catch { /* already closed */ }
    }
  }

  /** Close connections idle beyond the threshold (skips pinned and in-flight). */
  private sweep(): void {
    const cutoff = Date.now() - this.opts.idleTimeoutMs
    for (const [alias, record] of this.pool) {
      if (!record.pinned && record.inFlight === 0 && record.idleAt < cutoff) {
        this.disposeRecord(alias, record)
      }
    }
  }

  // --------------------------------------------------------------- exec

  /** Run one command on `alias` (reusing the pooled connection). */
  async exec(alias: string, command: string, timeoutMs?: number): Promise<ExecResult> {
    const started = Date.now()
    const budget = timeoutMs !== undefined && timeoutMs > 0 ? timeoutMs : this.opts.defaultExecTimeoutMs
    return this.withClient(alias, async (client) => {
      return await new Promise<ExecResult>((resolve, reject) => {
        client.exec(command, (error, stream) => {
          if (error !== undefined) {
            reject(error)
            return
          }
          const stdout = { text: '', truncated: false }
          const stderr = { text: '', truncated: false }
          let timedOut = false
          let settled = false
          const finish = (): void => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve({
              success: false,
              exitCode: null,
              timedOut,
              stdout: stdout.text,
              stderr: stderr.text,
              durationMs: Date.now() - started,
              error: timedOut ? `command timed out after ${budget} ms` : undefined,
            })
          }
          const timer = setTimeout(() => {
            timedOut = true
            try { stream.signal('KILL') } catch { /* channel gone */ }
            try { stream.close() } catch { /* channel gone */ }
            // Hard deadline: settle now even if the peer never acks the
            // channel close (the stream 'close' handler is then a no-op).
            finish()
          }, budget)
          stream.on('data', (chunk: Buffer) => appendOutput(stdout, chunk, this.opts.maxOutputBytes))
          stream.stderr.on('data', (chunk: Buffer) => appendOutput(stderr, chunk, this.opts.maxOutputBytes))
          stream.on('close', (code: number | null) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve({
              success: code === 0 && !timedOut,
              exitCode: code,
              timedOut,
              stdout: stdout.text,
              stderr: stderr.text,
              durationMs: Date.now() - started,
            })
          })
          stream.on('error', (streamError: Error) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject(streamError)
          })
        })
      })
    })
  }

  /** Run one command against many hosts concurrently. */
  async cluster(options: {
    command: string
    aliases?: string[]
    environment?: string
    tags?: string[]
    timeoutMs?: number
    maxWorkers?: number
  }): Promise<ClusterResult[]> {
    let targets = this.store.list()
    if (options.aliases !== undefined && options.aliases.length > 0) {
      targets = targets.filter(entry => options.aliases!.includes(entry.alias))
    }
    if (options.environment !== undefined && options.environment !== '') {
      targets = targets.filter(entry => entry.environment === options.environment)
    }
    if (options.tags !== undefined && options.tags.length > 0) {
      // ALL semantics (matches the ssh_cluster tool description).
      targets = targets.filter(entry => options.tags!.every(tag => entry.tags.includes(tag)))
    }
    if (targets.length === 0) return []
    if (options.maxWorkers !== undefined && (!Number.isInteger(options.maxWorkers) || options.maxWorkers < 1)) {
      throw new Error('maxWorkers must be a positive integer')
    }
    const workers = Math.min(this.opts.defaultMaxWorkers, options.maxWorkers ?? this.opts.defaultMaxWorkers, targets.length)
    const results: ClusterResult[] = []
    const queue = [...targets]
    const run = async (): Promise<void> => {
      while (queue.length > 0) {
        const entry = queue.shift()!
        try {
          const result = await this.exec(entry.alias, options.command, options.timeoutMs)
          results.push({ alias: entry.alias, ok: result.success, exitCode: result.exitCode, timedOut: result.timedOut, stdout: result.stdout, stderr: result.stderr, durationMs: result.durationMs })
        } catch (error) {
          results.push({ alias: entry.alias, ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
    await Promise.all(Array.from({ length: workers }, () => run()))
    return results
  }

  // -------------------------------------------------------------- shell

  /** Open a PTY shell session for the web terminal (standalone connection). */
  async openShell(alias: string, size: { cols: number; rows: number }): Promise<ShellSession> {
    const entry = this.store.find(alias)
    if (entry === undefined) throw new Error(`alias '${alias}' not found — add it first`)
    // The shell is a long-lived exclusive stream: use its own connection so
    // closing it can never tear down a pooled exec/tunnel sharing the alias.
    const { client, hops } = await this.connectChain(entry)
    return await new Promise<ShellSession>((resolve, reject) => {
      client.shell({ term: 'xterm-256color', cols: size.cols, rows: size.rows }, (error, stream) => {
        if (error !== undefined) {
          try { client.end() } catch { /* closed */ }
          for (const hop of hops) { try { hop.end() } catch { /* closed */ } }
          reject(error)
          return
        }
        let tornDown = false
        const teardown = (): void => {
          if (tornDown) return
          tornDown = true
          try { client.end() } catch { /* closed */ }
          for (const hop of hops) { try { hop.end() } catch { /* closed */ } }
        }
        const session: ShellSession = {
          send: (data) => { try { stream.write(data) } catch { /* channel gone */ } },
          resize: (cols, rows) => { try { stream.setWindow(rows, cols, rows, cols) } catch { /* channel gone */ } },
          close: () => {
            try { stream.close() } catch { /* channel gone */ }
            teardown()
          },
          pause: () => { try { stream.pause() } catch { /* channel gone */ } },
          resume: () => { try { stream.resume() } catch { /* channel gone */ } },
        }
        stream.on('data', (chunk: Buffer) => { session.onData?.(chunk) })
        stream.on('close', (code: number | null) => {
          teardown()
          session.onExit?.(code)
        })
        stream.on('error', (streamError: Error) => {
          teardown()
          session.onExit?.(null, streamError instanceof Error ? streamError.message : String(streamError))
        })
        resolve(session)
      })
    })
  }

  // -------------------------------------------------------------- sftp

  /** Upload one local file (or directory tree) to a remote path. */
  async upload(alias: string, localPath: string, remotePath: string, recursive: boolean, onProgress?: (progress: TransferProgress) => void): Promise<{ bytes: number; files: number }> {
    // Remote paths must be absolute: the mkdir chain and fastPut must agree
    // on one resolution (relative paths previously created dirs at the root).
    if (!remotePath.startsWith('/')) {
      throw new Error(`remotePath must be an absolute path (got '${remotePath}')`)
    }
    const local = resolvePath(localPath)
    if (!existsSync(local)) throw new Error(`local path not found: '${localPath}'`)
    return this.withClient(alias, async (client) => {
      const sftp = await this.sftp(client)
      const stat = statSync(local)
      let files: string[]
      if (stat.isDirectory()) {
        if (!recursive) throw new Error(`'${localPath}' is a directory — enable recursive upload`)
        files = walkLocalDir(local)
        await this.ensureRemoteDir(sftp, remotePath)
      } else {
        files = ['']
        await this.ensureRemoteDir(sftp, dirname(remotePath))
      }
      let bytes = 0
      for (const rel of files) {
        const src = rel === '' ? local : join(local, rel)
        // Remote paths always use forward slashes; normalize any OS separators.
        const remoteRel = rel.split(/[\\/]/).join('/')
        const dst = rel === '' ? remotePath : remotePath.replace(/\/$/, '') + '/' + remoteRel
        await this.fastPut(sftp, src, dst, onProgress)
        bytes += statSync(src).size
      }
      return { bytes, files: files.length }
    })
  }

  /** Download one remote file to a local path. */
  async download(alias: string, remotePath: string, localPath: string, onProgress?: (progress: TransferProgress) => void): Promise<{ bytes: number }> {
    return this.withClient(alias, async (client) => {
      const sftp = await this.sftp(client)
      const stat = await new Promise<{ isDirectory: () => boolean }>((resolve, reject) => {
        sftp.stat(remotePath, (error, stats) => error !== undefined ? reject(error) : resolve(stats))
      })
      if (stat.isDirectory()) {
        throw new Error(`'${remotePath}' is a directory — directory download is not supported yet (download individual files)`)
      }
      const local = resolvePath(localPath)
      if (!existsSync(dirname(local))) mkdirSync(dirname(local), { recursive: true })
      await this.fastGet(sftp, remotePath, local, onProgress)
      return { bytes: statSync(local).size }
    })
  }

  /** List a remote directory (file browser). */
  async ls(alias: string, path: string): Promise<import('./protocol.ts').RemoteDirEntry[]> {
    return this.withClient(alias, async (client) => {
      const sftp = await this.sftp(client)
      return await new Promise((resolve, reject) => {
        sftp.readdir(path, (error, list) => {
          if (error !== undefined) {
            reject(error)
            return
          }
          const entries: import('./protocol.ts').RemoteDirEntry[] = list.map(item => ({
            name: item.filename,
            type: item.attrs.isDirectory() ? 'dir' : item.attrs.isFile() ? 'file' : 'other',
            size: item.attrs.size,
            mtimeMs: item.attrs.mtime * 1000,
            mode: item.attrs.mode,
          }))
          resolve(entries)
        })
      })
    })
  }

  private sftp(client: Client): Promise<import('ssh2').SFTPWrapper> {
    return new Promise((resolve, reject) => {
      client.sftp((error, sftp) => error !== undefined ? reject(error) : resolve(sftp))
    })
  }

  /** Create a remote directory chain (stat-then-mkdir per segment). */
  private ensureRemoteDir(sftp: import('ssh2').SFTPWrapper, remote: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const segments = remote.replace(/^\/+/, '').split('/').filter(segment => segment !== '')
      const walk = (index: number): void => {
        if (index >= segments.length) {
          resolve()
          return
        }
        const current = '/' + segments.slice(0, index + 1).join('/')
        sftp.stat(current, (statError) => {
          if (statError === undefined) {
            walk(index + 1)
            return
          }
          // Statting a missing path fails; mkdir it (idempotent because the
          // stat check runs first — some sftp servers throw on EEXIST).
          sftp.mkdir(current, (mkdirError) => {
            if (mkdirError !== undefined) {
              reject(mkdirError)
              return
            }
            walk(index + 1)
          })
        })
      }
      walk(0)
    })
  }

  private fastPut(sftp: import('ssh2').SFTPWrapper, src: string, dst: string, onProgress?: (progress: TransferProgress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let last = 0
      let lastEmit = 0
      const started = Date.now()
      onProgress?.({ phase: 'transferring', file: dst, transferred: 0, total: statSync(src).size, percent: 0 })
      sftp.fastPut(src, dst, { concurrency: this.opts.sftpConcurrency, step: (transferred: number, _chunk: number, total: number) => {
        const now = Date.now()
        // Throttle: high-speed links fire one callback per chunk; the UI only
        // needs ~10 frames per second.
        if (now - lastEmit < 100 && transferred < total) return
        lastEmit = now
        const elapsed = (now - started) / 1000
        onProgress?.({
          phase: 'transferring',
          file: dst,
          transferred,
          total,
          percent: total > 0 ? Math.round((transferred / total) * 1000) / 10 : 0,
          speedBps: elapsed > 0 ? Math.round((transferred - last) / elapsed) : undefined,
        })
        last = transferred
      } }, (error) => {
        if (error !== undefined) {
          onProgress?.({ phase: 'error', file: dst, transferred: 0, total: 0, percent: 0, error: String(error) })
          reject(error)
        } else {
          onProgress?.({ phase: 'done', file: dst, transferred: statSync(src).size, total: statSync(src).size, percent: 100 })
          resolve()
        }
      })
    })
  }

  private fastGet(sftp: import('ssh2').SFTPWrapper, src: string, dst: string, onProgress?: (progress: TransferProgress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let last = 0
      let lastEmit = 0
      const started = Date.now()
      sftp.fastGet(src, dst, { concurrency: this.opts.sftpConcurrency, step: (transferred: number, _chunk: number, total: number) => {
        const now = Date.now()
        if (now - lastEmit < 100 && transferred < total) return
        lastEmit = now
        const elapsed = (now - started) / 1000
        onProgress?.({
          phase: 'transferring',
          file: src,
          transferred,
          total,
          percent: total > 0 ? Math.round((transferred / total) * 1000) / 10 : 0,
          speedBps: elapsed > 0 ? Math.round((transferred - last) / elapsed) : undefined,
        })
        last = transferred
      } }, (error) => {
        if (error !== undefined) {
          onProgress?.({ phase: 'error', file: src, transferred: 0, total: 0, percent: 0, error: String(error) })
          reject(error)
        } else {
          onProgress?.({ phase: 'done', file: src, transferred: statSync(dst).size, total: statSync(dst).size, percent: 100 })
          resolve()
        }
      })
    })
  }

  // ------------------------------------------------------------- tunnel

  /** Start a local port-forward tunnel (listens on 127.0.0.1 only). */
  async startTunnel(alias: string, options: { remotePort: number; remoteHost?: string; localPort?: number }): Promise<TunnelInfo> {
    if (!Number.isInteger(options.remotePort) || options.remotePort < 1 || options.remotePort > 65535) {
      throw new Error('remotePort must be an integer in 1..65535')
    }
    if (options.localPort !== undefined && (!Number.isInteger(options.localPort) || options.localPort < 1 || options.localPort > 65535)) {
      throw new Error('localPort must be an integer in 1..65535')
    }
    const entry = this.store.find(alias)
    if (entry === undefined) throw new Error(`alias '${alias}' not found — add it first`)
    const remoteHost = options.remoteHost ?? '127.0.0.1'
    const id = `tun-${this.nextTunnelId++}`
    const info: TunnelInfo = {
      id,
      alias,
      localPort: 0,
      remoteHost,
      remotePort: options.remotePort,
      state: 'connecting',
      startedAt: Date.now(),
    }
    const record = await this.acquire(alias)
    const client = record.client
    const sockets = new Set<import('node:net').Socket>()
    const server = createServer((socket) => {
      sockets.add(socket)
      socket.on('close', () => { sockets.delete(socket) })
      client.forwardOut('127.0.0.1', 0, remoteHost, options.remotePort, (error, stream) => {
        if (error !== undefined) {
          socket.destroy()
          return
        }
        // Both ends of the pipe can die independently; destroy the pair so an
        // unhandled 'error' event can never crash the host process.
        const destroy = (): void => {
          try { socket.destroy() } catch { /* gone */ }
          try { stream.close() } catch { /* gone */ }
        }
        stream.on('error', destroy)
        socket.on('error', destroy)
        stream.on('close', destroy)
        socket.on('close', destroy)
        stream.pipe(socket).pipe(stream)
      })
    })
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(options.localPort ?? 0, '127.0.0.1', () => {
          server.removeListener('error', reject)
          resolve()
        })
      })
    } catch (error) {
      // Roll back: never leave an unpinned orphan connection behind.
      if (!record.pinned && record.inFlight === 0) this.disposeRecord(alias, record)
      throw error
    }
    record.pinned = true
    const address = server.address()
    info.localPort = typeof address === 'object' && address !== null ? address.port : 0
    info.state = 'forwarding'
    this.tunnels.set(id, { info, server, alias, sockets })
    return info
  }

  /** All active tunnels. */
  listTunnels(): TunnelInfo[] {
    return [...this.tunnels.values()].map(tunnel => ({ ...tunnel.info }))
  }

  /** Stop one tunnel (closes the listener, live sockets, and the pinned connection). */
  stopTunnel(id: string): boolean {
    const tunnel = this.tunnels.get(id)
    if (tunnel === undefined) return false
    this.tunnels.delete(id)
    try { tunnel.server.close() } catch { /* already closed */ }
    for (const socket of tunnel.sockets) {
      try { socket.destroy() } catch { /* already closed */ }
    }
    tunnel.sockets.clear()
    this.disposeRecord(tunnel.alias)
    return true
  }

  /** Stop all tunnels (optionally for one alias). */
  stopAllTunnels(alias?: string): number {
    let count = 0
    for (const [id, tunnel] of [...this.tunnels]) {
      if (alias === undefined || tunnel.alias === alias) {
        this.stopTunnel(id)
        count += 1
      }
    }
    return count
  }

  // ------------------------------------------------------------- misc

  /** Probe connectivity: connect, run `true`, close. */
  async test(alias: string): Promise<TestResult> {
    const started = Date.now()
    try {
      const result = await this.exec(alias, 'true', 10_000)
      return result.success
        ? { ok: true, latencyMs: result.durationMs }
        : { ok: false, latencyMs: result.durationMs, error: `remote exit code ${result.exitCode}` }
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Close every pooled connection and tunnel. */
  dispose(): void {
    if (this.sweepTimer !== undefined) clearInterval(this.sweepTimer)
    for (const id of [...this.tunnels.keys()]) this.stopTunnel(id)
    for (const alias of [...this.pool.keys()]) this.disposeRecord(alias)
  }
}

