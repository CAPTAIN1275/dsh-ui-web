window.__ModuleLoader__.load({
	id: "@captain1275/dsh-web-ui-all",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/index.ts
		/** Column shims: element selector → attribute to stamp. */
		const COLUMN_SHIMS = [
			["[class*=\"sidebarCol\"]", "data-pane=\"sidebar\""],
			["[class*=\"centerCol\"]", "data-pane=\"conversation\""],
			["[class*=\"detailsCol\"]", "data-pane=\"details\""]
		];
		/** Stamp one attribute of the form `name="value"` onto an element, if found. */
		function stamp(el, attribute) {
			if (el === null) return;
			const eq = attribute.indexOf("=");
			const name = attribute.slice(0, eq);
			const value = attribute.slice(eq + 1).replace(/^"|"$/g, "");
			el.setAttribute(name, value);
		}
		/** One pass over the current DOM. */
		function applyShims() {
			for (const [selector, attribute] of COLUMN_SHIMS) stamp(document.querySelector(selector), attribute);
			stamp(document.querySelector("[class*=\"sidebarCol\"]")?.parentElement ?? null, "data-dsh-frame=\"\"");
		}
		/**
		* crypto.randomUUID polyfill：部分手机浏览器（旧版 WebView / 国产浏览器）
		* 没有 crypto.randomUUID，官方模型目录等加载会直接崩
		* （"crypto.randomUUID is not a function"）。页面加载早期补一个 UUID v4。
		*/
		function polyfillRandomUUID() {
			try {
				const c = globalThis.crypto;
				if (c !== void 0 && typeof c.randomUUID === "function") return;
				const uuid = () => {
					const bytes = /* @__PURE__ */ new Uint8Array(16);
					if (typeof c?.getRandomValues === "function") c.getRandomValues(bytes);
					else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
					bytes[6] = bytes[6] & 15 | 64;
					bytes[8] = bytes[8] & 63 | 128;
					const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
					return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
				};
				if (c !== void 0) c.randomUUID = uuid;
			} catch {}
		}
		/** Required services: none — the shim must run before any DOM mount waits. */
		const inject = [];
		/**
		* Register the shim for the page lifetime.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			polyfillRandomUUID();
			ctx.effect(() => {
				applyShims();
				const observer = new MutationObserver(applyShims);
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				return () => {
					observer.disconnect();
				};
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map