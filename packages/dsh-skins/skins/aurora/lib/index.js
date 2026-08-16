import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { homedir } from "node:os";
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-skin-aurora";
const DEFAULTS = {
	enabled: true,
	backgroundUrl: "",
	opacity: .8,
	blur: 0,
	mediaType: "image",
	muted: true
};
/** 路由前缀（与皮肤中心卡片一致）。 */
const AURORA_API_PREFIX = "/api/skin-aurora";
/** 配置文件路径：DSH_HOME/skin-aurora.json（与 pet.json 同模式）。 */
function configPath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "skin-aurora.json");
}
/** 本地媒体目录：DSH_HOME/skin-aurora-media。 */
function mediaDir() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "skin-aurora-media");
}
/** 扩展名 → MIME。 */
function mimeFromExt(ext) {
	return {
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
		".mp4": "video/mp4",
		".webm": "video/webm",
		".ogv": "video/ogg",
		".mov": "video/quicktime",
		".m4v": "video/x-m4v"
	}[ext.toLowerCase()] ?? "application/octet-stream";
}
/** 读取配置（文件缺失或损坏时回退默认值）。 */
function readConfig() {
	try {
		const raw = JSON.parse(readFileSync(configPath(), "utf8"));
		return {
			enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULTS.enabled,
			backgroundUrl: typeof raw.backgroundUrl === "string" ? raw.backgroundUrl : DEFAULTS.backgroundUrl,
			opacity: typeof raw.opacity === "number" ? raw.opacity : DEFAULTS.opacity,
			blur: typeof raw.blur === "number" ? raw.blur : DEFAULTS.blur,
			mediaType: raw.mediaType === "video" ? "video" : "image",
			muted: typeof raw.muted === "boolean" ? raw.muted : DEFAULTS.muted
		};
	} catch {
		return { ...DEFAULTS };
	}
}
function sendJson(res, status, data) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(data));
}
function readBody(req) {
	return new Promise((resolveBody, reject) => {
		const chunks = [];
		let total = 0;
		req.on("data", (chunk) => {
			chunks.push(chunk);
			total += chunk.length;
			if (total > 2e8) {
				reject(/* @__PURE__ */ new Error("body too large"));
				req.destroy();
			}
		});
		req.on("end", () => resolveBody(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}
/** 请求分发：GET/PUT /api/skin-aurora/config, POST upload, GET media。 */
function handle(req, res) {
	const url = new URL(req.url ?? "/", "http://dsh.local");
	const pathname = url.pathname;
	if (pathname === `/api/skin-aurora/upload` && req.method === "POST") {
		readBody(req).then((buf) => {
			if (buf.length === 0) {
				sendJson(res, 400, {
					ok: false,
					error: "empty body"
				});
				return;
			}
			const nameRaw = req.headers["x-file-name"] ?? "";
			let name = "";
			try {
				name = decodeURIComponent(String(nameRaw));
			} catch {
				name = String(nameRaw);
			}
			const ext = name ? extname(name).toLowerCase() : "";
			if (ext === "") {
				sendJson(res, 400, {
					ok: false,
					error: "unknown media type (missing file extension)"
				});
				return;
			}
			const hash = createHash("sha1").update(buf).digest("hex").slice(0, 16);
			const dir = mediaDir();
			mkdirSync(dir, { recursive: true });
			const filename = `${hash}${ext}`;
			writeFileSync(join(dir, filename), buf);
			sendJson(res, 200, {
				ok: true,
				url: `${AURORA_API_PREFIX}/media/${filename}`,
				filename
			});
		}).catch((e) => sendJson(res, 400, {
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		}));
		return;
	}
	if (pathname.startsWith(`/api/skin-aurora/media/`) && req.method === "GET") {
		const filename = pathname.slice(`${AURORA_API_PREFIX}/media/`.length);
		if (filename === "" || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
			sendJson(res, 400, {
				ok: false,
				error: "invalid filename"
			});
			return;
		}
		const filePath = join(mediaDir(), filename);
		try {
			const mime = mimeFromExt(extname(filename));
			const total = statSync(filePath).size;
			const base = {
				"content-type": mime,
				"accept-ranges": "bytes",
				"cache-control": "public, max-age=31536000, immutable"
			};
			const range = req.headers.range;
			const match = typeof range === "string" ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
			if (match !== null) {
				const start = match[1] === "" ? 0 : Number.parseInt(match[1], 10);
				let end = match[2] === "" ? total - 1 : Number.parseInt(match[2], 10);
				if (Number.isNaN(start) || Number.isNaN(end)) {
					res.writeHead(416, { "content-range": `bytes */${total}` });
					res.end();
					return;
				}
				if (end >= total) end = total - 1;
				if (start > end || start >= total) {
					res.writeHead(416, { "content-range": `bytes */${total}` });
					res.end();
					return;
				}
				const length = end - start + 1;
				res.writeHead(206, {
					...base,
					"content-range": `bytes ${start}-${end}/${total}`,
					"content-length": length
				});
				createReadStream(filePath, {
					start,
					end
				}).pipe(res);
				return;
			}
			res.writeHead(200, {
				...base,
				"content-length": total
			});
			createReadStream(filePath).pipe(res);
		} catch {
			sendJson(res, 404, {
				ok: false,
				error: "not found"
			});
		}
		return;
	}
	if (pathname === `/api/skin-aurora/config` && req.method === "GET") {
		sendJson(res, 200, {
			ok: true,
			config: readConfig()
		});
		return;
	}
	if (url.pathname === `/api/skin-aurora/config` && req.method === "PUT") {
		readBody(req).then((body) => {
			const parsed = JSON.parse(body.toString("utf8"));
			const next = {
				enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
				backgroundUrl: typeof parsed.backgroundUrl === "string" ? parsed.backgroundUrl : DEFAULTS.backgroundUrl,
				opacity: typeof parsed.opacity === "number" ? parsed.opacity : DEFAULTS.opacity,
				blur: typeof parsed.blur === "number" ? parsed.blur : DEFAULTS.blur,
				mediaType: parsed.mediaType === "video" ? "video" : "image",
				muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULTS.muted
			};
			writeFileSync(configPath(), JSON.stringify(next, null, 2), "utf8");
			sendJson(res, 200, {
				ok: true,
				config: next
			});
		}).catch((e) => sendJson(res, 400, {
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		}));
		return;
	}
	sendJson(res, 404, {
		ok: false,
		error: "not found"
	});
}
/** 宿主插件体：注册配置路由（无 webServer 服务时为空操作）。 */
function apply(ctx) {
	ctx.inject(["webServer"], (httpCtx) => {
		const dispose = httpCtx.webServer.register({
			kind: "prefix",
			path: AURORA_API_PREFIX,
			handler: handle
		});
		httpCtx.effect(() => dispose, "ui-skin-aurora: config route");
	});
}
//#endregion
export { AURORA_API_PREFIX, apply, name };
