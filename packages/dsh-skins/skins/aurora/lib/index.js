import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-skin-aurora";
const DEFAULTS = {
	enabled: true,
	backgroundUrl: "",
	opacity: .8,
	blur: 0
};
/** 路由前缀（与皮肤中心卡片一致）。 */
const AURORA_API_PREFIX = "/api/skin-aurora";
/** 配置文件路径：DSH_HOME/skin-aurora.json（与 pet.json 同模式）。 */
function configPath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "skin-aurora.json");
}
/** 读取配置（文件缺失或损坏时回退默认值）。 */
function readConfig() {
	try {
		const raw = JSON.parse(readFileSync(configPath(), "utf8"));
		return {
			enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULTS.enabled,
			backgroundUrl: typeof raw.backgroundUrl === "string" ? raw.backgroundUrl : DEFAULTS.backgroundUrl,
			opacity: typeof raw.opacity === "number" ? raw.opacity : DEFAULTS.opacity,
			blur: typeof raw.blur === "number" ? raw.blur : DEFAULTS.blur
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
		let body = "";
		req.on("data", (chunk) => {
			body += chunk.toString("utf8");
			if (body.length > 2e6) {
				reject(/* @__PURE__ */ new Error("body too large"));
				req.destroy();
			}
		});
		req.on("end", () => resolveBody(body));
		req.on("error", reject);
	});
}
/** 请求分发：GET/PUT /api/skin-aurora/config。 */
function handle(req, res) {
	const url = new URL(req.url ?? "/", "http://dsh.local");
	if (url.pathname === `/api/skin-aurora/config` && req.method === "GET") {
		sendJson(res, 200, {
			ok: true,
			config: readConfig()
		});
		return;
	}
	if (url.pathname === `/api/skin-aurora/config` && req.method === "PUT") {
		readBody(req).then((body) => {
			const parsed = JSON.parse(body);
			const next = {
				enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
				backgroundUrl: typeof parsed.backgroundUrl === "string" ? parsed.backgroundUrl : DEFAULTS.backgroundUrl,
				opacity: typeof parsed.opacity === "number" ? parsed.opacity : DEFAULTS.opacity,
				blur: typeof parsed.blur === "number" ? parsed.blur : DEFAULTS.blur
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
