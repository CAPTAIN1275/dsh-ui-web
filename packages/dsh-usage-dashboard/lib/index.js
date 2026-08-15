import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-usage-dashboard";
/** 路由前缀。 */
const USAGE_API_PREFIX = "/api/usage";
/** 一天内的毫秒数。 */
const DAY_MS = 1440 * 60 * 1e3;
/** 空聚合。 */
function emptyUsage() {
	return {
		bySession: {},
		byDay: {},
		byModel: {},
		total: {
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			calls: 0
		}
	};
}
/** 配置文件路径：$DSH_HOME/usage.json。 */
function usagePath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "usage.json");
}
/** 日期键（本地时区）。 */
function dayKey(ts) {
	const d = new Date(ts);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
/** 读取聚合数据（缺失/损坏时回退空）。 */
function readUsage() {
	try {
		const raw = JSON.parse(readFileSync(usagePath(), "utf8"));
		if (typeof raw !== "object" || raw === null) return emptyUsage();
		return {
			bySession: raw.bySession ?? {},
			byDay: raw.byDay ?? {},
			byModel: raw.byModel ?? {},
			total: raw.total ?? {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				calls: 0
			}
		};
	} catch {
		return emptyUsage();
	}
}
/** 写入聚合数据（失败静默，不影响主流程）。 */
function writeUsage(store) {
	try {
		writeFileSync(usagePath(), JSON.stringify(store, null, 2), "utf8");
	} catch {}
}
/** 把一条记录并入聚合。 */
function applyRecord(store, record) {
	const day = dayKey(record.ts);
	const sessionId = record.sessionId || "default";
	const session = store.bySession[sessionId] ?? {
		title: record.sessionTitle || "未命名会话",
		lastModel: record.model,
		lastTs: record.ts,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		calls: 0
	};
	session.title = record.sessionTitle || session.title;
	session.lastModel = record.model || session.lastModel;
	session.lastTs = Math.max(session.lastTs, record.ts);
	session.inputTokens += record.inputTokens;
	session.outputTokens += record.outputTokens;
	session.cacheReadTokens += record.cacheReadTokens;
	session.calls += 1;
	store.bySession[sessionId] = session;
	const dayBucket = store.byDay[day] ?? {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		calls: 0
	};
	dayBucket.inputTokens += record.inputTokens;
	dayBucket.outputTokens += record.outputTokens;
	dayBucket.cacheReadTokens += record.cacheReadTokens;
	dayBucket.calls += 1;
	store.byDay[day] = dayBucket;
	const model = record.model || "unknown";
	const modelBucket = store.byModel[model] ?? {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		calls: 0
	};
	modelBucket.inputTokens += record.inputTokens;
	modelBucket.outputTokens += record.outputTokens;
	modelBucket.cacheReadTokens += record.cacheReadTokens;
	modelBucket.calls += 1;
	store.byModel[model] = modelBucket;
	store.total.inputTokens += record.inputTokens;
	store.total.outputTokens += record.outputTokens;
	store.total.cacheReadTokens += record.cacheReadTokens;
	store.total.calls += 1;
}
/** 最近 N 天的按天序列（缺失日补零，便于画图）。 */
function recentDays(store, days) {
	const out = [];
	const now = Date.now();
	for (let offset = days - 1; offset >= 0; offset--) {
		const key = dayKey(now - offset * DAY_MS);
		const bucket = store.byDay[key];
		out.push({
			day: key,
			inputTokens: bucket?.inputTokens ?? 0,
			outputTokens: bucket?.outputTokens ?? 0,
			calls: bucket?.calls ?? 0
		});
	}
	return out;
}
/** 会话排行（按总 token 降序）。 */
function sessionRanking(store, limit) {
	return Object.entries(store.bySession).map(([id, s]) => ({
		id,
		title: s.title,
		model: s.lastModel,
		lastTs: s.lastTs,
		totalTokens: s.inputTokens + s.outputTokens + s.cacheReadTokens,
		calls: s.calls
	})).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, limit);
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
			if (body.length > 1e6) {
				reject(/* @__PURE__ */ new Error("body too large"));
				req.destroy();
			}
		});
		req.on("end", () => resolveBody(body));
		req.on("error", reject);
	});
}
/** 规范化上报载荷。 */
function normalizeRecord(raw) {
	const inputTokens = typeof raw.inputTokens === "number" && Number.isFinite(raw.inputTokens) ? Math.max(0, Math.round(raw.inputTokens)) : 0;
	const outputTokens = typeof raw.outputTokens === "number" && Number.isFinite(raw.outputTokens) ? Math.max(0, Math.round(raw.outputTokens)) : 0;
	const cacheReadTokens = typeof raw.cacheReadTokens === "number" && Number.isFinite(raw.cacheReadTokens) ? Math.max(0, Math.round(raw.cacheReadTokens)) : 0;
	if (inputTokens + outputTokens + cacheReadTokens <= 0) return void 0;
	return {
		sessionId: typeof raw.sessionId === "string" ? raw.sessionId : "default",
		sessionTitle: typeof raw.sessionTitle === "string" ? raw.sessionTitle : "",
		model: typeof raw.model === "string" ? raw.model : "unknown",
		ts: typeof raw.ts === "number" ? raw.ts : Date.now(),
		inputTokens,
		outputTokens,
		cacheReadTokens
	};
}
/** 请求分发：POST /api/usage/record, GET /api/usage/summary。 */
function handle(req, res) {
	const url = new URL(req.url ?? "/", "http://dsh.local");
	if (url.pathname === `/api/usage/record` && req.method === "POST") {
		readBody(req).then((body) => {
			const record = normalizeRecord(JSON.parse(body));
			if (record === void 0) {
				sendJson(res, 200, {
					ok: true,
					skipped: true
				});
				return;
			}
			const store = readUsage();
			applyRecord(store, record);
			writeUsage(store);
			sendJson(res, 200, {
				ok: true,
				skipped: false
			});
		}).catch((e) => sendJson(res, 400, {
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		}));
		return;
	}
	if (url.pathname === `/api/usage/summary` && req.method === "GET") {
		const store = readUsage();
		sendJson(res, 200, {
			ok: true,
			total: store.total,
			byModel: store.byModel,
			recent: recentDays(store, 14),
			sessions: sessionRanking(store, 20),
			byDayCount: Object.keys(store.byDay).length
		});
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
			path: USAGE_API_PREFIX,
			handler: handle
		});
		httpCtx.effect(() => dispose, "ui-usage-dashboard: usage route");
	});
}
//#endregion
export { USAGE_API_PREFIX, apply, applyRecord, dayKey, emptyUsage, name, readUsage, recentDays, sessionRanking, usagePath, writeUsage };
