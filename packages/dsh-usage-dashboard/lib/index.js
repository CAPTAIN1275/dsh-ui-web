import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, networkInterfaces } from "node:os";
//#region src/cost.ts
/** DeepSeek 官方定价（2026-08，元/百万 token，来源 api-docs.deepseek.com/quick_start/pricing）。 */
/** deepseek-v4-flash：缓存命中 0.02 / 缓存未命中 1 / 输出 2。 */
const DEEPSEEK_FLASH_RATES = {
	inputPerM: 1,
	outputPerM: 2,
	cachePerM: .02
};
/** deepseek-v4-pro：缓存命中 0.025 / 缓存未命中 3 / 输出 6。 */
const DEEPSEEK_RATES = {
	inputPerM: 3,
	outputPerM: 6,
	cachePerM: .025
};
/** 旧 deepseek-chat / reasoner 定价参考（2025，元/百万 token）。 */
const DEEPSEEK_LEGACY_RATES = {
	inputPerM: 2,
	outputPerM: 8,
	cachePerM: .5
};
const DEEPSEEK_REASONER_RATES = {
	inputPerM: 4,
	outputPerM: 16,
	cachePerM: 1
};
/** 未知模型回退通用档。 */
const GENERIC_RATES = {
	inputPerM: 1,
	outputPerM: 2,
	cachePerM: .02
};
/**
* 按模型名取单价。
* - 含 "flash" → v4-flash 档（0.02 / 1 / 2）
* - 含 "reasoner"/"r1" → 推理档
* - 含 "v4-pro"/"pro" → v4-pro 档
* - 含 "deepseek" → 旧标准档
* - 其余回退通用档
* @param model - 模型标识（如 deepseek/deepseek-chat）。
* @returns 单价。
*/
function ratesForModel(model) {
	const m = model.toLowerCase();
	if (m.includes("flash")) return DEEPSEEK_FLASH_RATES;
	if (m.includes("reasoner") || m.includes("/r1") || m.includes("-r1")) return DEEPSEEK_REASONER_RATES;
	if (m.includes("pro") || m.includes("v4-pro")) return DEEPSEEK_RATES;
	if (m.includes("deepseek")) return DEEPSEEK_LEGACY_RATES;
	return GENERIC_RATES;
}
/**
* 估算一次用量的费用（元）。
* @param model - 模型标识。
* @param inputTokens - 输入 token（不含缓存）。
* @param outputTokens - 输出 token。
* @param cacheReadTokens - 缓存命中 token。
* @param rates - 可选单价覆盖（测试用）。
* @returns 估算费用（元，保留 4 位）。
*/
function estimateCost(model, inputTokens, outputTokens, cacheReadTokens, rates = ratesForModel(model)) {
	const input = inputTokens / 1e6 * rates.inputPerM;
	const output = outputTokens / 1e6 * rates.outputPerM;
	const cache = cacheReadTokens / 1e6 * rates.cachePerM;
	return Math.round((input + output + cache) * 1e4) / 1e4;
}
//#endregion
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
/** 把一条记录并入聚合（replace 语义：同会话以最新快照覆盖，避免双计）。 */
function applyRecord(store, record) {
	const sessionId = record.sessionId || "default";
	const existing = store.bySession[sessionId];
	const prevInput = existing?.inputTokens ?? 0;
	const prevOutput = existing?.outputTokens ?? 0;
	const prevCache = existing?.cacheReadTokens ?? 0;
	const session = {
		title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
		lastModel: record.model || existing?.lastModel || "unknown",
		lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
		inputTokens: record.inputTokens,
		outputTokens: record.outputTokens,
		cacheReadTokens: record.cacheReadTokens,
		calls: (existing?.calls ?? 0) + 1
	};
	store.bySession[sessionId] = session;
	const dInput = Math.max(0, record.inputTokens - prevInput);
	const dOutput = Math.max(0, record.outputTokens - prevOutput);
	const dCache = Math.max(0, record.cacheReadTokens - prevCache);
	if (dInput + dOutput + dCache <= 0) return;
	const day = dayKey(record.ts);
	const dayBucket = store.byDay[day] ?? {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		calls: 0
	};
	dayBucket.inputTokens += dInput;
	dayBucket.outputTokens += dOutput;
	dayBucket.cacheReadTokens += dCache;
	dayBucket.calls += 1;
	store.byDay[day] = dayBucket;
	const model = record.model || "unknown";
	const modelBucket = store.byModel[model] ?? {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		calls: 0
	};
	modelBucket.inputTokens += dInput;
	modelBucket.outputTokens += dOutput;
	modelBucket.cacheReadTokens += dCache;
	modelBucket.calls += 1;
	store.byModel[model] = modelBucket;
	store.total.inputTokens += dInput;
	store.total.outputTokens += dOutput;
	store.total.cacheReadTokens += dCache;
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
	if (url.pathname === `/api/usage/lan` && req.method === "GET") {
		const rank = (ip) => {
			if (ip.startsWith("192.168.")) return 0;
			if (ip.startsWith("10.")) return 1;
			if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
			return 3;
		};
		sendJson(res, 200, {
			ok: true,
			addresses: Object.values(networkInterfaces()).flat().filter((iface) => iface !== void 0 && iface.family === "IPv4" && !iface.internal).map((iface) => iface.address).sort((a, b) => rank(a) - rank(b))
		});
		return;
	}
	if (url.pathname === `/api/usage/summary` && req.method === "GET") {
		const store = readUsage();
		const modelCosts = Object.fromEntries(Object.entries(store.byModel).map(([model, b]) => [model, estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens)]));
		const totalCost = Object.values(modelCosts).reduce((a, b) => a + b, 0);
		const sessions = sessionRanking(store, 20).map((s) => ({
			...s,
			cost: estimateCost(s.model, store.bySession[s.id]?.inputTokens ?? 0, store.bySession[s.id]?.outputTokens ?? 0, store.bySession[s.id]?.cacheReadTokens ?? 0)
		}));
		sendJson(res, 200, {
			ok: true,
			total: store.total,
			byModel: store.byModel,
			recent: recentDays(store, 14),
			sessions,
			byDayCount: Object.keys(store.byDay).length,
			cost: {
				total: Math.round(totalCost * 100) / 100,
				byModel: modelCosts
			}
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
