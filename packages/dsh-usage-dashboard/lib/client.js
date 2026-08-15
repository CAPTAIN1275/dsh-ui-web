window.__ModuleLoader__.load({
	id: "@captain1275/dsh-usage-dashboard",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\dsh-usage-dashboard\src\client\usage.module.css.mjs
		const css$2 = ".lkZm-a_overlay{z-index:2147483001;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.lkZm-a_mask{-webkit-backdrop-filter:blur(6px);background:#050814b8;position:absolute;inset:0}.lkZm-a_panel{z-index:1;box-sizing:border-box;color:#e6eaff;background:linear-gradient(165deg,#141a34f5,#0a0e1efa);border:1px solid #8ca0ff40;border-radius:20px;flex-direction:column;width:880px;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px);padding:22px 26px;font-size:13px;display:flex;position:relative;overflow:auto;box-shadow:0 18px 60px #0000008c,inset 0 1px #ffffff0f}.lkZm-a_header{justify-content:space-between;align-items:center;margin-bottom:16px;display:flex}.lkZm-a_title{background:linear-gradient(90deg,#f472b6,#fb923c,#facc15,#4ade80,#22d3ee,#818cf8);color:#0000;-webkit-background-clip:text;background-clip:text;margin:0;font-size:18px;font-weight:700}.lkZm-a_close{color:#b9c2e8;cursor:pointer;background:#8ca0ff1f;border:none;border-radius:8px;flex:none;justify-content:center;align-items:center;width:30px;height:30px;transition:background .12s,color .12s;display:inline-flex}.lkZm-a_close:hover{color:#fff;background:#8ca0ff3d}.lkZm-a_body{flex-direction:column;gap:18px;display:flex}.lkZm-a_statGrid{grid-template-columns:repeat(4,1fr);gap:12px;display:grid}.lkZm-a_statCard{border:1px solid;border-radius:14px;flex-direction:column;gap:3px;padding:14px 16px;display:flex}.lkZm-a_statValue{font-variant-numeric:tabular-nums;font-size:26px;font-weight:800;line-height:1.1}.lkZm-a_statLabel{color:#e6eaffd9;font-size:12px;font-weight:600}.lkZm-a_statSub{color:#e6eaff8c;font-size:11px}.lkZm-a_section{flex-direction:column;gap:6px;display:flex}.lkZm-a_sectionTitle{color:#e6eaff;font-size:13px;font-weight:700}.lkZm-a_sectionSub{color:#e6eaff80;font-size:11px}.lkZm-a_twoCol{grid-template-columns:1fr 1.2fr;align-items:start;gap:20px;display:grid}.lkZm-a_chart{width:100%;height:auto;margin-top:4px}.lkZm-a_axisLabel{fill:#e6eaff73;font-size:9px}.lkZm-a_donutWrap{align-items:center;gap:16px;display:flex}.lkZm-a_donut{flex:none;width:150px;height:150px}.lkZm-a_donutTotal{fill:#e6eaff;font-size:16px;font-weight:800}.lkZm-a_donutLabel{fill:#e6eaff80;font-size:9px}.lkZm-a_legend{flex-direction:column;gap:5px;min-width:0;display:flex}.lkZm-a_legendRow{align-items:center;gap:7px;font-size:11px;display:flex}.lkZm-a_legendDot{border-radius:3px;flex:none;width:9px;height:9px}.lkZm-a_legendName{text-overflow:ellipsis;white-space:nowrap;color:#e6eaffd9;flex:1;min-width:0;overflow:hidden}.lkZm-a_legendVal{font-variant-numeric:tabular-nums;color:#e6eaff99}.lkZm-a_sessionList{flex-direction:column;gap:9px;max-height:320px;display:flex;overflow:auto}.lkZm-a_sessionRow{align-items:center;gap:10px;display:flex}.lkZm-a_sessionRank{text-align:center;flex:none;width:20px;font-size:14px;font-weight:800}.lkZm-a_sessionInfo{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.lkZm-a_sessionName{color:#e6eaff;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;overflow:hidden}.lkZm-a_sessionMeta{color:#e6eaff80;font-size:10px}.lkZm-a_sessionBar{background:#8ca0ff1f;border-radius:999px;height:4px;margin-top:2px;overflow:hidden}.lkZm-a_sessionBarFill{border-radius:999px;height:100%;transition:width .4s}.lkZm-a_sessionTokens{font-variant-numeric:tabular-nums;color:#e6eaff;flex-direction:column;flex:none;align-items:flex-end;gap:2px;font-size:12px;font-weight:700;display:flex}.lkZm-a_sessionCost{color:#e6eaff8c;font-size:10px;font-weight:600}.lkZm-a_empty{flex-direction:column;align-items:center;gap:8px;padding:60px 0;display:flex}.lkZm-a_emptyTitle{color:#e6eaffbf;font-size:15px;font-weight:700}.lkZm-a_emptyHint{color:#e6eaff73;text-align:center;font-size:12px;line-height:1.6}.lkZm-a_error{color:#fca5a5;background:#f8717124;border:1px solid #f8717159;border-radius:10px;padding:10px 14px;font-size:12px}@media (width<=720px){.lkZm-a_panel{border-radius:0;width:100%;max-width:100vw;max-height:100vh;padding:16px}.lkZm-a_statGrid,.lkZm-a_twoCol{grid-template-columns:1fr}}";
		const tagId$2 = "@captain1275/dsh-usage-dashboard/usage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var usage_module_css_default = {
			"axisLabel": "lkZm-a_axisLabel",
			"body": "lkZm-a_body",
			"chart": "lkZm-a_chart",
			"close": "lkZm-a_close",
			"donut": "lkZm-a_donut",
			"donutLabel": "lkZm-a_donutLabel",
			"donutTotal": "lkZm-a_donutTotal",
			"donutWrap": "lkZm-a_donutWrap",
			"empty": "lkZm-a_empty",
			"emptyHint": "lkZm-a_emptyHint",
			"emptyTitle": "lkZm-a_emptyTitle",
			"error": "lkZm-a_error",
			"header": "lkZm-a_header",
			"legend": "lkZm-a_legend",
			"legendDot": "lkZm-a_legendDot",
			"legendName": "lkZm-a_legendName",
			"legendRow": "lkZm-a_legendRow",
			"legendVal": "lkZm-a_legendVal",
			"mask": "lkZm-a_mask",
			"overlay": "lkZm-a_overlay",
			"panel": "lkZm-a_panel",
			"section": "lkZm-a_section",
			"sectionSub": "lkZm-a_sectionSub",
			"sectionTitle": "lkZm-a_sectionTitle",
			"sessionBar": "lkZm-a_sessionBar",
			"sessionBarFill": "lkZm-a_sessionBarFill",
			"sessionCost": "lkZm-a_sessionCost",
			"sessionInfo": "lkZm-a_sessionInfo",
			"sessionList": "lkZm-a_sessionList",
			"sessionMeta": "lkZm-a_sessionMeta",
			"sessionName": "lkZm-a_sessionName",
			"sessionRank": "lkZm-a_sessionRank",
			"sessionRow": "lkZm-a_sessionRow",
			"sessionTokens": "lkZm-a_sessionTokens",
			"statCard": "lkZm-a_statCard",
			"statGrid": "lkZm-a_statGrid",
			"statLabel": "lkZm-a_statLabel",
			"statSub": "lkZm-a_statSub",
			"statValue": "lkZm-a_statValue",
			"title": "lkZm-a_title",
			"twoCol": "lkZm-a_twoCol"
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* dsh-usage-dashboard locale copy (zh source of truth, en mirror).
		* @module @captain1275/dsh-usage-dashboard/client/locales
		*/
		const NS = "usage-dashboard";
		const zh = {
			"usage.entry": "用量",
			"usage.title": "用量看板",
			"usage.total": "累计用量",
			"usage.today": "今日",
			"usage.calls": "调用",
			"usage.input": "输入",
			"usage.output": "输出",
			"usage.cache": "缓存",
			"usage.trend": "近 14 天趋势",
			"usage.trendDetail": "每日 token 消耗（输入 + 输出 + 缓存）",
			"usage.sessions": "会话排行",
			"usage.models": "模型分布",
			"usage.tokens": "token",
			"usage.close": "关闭用量看板",
			"usage.empty": "暂无用量数据",
			"usage.noData": "使用 DSH 对话后，这里会显示详细用量统计。",
			"usage.settingsTitle": "用量看板",
			"usage.settingsHint": "记录每次响应的 token 用量并展示彩色统计看板。"
		};
		const en = {
			"usage.entry": "Usage",
			"usage.title": "Usage Dashboard",
			"usage.total": "Total usage",
			"usage.today": "Today",
			"usage.calls": "calls",
			"usage.input": "Input",
			"usage.output": "Output",
			"usage.cache": "Cache",
			"usage.trend": "Last 14 days",
			"usage.trendDetail": "Daily token usage (input + output + cache)",
			"usage.sessions": "Top sessions",
			"usage.models": "Model distribution",
			"usage.tokens": "tokens",
			"usage.close": "Close usage dashboard",
			"usage.empty": "No usage data yet",
			"usage.noData": "Start chatting with DSH and detailed usage stats will appear here.",
			"usage.settingsTitle": "Usage dashboard",
			"usage.settingsHint": "Records per-response token usage and renders a colorful stats dashboard."
		};
		/** Translate helper bound to the usage namespace (component-local). */
		function t(key, params) {
			let text = (typeof document !== "undefined" && document.documentElement.lang === "en" ? en : zh)[key] ?? key;
			for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region src/client/DashboardPanel.tsx
		/**
		* Usage dashboard panel — the colorful full-screen overlay. Reads the host
		* `/api/usage/summary` and renders: rainbow stat cards, a 14-day bar chart,
		* a model-donut chart, and a session ranking table. Hand-drawn SVG, no chart
		* library.
		* @module @captain1275/dsh-usage-dashboard/client/DashboardPanel
		*/
		/** 看板彩色盘（五颜六色）。 */
		const RAINBOW = [
			"#f472b6",
			"#fb923c",
			"#facc15",
			"#4ade80",
			"#22d3ee",
			"#818cf8",
			"#c084fc",
			"#f87171"
		];
		/** 数值格式化：千分位 + 大数缩写。 */
		function fmt(n) {
			if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
			if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
			return String(n);
		}
		/** 十六进制颜色转 rgba。 */
		function hexToRgba(hex, alpha) {
			const v = parseInt(hex.slice(1), 16);
			return `rgba(${v >> 16 & 255}, ${v >> 8 & 255}, ${v & 255}, ${alpha})`;
		}
		/** 费用格式化：¥X.XX，小额保留 4 位。 */
		function fmtCost(n) {
			if (n >= 100) return `¥${Math.round(n)}`;
			if (n >= 1) return `¥${n.toFixed(2)}`;
			return `¥${n.toFixed(4)}`;
		}
		/** 拉取看板数据。 */
		async function fetchSummary() {
			const res = await fetch("/api/usage/summary");
			if (!res.ok) throw new Error(`usage summary failed: ${res.status}`);
			return await res.json();
		}
		/** 彩色统计卡片。 */
		function StatCard(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.statCard,
				style: {
					background: `linear-gradient(135deg, ${hexToRgba(props.color, .22)}, ${hexToRgba(props.color, .05)})`,
					borderColor: hexToRgba(props.color, .4)
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statValue,
						style: { color: props.color },
						children: props.value
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statLabel,
						children: props.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statSub,
						children: props.sub
					})
				]
			});
		}
		/** 近 14 天柱状图（SVG）。 */
		function TrendChart(props) {
			const W = 560;
			const H = 160;
			const PAD = {
				left: 8,
				right: 8,
				top: 12,
				bottom: 24
			};
			const max = Math.max(1, ...props.recent.map((d) => d.inputTokens + d.outputTokens));
			const innerW = W - PAD.left - PAD.right;
			const innerH = H - PAD.top - PAD.bottom;
			const barW = innerW / props.recent.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: usage_module_css_default.chart,
				viewBox: `0 0 ${W} ${H}`,
				role: "img",
				"aria-label": t("usage.trend"),
				children: props.recent.map((d, i) => {
					const total = d.inputTokens + d.outputTokens;
					const h = total === 0 ? 0 : Math.max(2, total / max * innerH);
					const x = PAD.left + i * barW;
					const y = PAD.top + innerH - h;
					const color = RAINBOW[i % RAINBOW.length];
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: x + barW * .18,
						y,
						width: barW * .64,
						height: h,
						rx: 3,
						fill: color,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `${d.day}: ${fmt(total)} tokens` })
					}), props.recent.length <= 14 && i % 2 === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: x + barW / 2,
						y: H - 8,
						textAnchor: "middle",
						className: usage_module_css_default.axisLabel,
						children: d.day.slice(5)
					})] }, d.day);
				})
			});
		}
		/** 模型分布环形图（SVG）。 */
		function ModelDonut(props) {
			const entries = Object.entries(props.byModel).sort((a, b) => b[1].inputTokens + b[1].outputTokens - (a[1].inputTokens + a[1].outputTokens));
			const total = entries.reduce((acc, [, v]) => acc + v.inputTokens + v.outputTokens, 0);
			const R = 56;
			const CX = 90;
			const CY = 90;
			const STROKE = 26;
			const CIRC = 2 * Math.PI * R;
			let acc = 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.donutWrap,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 180 180",
					className: usage_module_css_default.donut,
					role: "img",
					"aria-label": t("usage.models"),
					children: [
						entries.map(([name, v], i) => {
							const frac = total === 0 ? 0 : (v.inputTokens + v.outputTokens) / total;
							const dash = frac * CIRC;
							const offset = -(acc * CIRC);
							acc += frac;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								cx: CX,
								cy: CY,
								r: R,
								fill: "none",
								stroke: RAINBOW[i % RAINBOW.length],
								strokeWidth: STROKE,
								strokeDasharray: `${dash} ${CIRC - dash}`,
								strokeDashoffset: offset,
								strokeLinecap: "butt",
								transform: `rotate(-90 ${CX} ${CY})`,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `${name}: ${fmt(v.inputTokens + v.outputTokens)} tokens` })
							}, name);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: CX,
							y: CY - 2,
							textAnchor: "middle",
							className: usage_module_css_default.donutTotal,
							children: fmt(total)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: CX,
							y: 104,
							textAnchor: "middle",
							className: usage_module_css_default.donutLabel,
							children: t("usage.tokens")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_css_default.legend,
					children: entries.map(([name, v], i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_css_default.legendRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendDot,
								style: { background: RAINBOW[i % RAINBOW.length] }
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendName,
								children: name
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendVal,
								children: fmt(v.inputTokens + v.outputTokens)
							})
						]
					}, name))
				})]
			});
		}
		/**
		* The dashboard overlay panel.
		* @param props - onClose callback.
		* @returns portal element tree.
		*/
		function DashboardPanel(props) {
			const [summary, setSummary] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const load = (0, react.useCallback)(() => {
				setError(null);
				fetchSummary().then(setSummary).catch((e) => setError(e instanceof Error ? e.message : String(e)));
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const hasData = summary !== null && summary.total.calls > 0;
			const totalTokens = summary === null ? 0 : summary.total.inputTokens + summary.total.outputTokens + summary.total.cacheReadTokens;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.overlay,
				role: "presentation",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_css_default.mask,
					"aria-hidden": "true",
					onClick: props.onClose
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_css_default.panel,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("usage.title"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.header,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: usage_module_css_default.title,
								children: t("usage.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: usage_module_css_default.close,
								"aria-label": t("usage.close"),
								onClick: props.onClose,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "16",
									height: "16",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										d: "M4 4l8 8M12 4l-8 8",
										stroke: "currentColor",
										strokeWidth: "1.6",
										strokeLinecap: "round"
									})
								})
							})]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: usage_module_css_default.error,
							children: error
						}),
						summary !== null && !hasData && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.empty,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: usage_module_css_default.emptyTitle,
								children: t("usage.empty")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: usage_module_css_default.emptyHint,
								children: t("usage.noData")
							})]
						}),
						summary !== null && hasData && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.body,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.statGrid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.total"),
											value: fmt(totalTokens),
											sub: `${fmt(summary.total.inputTokens)} in / ${fmt(summary.total.outputTokens)} out`,
											color: RAINBOW[0]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.calls"),
											value: fmt(summary.total.calls),
											sub: `${summary.byDayCount} 天有记录`,
											color: RAINBOW[1]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.cache"),
											value: fmt(summary.total.cacheReadTokens),
											sub: "缓存命中",
											color: RAINBOW[2]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: "估算费用",
											value: fmtCost(summary.cost?.total ?? 0),
											sub: "按 DeepSeek 定价估算",
											color: RAINBOW[3]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.section,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.trend")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionSub,
											children: t("usage.trendDetail")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrendChart, { recent: summary.recent })
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.twoCol,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: usage_module_css_default.section,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.models")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelDonut, { byModel: summary.byModel })]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: usage_module_css_default.section,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.sessions")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sessionList,
											children: summary.sessions.map((s, i) => {
												const max = summary.sessions[0]?.totalTokens ?? 1;
												const pct = Math.max(2, Math.round(s.totalTokens / max * 100));
												const color = RAINBOW[i % RAINBOW.length];
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: usage_module_css_default.sessionRow,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: usage_module_css_default.sessionRank,
															style: { color },
															children: i + 1
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: usage_module_css_default.sessionInfo,
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: usage_module_css_default.sessionName,
																	children: s.title
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: usage_module_css_default.sessionMeta,
																	children: [
																		s.model,
																		" · ",
																		s.calls,
																		" ",
																		t("usage.calls")
																	]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: usage_module_css_default.sessionBar,
																	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																		className: usage_module_css_default.sessionBarFill,
																		style: {
																			width: `${pct}%`,
																			background: color
																		}
																	})
																})
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: usage_module_css_default.sessionTokens,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: fmt(s.totalTokens) }), s.cost !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: usage_module_css_default.sessionCost,
																children: fmtCost(s.cost)
															})]
														})
													]
												}, s.id);
											})
										})]
									})]
								})
							]
						})
					]
				})]
			}), document.body);
		}
		//#endregion
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\dsh-usage-dashboard\src\client\usage-entry.module.css.mjs
		const css$1 = ".oI3yBG_entry{width:100%;height:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 12px;font-size:13px;transition:background-color .12s,color .12s;display:flex}.oI3yBG_entry:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary)}.oI3yBG_entry:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.oI3yBG_entryIcon{flex:none;justify-content:center;align-items:center;display:inline-flex}.oI3yBG_entryLabel{text-overflow:ellipsis;overflow:hidden}[data-dsh-frame][data-sidebar-collapsed] .oI3yBG_entry{justify-content:center;width:100%;padding:0}[data-dsh-frame][data-sidebar-collapsed] .oI3yBG_entryLabel{display:none}";
		const tagId$1 = "@captain1275/dsh-usage-dashboard/usage-entry.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var usage_entry_module_css_default = {
			"entry": "oI3yBG_entry",
			"entryIcon": "oI3yBG_entryIcon",
			"entryLabel": "oI3yBG_entryLabel"
		};
		//#endregion
		//#region src/client/UsageEntry.tsx
		/**
		* Usage dashboard sidebar entry — DOM-level injection.
		*
		* dsh's sidebar shell exposes no slot an external plugin can register into
		* (`sidebar.workspaces` / `sidebar.settings` are single-occupant and already
		* taken), so — following the task-board / ssh precedent of DOM-level
		* extension — the entry row is injected between the shell's New Session
		* button and the workspace browser. The injection self-heals: a
		* MutationObserver watches the sidebar root and re-inserts the row whenever
		* a React re-render displaces it.
		*
		* The row is plain DOM; clicking it mounts the full-screen dashboard overlay
		* as a separate React root (see mountDashboard).
		* @module @captain1275/dsh-usage-dashboard/client/UsageEntry
		*/
		/** Inline icon (matches the shell's 16px nav-icon look): three rainbow bars. */
		const ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2.5\" y=\"8\" width=\"3\" height=\"5\" rx=\"0.8\" fill=\"#f472b6\"/><rect x=\"7\" y=\"4.5\" width=\"3\" height=\"8.5\" rx=\"0.8\" fill=\"#fb923c\"/><rect x=\"11.5\" y=\"1.5\" width=\"3\" height=\"11.5\" rx=\"0.8\" fill=\"#4ade80\"/></svg>";
		/** Find the sidebar shell root element, or undefined while not yet mounted. */
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		/** The injected dashboard overlay root (single instance while open). */
		let overlayRoot;
		let overlayHost;
		/** Close the dashboard overlay if open. */
		function closeDashboard() {
			overlayRoot?.unmount();
			overlayRoot = void 0;
			overlayHost?.remove();
			overlayHost = void 0;
		}
		/** Open the full-screen dashboard overlay. */
		function openDashboard() {
			if (overlayRoot !== void 0) return;
			overlayHost = document.createElement("div");
			overlayHost.dataset.dshUsageOverlay = "";
			document.body.appendChild(overlayHost);
			overlayRoot = (0, react_dom_client.createRoot)(overlayHost);
			overlayRoot.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DashboardPanel, { onClose: closeDashboard }));
		}
		/** Build the entry row (a detached button; insert once the shell is up). */
		function createEntry() {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.dataset.dshUsageEntry = "";
			entry.className = usage_entry_module_css_default.entry;
			entry.setAttribute("aria-label", t("usage.entry"));
			entry.setAttribute("title", t("usage.entry"));
			entry.innerHTML = `<span class="${usage_entry_module_css_default.entryIcon}">${ICON}</span><span class="${usage_entry_module_css_default.entryLabel}">${t("usage.entry")}</span>`;
			entry.addEventListener("click", () => {
				openDashboard();
			});
			return entry;
		}
		/** Re-insert the entry after the New Session row (before the browser region). */
		function placeEntry(root, entry) {
			const button = newSessionButton(root);
			if (button === void 0) return false;
			if (entry.parentElement !== root) {
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches("[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-usage-entry]"));
				const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		/**
		* Mount the sidebar entry, waiting for the shell to render and self-healing
		* on later React re-renders.
		* @returns disposer removing the entry and its observers.
		*/
		function mountUsageEntry() {
			const entry = createEntry();
			let root;
			let placed = false;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) {
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				if (placed) {
					if (document.body.contains(entry)) return;
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				root ??= sidebarRoot();
				if (root === void 0) return;
				placed = placeEntry(root, entry);
				if (placed) rootObserver.observe(root, {
					childList: true,
					subtree: true
				});
			};
			const waitObserver = new MutationObserver(() => {
				tryPlace();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const rootObserver = new MutationObserver(() => {
				if (root === void 0 || !root.isConnected) {
					placed = false;
					tryPlace();
					return;
				}
				if (!root.contains(entry)) placed = placeEntry(root, entry);
			});
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				entry.remove();
				closeDashboard();
			};
		}
		//#endregion
		//#region src/client/UsageRecorder.tsx
		/**
		* Usage recorder — an invisible conversation-dock seat that watches the
		* `tokenUsage` projection and uploads per-response snapshots to the host.
		*
		* Semantics:
		*  - The projection is a session-cumulative total that may already be large
		*    when this component mounts (page refresh, session switch, HMR reload).
		*    The FIRST sight only establishes a baseline — never uploaded, so a
		*    mount never counts the whole history as new usage.
		*  - While the total GROWS (a response is streaming), uploads are debounced
		*    to one per second. When growth stops for SETTLE_MS, the recorder
		*    flushes one final snapshot — one completed response = one upload, so
		*    the host's calls counter tracks real response rounds.
		*  - The host stores the LATEST snapshot per session (replace semantics);
		*    repeated uploads overwrite instead of double counting.
		* @module @captain1275/dsh-usage-dashboard/client/UsageRecorder
		*/
		/** 一轮响应结束判定的静默时长（ms）。 */
		const SETTLE_MS = 2e3;
		/** 上报当前快照到宿主（replace 语义：同会话覆盖，不累加）。 */
		async function postSnapshot(snapshot) {
			try {
				await fetch("/api/usage/record", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						...snapshot,
						ts: Date.now()
					})
				});
			} catch {}
		}
		/** 当前模型（由入口从连接层更新，尽力而为）。 */
		let currentModel = "unknown";
		/** 当前会话标题（由入口从连接层更新，尽力而为）。 */
		let currentTitle = "";
		/** 供入口设置当前模型（连接层回调）。 */
		function setCurrentModel(model) {
			if (typeof model === "string" && model.length > 0) currentModel = model;
		}
		/** 供入口设置当前会话标题（连接层回调）。 */
		function setCurrentTitle(title) {
			if (typeof title === "string" && title.length > 0) currentTitle = title;
		}
		/**
		* The invisible recorder seat.
		* @param props - framework runtime share.
		* @returns null (renders nothing).
		*/
		const UsageRecorder = (0, react.memo)(function UsageRecorder(props) {
			const session = props.useSession((s) => ({ sessionId: s.sessionId }));
			const usage = props.useProjection("tokenUsage");
			const lastTotalRef = (0, react.useRef)(-1);
			const settleTimerRef = (0, react.useRef)(null);
			const lastSeenRef = (0, react.useRef)(null);
			const flush = () => {
				settleTimerRef.current = null;
				const seen = lastSeenRef.current;
				if (seen === null) return;
				postSnapshot({
					sessionId: seen.sessionId,
					sessionTitle: seen.title,
					model: currentModel,
					inputTokens: seen.input,
					outputTokens: seen.output,
					cacheReadTokens: seen.cache
				});
			};
			(0, react.useEffect)(() => {
				const sid = session.sessionId;
				if (sid === void 0 || usage === void 0) return;
				const total = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
				const prev = lastTotalRef.current;
				if (prev === -1) {
					lastTotalRef.current = total;
					return;
				}
				lastTotalRef.current = total;
				if (total <= 0) return;
				if (total <= prev) return;
				lastSeenRef.current = {
					sessionId: sid,
					title: currentTitle,
					input: usage.uncachedInputTokens + usage.cacheReadTokens,
					output: usage.outputTokens,
					cache: usage.cacheReadTokens
				};
				if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
				settleTimerRef.current = window.setTimeout(flush, SETTLE_MS);
			}, [session.sessionId, usage]);
			(0, react.useEffect)(() => {
				return () => {
					if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
				};
			}, []);
			return null;
		});
		//#endregion
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\dsh-usage-dashboard\src\client\usage-settings.module.css.mjs
		const css = ".jgFV7q_card{border:1px solid var(--dsw-alias-border-l2,#8ca0ff38);background:var(--dsw-alias-surface-card,#12182e99);border-radius:10px;list-style:none;overflow:hidden}.jgFV7q_header{width:100%;color:inherit;font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:10px;padding:12px 16px;display:flex}.jgFV7q_headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.jgFV7q_name{color:var(--dsw-alias-label-primary,#eef1ff);font-size:14px;font-weight:600}.jgFV7q_description{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px}.jgFV7q_chevron{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px;transition:transform .12s}.jgFV7q_chevronOpen{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px;transform:rotate(180deg)}.jgFV7q_body{flex-direction:column;gap:8px;padding:4px 16px 14px;display:flex}.jgFV7q_legendRow{color:var(--dsw-alias-label-secondary,#b9c2e8);align-items:center;gap:8px;font-size:12px;display:flex}.jgFV7q_dot{border-radius:50%;flex:none;width:9px;height:9px}";
		const tagId = "@captain1275/dsh-usage-dashboard/usage-settings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var usage_settings_module_css_default = {
			"body": "jgFV7q_body",
			"card": "jgFV7q_card",
			"chevron": "jgFV7q_chevron",
			"chevronOpen": "jgFV7q_chevronOpen",
			"description": "jgFV7q_description",
			"dot": "jgFV7q_dot",
			"headText": "jgFV7q_headText",
			"header": "jgFV7q_header",
			"legendRow": "jgFV7q_legendRow",
			"name": "jgFV7q_name"
		};
		//#endregion
		//#region src/client/UsageSettingsCard.tsx
		/**
		* Usage dashboard settings card — a simple informational card for the
		* Web UI plugin group: explains what the dashboard records and where the
		* data lives. No configuration fields (the dashboard is zero-config).
		* @module @captain1275/dsh-usage-dashboard/client/UsageSettingsCard
		*/
		/**
		* Render the informational settings card.
		* @returns the card element.
		*/
		function UsageSettingsCard(_props) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: usage_settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: usage_settings_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}: ${t("usage.settingsTitle")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_settings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.name,
							children: t("usage.settingsTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.description,
							children: t("usage.settingsHint")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: open ? usage_settings_module_css_default.chevronOpen : usage_settings_module_css_default.chevron,
						children: "▾"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_settings_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#f472b6" }
							}), " 每次响应的 token 用量自动记录"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#fb923c" }
							}), " 侧边栏彩色图表按钮打开看板"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#4ade80" }
							}), " 数据保存在 ~/.dsh/usage.json（本机）"]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Services required. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope"
		];
		/**
		* Register the usage dashboard surface.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "usage-dashboard: dictionaries");
			let disposeEntry;
			ctx.effect(() => {
				disposeEntry = mountUsageEntry();
				return () => disposeEntry?.();
			}, "usage-dashboard: sidebar entry");
			ctx.effect(() => {
				const connection = ctx.get("connection");
				if (connection?.api?.sessions === void 0) return () => {};
				let cancelled = false;
				const tick = async () => {
					try {
						const item = (await connection.api?.sessions?.list({ cursor: "" }))?.result?.value?.items?.[0];
						const sessionId = item?.sessionId;
						if (item?.title !== void 0 && !cancelled) setCurrentTitle(item.title);
						if (sessionId === void 0 || cancelled) return;
						const model = (await connection.api?.sessions?.models({ sessionId }))?.result?.value?.current?.model;
						if (model !== void 0 && !cancelled) setCurrentModel(model);
					} catch {}
				};
				tick();
				const timer = window.setInterval(() => {
					tick();
				}, 5e3);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, "usage-dashboard: model subscription");
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "usage-recorder",
				order: 5
			}, UsageRecorder));
			ctx.slots.inject("web-ui.plugin.item", () => ctx.slots.register({
				name: "web-ui.plugin.item",
				id: "usage-dashboard",
				order: 130,
				locale: NS
			}, UsageSettingsCard));
		}
		//#endregion
		exports.apply = apply;
		exports.closeDashboard = closeDashboard;
		exports.inject = inject;
		exports.mountUsageEntry = mountUsageEntry;
		exports.openDashboard = openDashboard;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map