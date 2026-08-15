window.__ModuleLoader__.load({
	id: "@captain1275/dsh-full-stats",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\dsh-full-stats\src\client\card.module.css.mjs
		const css = ".GIDN6W_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:8px;list-style:none;transition:border-color .16s,background .16s;overflow:hidden}.GIDN6W_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.GIDN6W_header{cursor:pointer;text-align:left;width:100%;font:inherit;background:0 0;border:0;align-items:center;gap:8px;padding:10px 14px;transition:background .12s;display:flex}.GIDN6W_header:hover{background:var(--dsw-alias-interactive-bg-hover)}.GIDN6W_header:active{background:var(--dsw-alias-interactive-bg-hover-solid)}.GIDN6W_header:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-button-info-fill);outline:none}.GIDN6W_headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.GIDN6W_name{color:var(--dsw-alias-label-primary);font-weight:600}.GIDN6W_description{color:var(--dsw-alias-label-tertiary);font-size:12px}.GIDN6W_chevron{color:var(--dsw-alias-label-tertiary);transition:transform .12s}.GIDN6W_chevronOpen{transform:rotate(180deg)}.GIDN6W_body{flex-direction:column;gap:12px;padding:0 14px 14px;display:flex}.GIDN6W_desc{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.6}.GIDN6W_field{flex-direction:column;gap:3px;display:flex}.GIDN6W_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px}.GIDN6W_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:5px 8px;font-size:13px}.GIDN6W_input::placeholder{color:var(--dsw-alias-label-tertiary)}.GIDN6W_actions{align-items:center;gap:10px;display:flex}.GIDN6W_saveBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:4px 12px;font-size:12px}.GIDN6W_saveBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.GIDN6W_saveBtn:disabled{opacity:.6;cursor:default}.GIDN6W_savedHint{color:var(--dsw-alias-state-success-primary);font-size:12px}";
		const tagId = "@captain1275/dsh-full-stats/card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-full-stats";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var card_module_css_default = {
			"actions": "GIDN6W_actions",
			"body": "GIDN6W_body",
			"card": "GIDN6W_card",
			"cardOpen": "GIDN6W_cardOpen",
			"chevron": "GIDN6W_chevron",
			"chevronOpen": "GIDN6W_chevronOpen",
			"desc": "GIDN6W_desc",
			"description": "GIDN6W_description",
			"field": "GIDN6W_field",
			"fieldLabel": "GIDN6W_fieldLabel",
			"headText": "GIDN6W_headText",
			"header": "GIDN6W_header",
			"input": "GIDN6W_input",
			"name": "GIDN6W_name",
			"saveBtn": "GIDN6W_saveBtn",
			"savedHint": "GIDN6W_savedHint"
		};
		//#endregion
		//#region src/client/FullStatsSettingsCard.tsx
		/**
		* dsh-full-stats 配置卡片：注册进 WebUI 插件组（web-ui.plugin.item）。
		* 可折叠卡片：点击头部展开/收起配置区。用户可自定义「工作中 / 完成时」状态
		* 文本；保存经宿主路由 /api/full-stats/config 持久化（~/.dsh/full-stats.json），
		* 并派发 dshc-full-stats-config 事件让统计行即时刷新。
		*/
		const DEFAULTS = {
			thinkingText: "",
			workingText: "",
			doneText: ""
		};
		/** 配置变更事件（统计行监听刷新）。 */
		const FULL_STATS_EVENT = "dshc-full-stats-config";
		/** 解析一个模块类名。 */
		const cls = (name) => card_module_css_default[name] ?? "";
		async function fetchConfig() {
			try {
				const data = await (await fetch("/api/full-stats/config")).json();
				if (data?.ok === true && data.config !== void 0) return {
					thinkingText: typeof data.config.thinkingText === "string" ? data.config.thinkingText : DEFAULTS.thinkingText,
					workingText: typeof data.config.workingText === "string" ? data.config.workingText : DEFAULTS.workingText,
					doneText: typeof data.config.doneText === "string" ? data.config.doneText : DEFAULTS.doneText
				};
			} catch {}
			return { ...DEFAULTS };
		}
		async function writeConfig(next) {
			try {
				return (await (await fetch("/api/full-stats/config", {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(next)
				})).json())?.ok === true;
			} catch {
				return false;
			}
		}
		/** WebUI 插件组中的可折叠配置卡片。 */
		function FullStatsSettingsCard() {
			const [cfg, setCfg] = (0, react.useState)(DEFAULTS);
			const [open, setOpen] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let alive = true;
				fetchConfig().then((c) => {
					if (alive) setCfg(c);
				});
				return () => {
					alive = false;
				};
			}, []);
			const save = async () => {
				setSaving(true);
				setSaved(false);
				const ok = await writeConfig(cfg);
				setSaving(false);
				if (ok) {
					setSaved(true);
					window.dispatchEvent(new Event(FULL_STATS_EVENT));
					window.setTimeout(() => setSaved(false), 1500);
				} else window.alert("配置保存失败");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `${cls("card")}${open ? ` ${cls("cardOpen")}` : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: cls("header"),
					"aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}: 完整统计行（状态文本）`,
					onClick: () => {
						setOpen((current) => !current);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: cls("headText"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cls("name"),
							children: "完整统计行（状态文本）"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cls("description"),
							children: "自定义状态文本与完整统计（轮/步/耗时/缓存/token）"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: open ? cls("chevronOpen") : cls("chevron"),
						children: "▾"
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: cls("body"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: cls("desc"),
							children: "自定义状态文本：思考中（替换官方 Deep diving...）、工作中、完成时； 留空则显示原始内容。完整统计（轮/步/耗时/缓存/token）始终保留。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: cls("field"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cls("fieldLabel"),
								children: "思考中状态文本（替换 Deep diving...）"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: cls("input"),
								value: cfg.thinkingText,
								placeholder: "例如：DeepSleep",
								onChange: (e) => setCfg({
									...cfg,
									thinkingText: e.target.value
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: cls("field"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cls("fieldLabel"),
								children: "工作中状态文本"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: cls("input"),
								value: cfg.workingText,
								placeholder: "例如：大肥鱼正在吃白饭",
								onChange: (e) => setCfg({
									...cfg,
									workingText: e.target.value
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: cls("field"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cls("fieldLabel"),
								children: "完成时状态文本"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: cls("input"),
								value: cfg.doneText,
								placeholder: "例如：大肥鱼吃饱了",
								onChange: (e) => setCfg({
									...cfg,
									doneText: e.target.value
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: cls("actions"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cls("saveBtn"),
								disabled: saving,
								onClick: () => void save(),
								children: saving ? "保存中…" : "保存"
							}), saved && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cls("savedHint"),
								children: "已保存"
							})]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* dsh-full-stats —— 浏览器半区。
		*
		* 覆盖官方「会话统计行」（conversation.composer.dock 的 id=stats，本包以同 id
		* 更低 priority 顶替）：
		*  - 不省略：整行可换行展示（官方是 white-space:nowrap + ellipsis 截断）；
		*  - 加运行状态：行首状态点，会话运行中为琥珀色、空闲为绿色；
		*  - 自定义状态文本：WebUI 插件管理卡片配置「工作中/完成时」文本（经宿主
		*    /api/full-stats/config 持久化），配置后按状态显示对应文字；
		*  - 数据与官方同源：sessionStats 投影（轮/步/耗时/首 token/速度）+ tokenUsage
		*    投影（缓存命中/输入输出 token）。
		*/
		/** 需要的客户端服务：插槽（覆盖注册 + 配置卡片）。 */
		const inject = ["slots"];
		/** 插槽与覆盖目标 id（官方 StatsLine 的注册 id）。 */
		const DOCK = "conversation.composer.dock";
		const STATS_ID = "stats";
		const PLUGIN_ITEM = "web-ui.plugin.item";
		let cachedConfig = {
			thinkingText: "",
			workingText: "",
			doneText: ""
		};
		/** 从宿主路由拉取配置（失败沿用缓存）。 */
		async function refreshConfig() {
			try {
				const data = await (await fetch("/api/full-stats/config")).json();
				if (data?.ok === true && data.config !== void 0) cachedConfig = {
					thinkingText: typeof data.config.thinkingText === "string" ? data.config.thinkingText : "",
					workingText: typeof data.config.workingText === "string" ? data.config.workingText : "",
					doneText: typeof data.config.doneText === "string" ? data.config.doneText : ""
				};
			} catch {}
		}
		/** 官方「思考中」占位文本（ChatView 硬编码，无可字典化文案）。 */
		const OFFICIAL_THINKING_TEXT = "Deep diving...";
		/**
		* 替换官方「Deep diving...」状态文本。ChatView 将思考中文本硬编码为内联
		* JSX（role=status + turnStatus 类），无法通过官方配置修改；这里用
		* MutationObserver 监听会话区，出现官方占位文本且用户配置了 thinkingText
		* 时原位替换（保留时钟 span）。配置为空或文本已非官方占位时不动。
		*/
		function mountThinkingTextReplacer() {
			const apply = () => {
				if (cachedConfig.thinkingText === "") return;
				document.querySelectorAll("[class*=\"turnStatus\"]").forEach((el) => {
					const textNode = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.includes(OFFICIAL_THINKING_TEXT));
					if (textNode !== void 0) textNode.textContent = cachedConfig.thinkingText;
				});
			};
			apply();
			const observer = new MutationObserver(apply);
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			return () => observer.disconnect();
		}
		function formatDuration(ms) {
			const s = ms / 1e3;
			if (s < 60) return `${Math.round(s * 10) / 10}s`;
			const whole = Math.round(s);
			return `${Math.floor(whole / 60)}m${whole % 60}s`;
		}
		function formatTokens(n) {
			if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
			if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
			return String(n);
		}
		function formatTokensPerSecond(rate) {
			if (!Number.isFinite(rate)) return "0";
			return rate < 100 ? String(Math.round(rate * 10) / 10) : String(Math.round(rate));
		}
		function billedInputTokens(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}
		function cacheHitPercent(usage) {
			const denominator = billedInputTokens(usage);
			return denominator === 0 ? null : Math.round(usage.cacheReadTokens / denominator * 100);
		}
		/** 完整统计行组件（会话级插槽组件，框架注入 useSession/useProjection）。 */
		const FullStatsLine = (0, react.memo)(function FullStatsLine(props) {
			const { useSession, useProjection } = props;
			const session = useSession((s) => ({
				running: s.running,
				blank: s.blank === true
			}));
			const usage = useProjection("tokenUsage");
			const stats = useProjection("sessionStats");
			const groups = [];
			if (stats !== void 0 && stats.steps > 0) {
				groups.push(`${stats.turns} 轮 · ${stats.steps} 步`);
				const durations = [];
				if (stats.llmMs > 0) durations.push(`LLM ${formatDuration(stats.llmMs)}`);
				if (stats.toolMs > 0) durations.push(`工具调用 ${formatDuration(stats.toolMs)}`);
				if (durations.length > 0) groups.push(durations.join(" · "));
				const speeds = [];
				if (stats.ttftSteps > 0) speeds.push(`首 token 平均 ${formatDuration(stats.ttftMs / stats.ttftSteps)}`);
				if (stats.decodeMs > 0) speeds.push(`${formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3))} tok/s`);
				if (speeds.length > 0) groups.push(speeds.join(" · "));
			}
			if (usage !== void 0 && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
				const cacheHit = cacheHitPercent(usage);
				if (cacheHit !== null) groups.push(`缓存命中 ${cacheHit}%`);
				groups.push(`输入 ${formatTokens(billedInputTokens(usage))} tok · 输出 ${formatTokens(usage.outputTokens)} tok`);
			}
			const statsLine = groups.join(" | ");
			if (session.running && cachedConfig.workingText !== "") return renderLine(true, statsLine === "" ? cachedConfig.workingText : `${cachedConfig.workingText} | ${statsLine}`);
			if (!session.running && !session.blank && cachedConfig.doneText !== "") return renderLine(false, statsLine === "" ? cachedConfig.doneText : `${cachedConfig.doneText} | ${statsLine}`);
			if (statsLine === "" && !session.running) return null;
			return renderLine(session.running, statsLine);
		});
		/** 渲染一行：状态点 + 文本。 */
		function renderLine(running, text) {
			return (0, react.createElement)("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "2px 12px 6px",
				fontSize: 11,
				lineHeight: "16px",
				color: "var(--dsw-alias-label-tertiary, #888)",
				fontVariantNumeric: "tabular-nums",
				userSelect: "none",
				whiteSpace: "normal",
				overflow: "visible"
			} }, (0, react.createElement)("span", {
				"aria-hidden": true,
				title: running ? "会话运行中" : "会话空闲",
				style: {
					flex: "none",
					width: 8,
					height: 8,
					borderRadius: "50%",
					background: running ? "#f59e0b" : "#4ade80",
					boxShadow: running ? "0 0 6px rgba(245,158,11,0.8)" : "none",
					transition: "background 0.15s, box-shadow 0.15s"
				}
			}), (0, react.createElement)("span", { style: {
				whiteSpace: "normal",
				overflow: "visible"
			} }, text));
		}
		/** 浏览器插件体：覆盖官方统计行 + 注册 WebUI 配置卡片。 */
		function apply(ctx) {
			refreshConfig();
			const onConfig = () => {
				refreshConfig();
			};
			window.addEventListener(FULL_STATS_EVENT, onConfig);
			ctx.effect(() => () => window.removeEventListener(FULL_STATS_EVENT, onConfig), "ui-full-stats: config listener");
			ctx.effect(() => mountThinkingTextReplacer(), "ui-full-stats: thinking text replacer");
			ctx.slots.inject(DOCK, () => ctx.slots.register({
				name: DOCK,
				id: STATS_ID,
				order: 0,
				priority: -1
			}, FullStatsLine));
			ctx.slots.inject(PLUGIN_ITEM, () => ctx.slots.register({
				name: PLUGIN_ITEM,
				id: "full-stats",
				order: 120
			}, FullStatsSettingsCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map