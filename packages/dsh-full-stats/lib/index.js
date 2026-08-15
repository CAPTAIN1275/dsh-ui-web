import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-full-stats";
const DEFAULTS = {
	thinkingText: "",
	workingText: "",
	doneText: ""
};
/** 路由前缀。 */
const FULL_STATS_API_PREFIX = "/api/full-stats";
/** 配置文件路径：$DSH_HOME/full-stats.json。 */
function configPath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "full-stats.json");
}
/** 读取配置（文件缺失/损坏时回退默认值）。 */
function readConfig() {
	try {
		const raw = JSON.parse(readFileSync(configPath(), "utf8"));
		return {
			thinkingText: typeof raw.thinkingText === "string" ? raw.thinkingText : DEFAULTS.thinkingText,
			workingText: typeof raw.workingText === "string" ? raw.workingText : DEFAULTS.workingText,
			doneText: typeof raw.doneText === "string" ? raw.doneText : DEFAULTS.doneText
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
			if (body.length > 1e5) {
				reject(/* @__PURE__ */ new Error("body too large"));
				req.destroy();
			}
		});
		req.on("end", () => resolveBody(body));
		req.on("error", reject);
	});
}
/** 请求分发：GET/PUT /api/full-stats/config。 */
function handle(req, res) {
	const url = new URL(req.url ?? "/", "http://dsh.local");
	if (url.pathname === `/api/full-stats/config` && req.method === "GET") {
		sendJson(res, 200, {
			ok: true,
			config: readConfig()
		});
		return;
	}
	if (url.pathname === `/api/full-stats/config` && req.method === "PUT") {
		readBody(req).then((body) => {
			const parsed = JSON.parse(body);
			const next = {
				thinkingText: typeof parsed.thinkingText === "string" ? parsed.thinkingText : DEFAULTS.thinkingText,
				workingText: typeof parsed.workingText === "string" ? parsed.workingText : DEFAULTS.workingText,
				doneText: typeof parsed.doneText === "string" ? parsed.doneText : DEFAULTS.doneText
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
			path: FULL_STATS_API_PREFIX,
			handler: handle
		});
		httpCtx.effect(() => dispose, "ui-full-stats: config route");
	});
}
//#endregion
export { FULL_STATS_API_PREFIX, apply, name, readConfig };
