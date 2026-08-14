/**
 * Raw-route integration test: the GET /aionui-panel/raw dispatch inside the
 * prefix handler (mime + headers + error statuses), exercised through the
 * real FsService with a fake ctx.webServer registry.
 */
import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FsService } from '../src/host/fs-service.ts'
import { registerPanelRoutes } from '../src/host/routes.ts'
import type { WorkspaceGate } from '../src/host/gate.ts'

/** A minimal ctx fulfilling what registerPanelRoutes touches. */
function fakeCtx(): {
  ctx: Record<string, unknown>
  registrations: Array<{ kind: string; path: string; handler: (req: unknown, res: unknown) => Promise<void> }>
} {
  const registrations: Array<{ kind: string; path: string; handler: (req: unknown, res: unknown) => Promise<void> }> = []
  const ctx = {
    logger: { warn: () => {} },
    webServer: {
      register: (row: { kind: string; path: string; handler: (req: unknown, res: unknown) => Promise<void> }) => {
        registrations.push(row)
        return () => {}
      },
    },
    effect: (fn: () => void) => { fn(); return () => {} },
  }
  return { ctx, registrations }
}

/** Drive one request through the registered prefix handler. */
async function request(
  handler: (req: unknown, res: unknown) => Promise<void>,
  method: string,
  url: string,
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  let status = 0
  let headers: Record<string, string> = {}
  let body = Buffer.alloc(0)
  const res = {
    writeHead: (code: number, head: Record<string, string> = {}) => { status = code; headers = head },
    end: (chunk?: unknown) => {
      if (chunk !== undefined && chunk !== null) body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    },
  }
  await handler({ method, url }, res)
  return { status, headers, body }
}

describe('GET /aionui-panel/raw', () => {
  it('streams workspace bytes with the derived mime and no-cache', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'aionui-route-')))
    const root = join(dir, 'proj')
    await mkdir(join(root, 'assets'), { recursive: true })
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])
    await writeFile(join(root, 'assets', 'pic.png'), png)
    const gate: WorkspaceGate = async () => ({ ok: true, canonical: root })
    const { ctx, registrations } = fakeCtx()
    registerPanelRoutes(ctx as never, new FsService(gate), { status: async () => null } as never)
    const row = registrations.find((item) => item.kind === 'prefix')
    expect(row).toBeDefined()

    const result = await request(row!.handler, 'GET', `/aionui-panel/raw?root=${encodeURIComponent(root)}&path=assets/pic.png`)
    expect(result.status).toBe(200)
    expect(result.headers['content-type']).toBe('image/png')
    expect(result.headers['cache-control']).toBe('no-cache')
    expect(result.body.equals(png)).toBe(true)

    // A root-relative path with percent-encoded segments resolves the same.
    const encoded = await request(row!.handler, 'GET', `/aionui-panel/raw?root=${encodeURIComponent(root)}&path=assets%2Fpic.png`)
    expect(encoded.status).toBe(200)
    expect(encoded.body.equals(png)).toBe(true)

    await rm(dir, { recursive: true, force: true })
  })

  it('maps missing files to 404, .git and directories to 403, bad params to 400', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'aionui-route-')))
    const root = join(dir, 'proj')
    await mkdir(join(root, '.git'), { recursive: true })
    await writeFile(join(root, '.git', 'config'), 'cfg')
    const gate: WorkspaceGate = async () => ({ ok: true, canonical: root })
    const { ctx, registrations } = fakeCtx()
    registerPanelRoutes(ctx as never, new FsService(gate), { status: async () => null } as never)
    const row = registrations.find((item) => item.kind === 'prefix')!

    const missing = await request(row.handler, 'GET', `/aionui-panel/raw?root=${encodeURIComponent(root)}&path=nope.png`)
    expect(missing.status).toBe(404)
    const gitPath = await request(row.handler, 'GET', `/aionui-panel/raw?root=${encodeURIComponent(root)}&path=.git/config`)
    expect(gitPath.status).toBe(403)
    const dirPath = await request(row.handler, 'GET', `/aionui-panel/raw?root=${encodeURIComponent(root)}&path=.git`)
    expect(dirPath.status).toBe(403)
    const empty = await request(row.handler, 'GET', `/aionui-panel/raw?root=${encodeURIComponent(root)}`)
    expect(empty.status).toBe(400)
    // Other GET paths are still rejected with 405.
    const other = await request(row.handler, 'GET', '/aionui-panel/list')
    expect(other.status).toBe(405)

    await rm(dir, { recursive: true, force: true })
  })
})
