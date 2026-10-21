/**
 * HTTP transport tests: snapshot decoding, whole-ledger PUT bodies,
 * conflict mapping, and the change subscription wiring (SSE + visibility).
 */
import { describe, expect, it } from 'vitest'
import {
  HttpLedgerTransport, LEDGER_EVENTS_ROUTE, LEDGER_ROUTE, type LedgerEventSourceFace, type LedgerResponseFace,
  type LedgerTransportEnv,
} from '../src/core/http-ledger.ts'
import { LEDGER_SCHEMA_VERSION } from '../src/core/ledger.ts'
import { createTask } from '../src/core/tasks.ts'

function task(id: string) {
  return createTask({ title: id, description: '', prompt: '' }, 1, id)
}

interface Call {
  input: string
  init: { method?: string; headers?: Record<string, string>; body?: string } | undefined
}

interface FakeEnv extends LedgerTransportEnv {
  calls: Call[]
  sources: Array<LedgerEventSourceFace & { listeners: Map<string, () => void>; closed: boolean }>
  visibility: Array<() => void>
  visibilityDisposed: boolean
  lastUrl: string
}

function response(status: number, body: unknown): LedgerResponseFace {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function fakeEnv(responder: (call: Call) => Promise<LedgerResponseFace> | LedgerResponseFace): FakeEnv {
  const env: FakeEnv = {
    calls: [],
    sources: [],
    visibility: [],
    visibilityDisposed: false,
    lastUrl: '',
    fetch: async (input, init) => {
      const call = { input, init }
      env.calls.push(call)
      return responder(call)
    },
    createEventSource: (url) => {
      env.lastUrl = url
      const source = {
        listeners: new Map<string, () => void>(),
        closed: false,
        addEventListener(type: string, listener: () => void) { source.listeners.set(type, listener) },
        close() { source.closed = true },
      }
      env.sources.push(source)
      return source
    },
    onVisible: (fn) => {
      env.visibility.push(fn)
      return () => { env.visibilityDisposed = true }
    },
  }
  return env
}

const snapshot = {
  schemaVersion: LEDGER_SCHEMA_VERSION,
  revision: 5,
  updatedAt: 3,
  tasks: [task('t-1')],
}

describe('HttpLedgerTransport.read', () => {
  it('reads and decodes the full snapshot', async () => {
    const env = fakeEnv(() => response(200, { ok: true, ledger: snapshot }))
    const ledger = await new HttpLedgerTransport(env).read()
    expect(ledger?.revision).toBe(5)
    expect(ledger?.tasks.map(row => row.id)).toEqual(['t-1'])
    expect(env.calls[0].input).toBe(LEDGER_ROUTE)
  })

  it('degrades to undefined on transport and protocol failures', async () => {
    const throwing = fakeEnv(() => { throw new Error('offline') })
    expect(await new HttpLedgerTransport(throwing).read()).toBeUndefined()

    const notOk = fakeEnv(() => response(500, {}))
    expect(await new HttpLedgerTransport(notOk).read()).toBeUndefined()

    const garbage = fakeEnv(() => ({ ok: true, status: 200, json: async () => { throw new Error('not json') } }))
    expect(await new HttpLedgerTransport(garbage).read()).toBeUndefined()

    const missingLedger = fakeEnv(() => response(200, { ok: true }))
    expect(await new HttpLedgerTransport(missingLedger).read()).toBeUndefined()
  })
})

describe('HttpLedgerTransport.write', () => {
  it('sends the whole ledger against its base revision', async () => {
    const env = fakeEnv(() => response(200, { ok: true, ledger: { ...snapshot, revision: 6 } }))
    const outcome = await new HttpLedgerTransport(env).write([task('t-1'), task('t-2')], 5)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.ledger.revision).toBe(6)
    const body = JSON.parse(env.calls[0].init?.body ?? '{}') as { expectedRevision: number; tasks: unknown[] }
    expect(env.calls[0].init?.method).toBe('PUT')
    expect(body.expectedRevision).toBe(5)
    expect(body.tasks).toHaveLength(2)
  })

  it('maps 409 to a conflict carrying the Host snapshot', async () => {
    const env = fakeEnv(() => response(409, { ok: false, conflict: true, ledger: snapshot }))
    const outcome = await new HttpLedgerTransport(env).write([task('t-1')], 4)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.conflict).toBe(true)
    expect(outcome.conflict && outcome.ledger?.revision).toBe(5)
  })

  it('maps host/transport failures to a retryable failure', async () => {
    const network = fakeEnv(() => { throw new Error('offline') })
    expect(await new HttpLedgerTransport(network).write([], 1)).toEqual({ ok: false, conflict: false })

    const serverError = fakeEnv(() => response(400, { ok: false, error: 'invalid task row' }))
    expect(await new HttpLedgerTransport(serverError).write([], 1)).toEqual({ ok: false, conflict: false })
  })
})

describe('HttpLedgerTransport.subscribe', () => {
  it('opens the revision stream and reports changes, reconnects, and tab wake-ups', () => {
    const env = fakeEnv(() => response(200, {}))
    const transport = new HttpLedgerTransport(env)
    let changes = 0
    const dispose = transport.subscribe(() => { changes += 1 })

    expect(env.lastUrl).toBe(LEDGER_EVENTS_ROUTE)
    const source = env.sources[0]
    source.listeners.get('change')?.()
    source.listeners.get('open')?.()
    env.visibility[0]()
    expect(changes).toBe(3)

    dispose()
    expect(source.closed).toBe(true)
    expect(env.visibilityDisposed).toBe(true)
  })

  it('still subscribes to visibility when the stream cannot open', () => {
    const env = fakeEnv(() => response(200, {}))
    env.createEventSource = () => { throw new Error('EventSource unavailable') }
    const transport = new HttpLedgerTransport(env)
    let changes = 0
    const dispose = transport.subscribe(() => { changes += 1 })
    env.visibility[0]()
    expect(changes).toBe(1)
    dispose()
    expect(env.visibilityDisposed).toBe(true)
  })
})
