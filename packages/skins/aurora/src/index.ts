/**
 * aurora 皮肤 — 宿主半区。
 * 注册 `/api/skin-aurora/config` 路由（GET 读 / PUT 写），把自定义背景配置持久化到
 * `~/.dsh/skin-aurora.json`。皮肤中心卡片（浏览器半区）与 aurora 皮肤本身都通过
 * 该接口读写配置——绕开 /api 设置桥的命名空间白名单限制（dsh-host-apiproxy
 * 的 WEB_SETTINGS_NAMESPACES，与 pet 的 /api/pet/* 同模式）。
 * @module @captain1275/dsh-client-ui-skin-aurora
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { homedir } from 'node:os'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-skin-aurora'

/** 配置形状。 */
export interface AuroraSkinConfig {
  enabled: boolean
  backgroundUrl: string
  opacity: number
  blur: number
  /** 背景媒体类型：image（图片/动图）或 video（视频）。 */
  mediaType: 'image' | 'video'
  /** 视频是否静音（仅 mediaType=video 时有效）。 */
  muted: boolean
}

const DEFAULTS: AuroraSkinConfig = {
  enabled: true,
  backgroundUrl: '',
  opacity: 0.8,
  blur: 0,
  mediaType: 'image',
  muted: true,
}

/** 路由前缀（与皮肤中心卡片一致）。 */
export const AURORA_API_PREFIX = '/api/skin-aurora'

/** 配置文件路径：DSH_HOME/skin-aurora.json（与 pet.json 同模式）。 */
function configPath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skin-aurora.json')
}

/** 本地媒体目录：DSH_HOME/skin-aurora-media。 */
function mediaDir(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skin-aurora-media')
}

/** MIME → 扩展名。 */
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'video/x-m4v': '.m4v',
  }
  return map[mime.toLowerCase()] ?? ''
}

/** 扩展名 → MIME。 */
function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}

/** 读取配置（文件缺失或损坏时回退默认值）。 */
function readConfig(): AuroraSkinConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<AuroraSkinConfig>
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.enabled,
      backgroundUrl: typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl : DEFAULTS.backgroundUrl,
      opacity: typeof raw.opacity === 'number' ? raw.opacity : DEFAULTS.opacity,
      blur: typeof raw.blur === 'number' ? raw.blur : DEFAULTS.blur,
      mediaType: raw.mediaType === 'video' ? 'video' : 'image',
      muted: typeof raw.muted === 'boolean' ? raw.muted : DEFAULTS.muted,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      total += chunk.length
      // 本地媒体上传（视频可能较大）：允许到 200MB。
      if (total > 200_000_000) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** 请求分发：GET/PUT /api/skin-aurora/config, POST upload, GET media。 */
function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  const pathname = url.pathname

  // 本地媒体上传：body = 原始文件二进制，文件名放 X-File-Name 头。
  if (pathname === `${AURORA_API_PREFIX}/upload` && req.method === 'POST') {
    void readBody(req)
      .then((buf) => {
        if (buf.length === 0) {
          sendJson(res, 400, { ok: false, error: 'empty body' })
          return
        }
        const nameRaw = req.headers['x-file-name'] ?? ''
        let name = ''
        try { name = decodeURIComponent(String(nameRaw)) } catch { name = String(nameRaw) }
        const ext = name ? extname(name).toLowerCase() : ''
        if (ext === '') {
          sendJson(res, 400, { ok: false, error: 'unknown media type (missing file extension)' })
          return
        }
        const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16)
        const dir = mediaDir()
        mkdirSync(dir, { recursive: true })
        const filename = `${hash}${ext}`
        writeFileSync(join(dir, filename), buf)
        sendJson(res, 200, { ok: true, url: `${AURORA_API_PREFIX}/media/${filename}`, filename })
      })
      .catch((e) => sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }))
    return
  }

  // 本地媒体静态服务：GET /api/skin-aurora/media/<file>。
  // 支持 HTTP Range（视频流式播放）：浏览器请求视频时带 Range 头，必须
  // 返回 206 Partial Content，否则整个视频要下完才能播、进度条拖不动。
  if (pathname.startsWith(`${AURORA_API_PREFIX}/media/`) && req.method === 'GET') {
    const filename = pathname.slice(`${AURORA_API_PREFIX}/media/`.length)
    // 防路径穿越：只允许文件名（不含斜杠）。
    if (filename === '' || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      sendJson(res, 400, { ok: false, error: 'invalid filename' })
      return
    }
    const filePath = join(mediaDir(), filename)
    try {
      const mime = mimeFromExt(extname(filename))
      const stat = statSync(filePath)
      const total = stat.size
      const base = {
        'content-type': mime,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=31536000, immutable',
      }
      // Range: bytes=start-end / bytes=start- / bytes=-suffix。
      const range = req.headers.range
      const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range) : null
      if (match !== null) {
        const start = match[1] === '' ? 0 : Number.parseInt(match[1], 10)
        let end = match[2] === '' ? total - 1 : Number.parseInt(match[2], 10)
        if (Number.isNaN(start) || Number.isNaN(end)) {
          res.writeHead(416, { 'content-range': `bytes */${total}` })
          res.end()
          return
        }
        if (end >= total) end = total - 1
        if (start > end || start >= total) {
          res.writeHead(416, { 'content-range': `bytes */${total}` })
          res.end()
          return
        }
        const length = end - start + 1
        res.writeHead(206, {
          ...base,
          'content-range': `bytes ${start}-${end}/${total}`,
          'content-length': length,
        })
        createReadStream(filePath, { start, end }).pipe(res)
        return
      }
      // 无 Range：全量返回（图片/动图走这里）。
      res.writeHead(200, { ...base, 'content-length': total })
      createReadStream(filePath).pipe(res)
    } catch {
      sendJson(res, 404, { ok: false, error: 'not found' })
    }
    return
  }

  if (pathname === `${AURORA_API_PREFIX}/config` && req.method === 'GET') {
    sendJson(res, 200, { ok: true, config: readConfig() })
    return
  }
  if (url.pathname === `${AURORA_API_PREFIX}/config` && req.method === 'PUT') {
    void readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body.toString('utf8')) as Partial<AuroraSkinConfig>
        const next: AuroraSkinConfig = {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
          backgroundUrl: typeof parsed.backgroundUrl === 'string' ? parsed.backgroundUrl : DEFAULTS.backgroundUrl,
          opacity: typeof parsed.opacity === 'number' ? parsed.opacity : DEFAULTS.opacity,
          blur: typeof parsed.blur === 'number' ? parsed.blur : DEFAULTS.blur,
          mediaType: parsed.mediaType === 'video' ? 'video' : 'image',
          muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULTS.muted,
        }
        writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
        sendJson(res, 200, { ok: true, config: next })
      })
      .catch((e) => sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }))
    return
  }
  sendJson(res, 404, { ok: false, error: 'not found' })
}

/** 宿主插件体：注册配置路由（无 webServer 服务时为空操作）。 */
export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (httpCtx) => {
    const dispose = httpCtx.webServer.register({ kind: 'prefix', path: AURORA_API_PREFIX, handler: handle })
    httpCtx.effect(() => dispose, 'ui-skin-aurora: config route')
  })
}
