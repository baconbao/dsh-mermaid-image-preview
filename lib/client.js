// dsh-mermaid-image-preview - browser half.
// Renders mermaid fenced blocks (```mermaid / ```mmd) inside the closing
// assistant message as rendered diagrams, right under the message (turnTail
// list seat). Diagrams are rendered by the built-in local renderer first;
// when that fails and the external fallback is enabled, the SVG is loaded
// from the fallback render server (default mermaid.ink). The diagram URL is
// built here with the browser-native btoa (UTF-8 safe via TextEncoder),
// following the active color scheme (light/dark).
//
// Compatibility: from DSH 0.1.6-alpha.2 the `conversation.chat.turnTail` seat
// is a `list` slot (it was a `chain` slot before), so this half registers one
// `id`-keyed entry and reads the closing Turn from the owner props. Its
// configuration block is contributed into `plugins.bundle.config`, the seat the
// Plugins panel shows on an installed bundle's own page (keyed by the package
// name), and it draws its own markup - no icon or primitive imports, which were
// renamed upstream in the 0.1.7 line.
window.__ModuleLoader__.load({
	id: "@baconbao/dsh-mermaid-image-preview",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		//#region styles
		// One shared <img> toggles between the collapsed preview and the
		// full-size view on click: no popup, no portal, the image element never
		// leaves the message.
		// Visual fit: the tail hugs the markdown above (no top margin), the
		// box uses a tight padding so it reads as a continuation.
		const css = ".dsh-mermaid-tail{flex-direction:column;gap:4px;margin:0 0 2px;display:flex}.dsh-mermaid-box{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:6px 8px;justify-content:center;align-items:flex-start;display:flex}.dsh-mermaid-thumb{max-width:100%;width:auto;height:auto;display:block;cursor:zoom-in}.dsh-mermaid-full{max-width:100%;width:auto;height:auto;display:block;cursor:zoom-out}.dsh-mermaid-loading{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dsh-mermaid-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin-bottom:4px}.dsh-mermaid-fallback{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 12px;overflow-x:auto}.dsh-mermaid-fallback pre{margin:0;white-space:pre-wrap;word-break:break-word;font:13px/20px var(--ds-font-family-code);color:var(--dsw-alias-label-primary)}.dsh-mermaid-config{flex-direction:column;max-width:640px;display:flex}.dsh-mermaid-pending{margin-right:auto;white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.dsh-mermaid-field{justify-content:space-between;align-items:center;gap:12px;padding:10px 0;display:flex}.dsh-mermaid-label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}.dsh-mermaid-link{width:120px;color:var(--dsw-alias-brand-primary);text-align:right;text-decoration:none;font-size:13px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-mermaid-link:hover{text-decoration:underline}.dsh-mermaid-field input[type=number]{width:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;font-size:13px;line-height:1.5}.dsh-mermaid-config-footer{border-top:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:12px 0 4px;display:flex}.dsh-mermaid-discard,.dsh-mermaid-save{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.dsh-mermaid-discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.dsh-mermaid-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.dsh-mermaid-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.dsh-mermaid-discard:disabled,.dsh-mermaid-save:disabled{opacity:.4;cursor:default}.dsh-mermaid-discard:focus-visible,.dsh-mermaid-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId = "@baconbao/dsh-mermaid-image-preview/tail.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@baconbao/dsh-mermaid-image-preview";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		/** Chat seat rendered under the closing Turn. */
		const TURN_TAIL_SLOT = "conversation.chat.turnTail";
		/** Plugins-page seat: the bundle's own configuration block on its page. */
		const BUNDLE_CONFIG_SLOT = "plugins.bundle.config";
		/** Entry id of the chat seat (a list slot needs one stable id). */
		const CONTRIBUTION_ID = "baconbao-dsh-mermaid-image-preview";
		/** `plugins.bundle.config` is keyed by the bundle's package name. */
		const BUNDLE_CONFIG_KEY = "@baconbao/dsh-mermaid-image-preview";
		/** Order among the turn-tail entries (ascending). */
		const TURN_TAIL_ORDER = 30;

		// Collect mermaid fenced code blocks (```mermaid or ```mmd) from markdown text.
		function extractMermaid(text, out) {
			const re = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/g;
			let m;
			while ((m = re.exec(text)) !== null) {
				const code = m[1].trim();
				if (code) out.push(code);
			}
		}

		// Read the Turn's published `turn-tail` business value. The owner props
		// carry the TurnLocation; its `data` store is the same stable reader the
		// previous chain-style `select` used, so the closing text is found on
		// every runtime that declares this seat as a list.
		function readTurnTail(turn) {
			try {
				const store = turn !== null && typeof turn === "object" ? turn.data : undefined;
				return store !== null && store !== undefined && typeof store.get === "function" ? store.get("turn-tail") : undefined;
			} catch (e) {
				return undefined;
			}
		}

		// Closing-assistant text blocks of one Turn. `finalNode.blocks` is the
		// durable message payload; `blocks` is the same list on payloads that
		// carry it directly.
		function closingBlocks(turn) {
			const tail = readTurnTail(turn);
			const closing = tail !== null && tail !== undefined && tail.closing ? tail.closing : undefined;
			if (closing === undefined) return [];
			if (closing.finalNode !== undefined && Array.isArray(closing.finalNode.blocks)) return closing.finalNode.blocks;
			return Array.isArray(closing.blocks) ? closing.blocks : [];
		}

		// Every mermaid fenced block the closing assistant message carries.
		function turnDiagrams(turn) {
			const diagrams = [];
			for (const block of closingBlocks(turn)) {
				if (block !== null && typeof block === "object" && block.kind === "text" && typeof block.text === "string") extractMermaid(block.text, diagrams);
			}
			return diagrams;
		}

		// Any mermaid render server: default mermaid.ink, overridable through
		// the Host-injected boot global `window.__MERMAID_FALLBACK_RENDER_URL__` (set by
		// the node half from profile patch config). The code is appended as
		// /svg/<urlsafe-base64>[?theme=dark].
		function diagramUrl(baseUrl, code, theme) {
			const bytes = new TextEncoder().encode(code);
			let binary = "";
			for (const b of bytes) binary += String.fromCharCode(b);
			const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
			return baseUrl.replace(/\/+$/, "") + "/svg/" + b64 + (theme === "dark" ? "?theme=dark" : "");
		}

		// Built-in local renderer URL. Always the built-in route resolved
		// against the CURRENT page origin, so it points at the webserver the
		// user is connected to (host/port may vary).
		function readLocalRenderUrl() {
			if (typeof window !== "undefined" && typeof window.location !== "undefined") {
				return window.location.origin + "/dsh-mermaid-image-preview";
			}
			return "/dsh-mermaid-image-preview";
		}

		// Whether the local renderer is enabled (default true). When false,
		// the local renderer is skipped entirely and fallbackRenderUrl is used.
		function readEnableLocalRender() {
			const value = typeof window !== "undefined" ? window.__MERMAID_ENABLE_LOCAL_RENDER__ : void 0;
			return value !== false;
		}

		// External fallback render server URL. Defaults to mermaid.ink.
		// Used when enableFallback is true and the local renderer cannot
		// render a diagram type, or when enableLocalRender is false.
		function readFallbackRenderUrl() {
			const base = typeof window !== "undefined" ? window.__MERMAID_FALLBACK_RENDER_URL__ : void 0;
			return typeof base === "string" && base.trim() !== "" ? base.trim() : "https://mermaid.ink";
		}

		// Whether the external fallback flow is enabled (default false).
		function readEnableFallback() {
			const value = typeof window !== "undefined" ? window.__MERMAID_ENABLE_FALLBACK__ : void 0;
			return value === true;
		}

		//  plugin settings (collapsed preview height) ---------------------
		// Stored in one localStorage object so the plugin's configuration block
		// and the chat renderer share the same source, survive reloads/restarts, and
		// stay in sync through a module-level subscription store. Whether the
		// plugin runs at all is the Host's switch on the plugin's own page - not a
		// setting here. A stale `enabled` field written by earlier releases is
		// deliberately ignored (and dropped on the next save), so a user who had
		// turned the previews off is not stranded with no way back on.

		/** localStorage key holding the whole settings object. */
		const SETTINGS_KEY = "dsh-mermaid-image-preview.settings";

		/** Defaults applied when nothing is stored. */
		const SETTINGS_DEFAULTS = {
			thumbMaxHeight: 204,
		};

		/** Current settings (module-level store). */
		let settings = readPersistedSettings();

		/** Listeners notified on every settings change (module-level). */
		const settingsListeners = new Set();

		/** Read the persisted settings object, merging defaults when unset. */
		function readPersistedSettings() {
			try {
				const stored = typeof localStorage !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
				if (stored !== null) {
					const parsed = JSON.parse(stored);
					return {
						thumbMaxHeight: typeof parsed.thumbMaxHeight === "number" && Number.isFinite(parsed.thumbMaxHeight) && parsed.thumbMaxHeight > 0
							? parsed.thumbMaxHeight
							: SETTINGS_DEFAULTS.thumbMaxHeight,
					};
				}
			} catch (e) {
				// storage unavailable or malformed - fall through to defaults
			}
			return { ...SETTINGS_DEFAULTS };
		}

		/** Persist the current settings object to localStorage. */
		function persistSettings() {
			try {
				if (typeof localStorage !== "undefined") localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
			} catch (e) {
				// storage unavailable - settings are session-only
			}
		}

		/** @returns the current settings object. */
		function getSettings() {
			return settings;
		}

		/** Subscribe to settings changes; returns a disposer. */
		function subscribeSettings(listener) {
			settingsListeners.add(listener);
			return () => settingsListeners.delete(listener);
		}

		/** Apply a partial update, persist, and notify all subscribers. */
		function updateSettings(patch) {
			settings = { ...settings, ...patch };
			persistSettings();
			for (const listener of settingsListeners) listener();
		}

		/** React hook: current settings, re-rendered on any change. */
		function useSettings() {
			const [value, setValue] = react.useState(getSettings);
			react.useEffect(() => subscribeSettings(() => setValue(getSettings())), []);
			return value;
		}

		// Follow the active color scheme so the render server can pick a matching theme.
		function useColorScheme(props) {
			const [scheme, setScheme] = react.useState(
				props.theme && typeof props.theme.getTheme === "function" ? props.theme.getTheme()?.active?.colorScheme ?? "light" : "light",
			);
			react.useEffect(() => {
				if (typeof props.onThemeChange !== "function") return;
				const off = props.onThemeChange((snapshot) => {
					if (snapshot && snapshot.active) setScheme(snapshot.active.colorScheme);
				});
				return off;
			}, []);
			return scheme;
		}

		function MermaidDiagram({ code, scheme, localRenderUrl, enableLocalRender, fallbackRenderUrl, enableFallback, thumbMaxHeight }) {
			const [state, setState] = react.useState({ status: "loading" });
			const [zoomed, setZoomed] = react.useState(false);
			react.useEffect(() => {
				let alive = true;
				setState({ status: "loading" });
				const localUrl = diagramUrl(localRenderUrl, code, scheme);
				const fallbackUrl = diagramUrl(fallbackRenderUrl, code, scheme);
				// When the local renderer is disabled, skip it entirely and go
				// straight to the fallback server.
				if (!enableLocalRender) {
					const retry = new Image();
					retry.onload = () => { if (alive) setState({ status: "ready", url: fallbackUrl }); };
					retry.onerror = () => { if (alive) setState({ status: "error", message: "image failed to load" }); };
					retry.src = fallbackUrl;
					return () => { alive = false; };
				}
				const probe = new Image();
				probe.onload = () => { if (alive) setState({ status: "ready", url: localUrl }); };
				probe.onerror = () => {
					// External fallback only when enabled; otherwise report failure.
					if (!enableFallback) {
						if (alive) setState({ status: "error", message: "image failed to load" });
						return;
					}
					const retry = new Image();
					retry.onload = () => { if (alive) setState({ status: "ready", url: fallbackUrl }); };
					retry.onerror = () => { if (alive) setState({ status: "error", message: "image failed to load" }); };
					retry.src = fallbackUrl;
				};
				probe.src = localUrl;
				return () => { alive = false; };
			}, [code, scheme, localRenderUrl, enableLocalRender, fallbackRenderUrl, enableFallback]);

			if (state.status === "loading") {
				return react.createElement("div", { className: "dsh-mermaid-loading" }, "Rendering diagram...");
			}
			if (state.status === "error") {
				return react.createElement("div", { className: "dsh-mermaid-fallback" },
					react.createElement("div", { className: "dsh-mermaid-error" }, "Diagram failed: " + state.message),
					react.createElement("pre", null, code),
				);
			}
			// One shared <img> toggles between the collapsed preview and the
			// full-size view on click - the element never leaves the message, so
			// the preview never disappears and the full image is already loaded.
			// The configured height caps the collapsed preview only: the inline
			// style (which wins over the class) is dropped while expanded, where
			// the column width is the only limit left.
			const imgStyle = zoomed ? void 0 : { maxHeight: thumbMaxHeight + "px" };
			return react.createElement("div", { className: "dsh-mermaid-box" },
				react.createElement("img", {
					className: zoomed ? "dsh-mermaid-full" : "dsh-mermaid-thumb",
					style: imgStyle,
					src: state.url,
					alt: "mermaid diagram",
					title: zoomed ? "Click to shrink" : "Click to enlarge",
					onClick: () => setZoomed(!zoomed),
				}),
			);
		}

		// Turn-tail list entry. Owner props carry the Turn (`turn`), the
		// closing sequence, and the workspace file opener; the injected face
		// adds the theme handle the diagram renderer follows.
		function MermaidTurnTail(props) {
			// Hooks must run unconditionally at the top of the component.
			const { thumbMaxHeight } = useSettings();
			const scheme = useColorScheme(props);
			const localRenderUrl = readLocalRenderUrl();
			const enableLocalRender = readEnableLocalRender();
			const fallbackRenderUrl = readFallbackRenderUrl();
			const enableFallback = readEnableFallback();
			const diagrams = turnDiagrams(props.turn);
			if (!diagrams.length) return null;
			return react.createElement("div", { className: "dsh-mermaid-tail" },
				diagrams.map((code, i) => react.createElement(MermaidDiagram, { key: i, code, scheme, localRenderUrl, enableLocalRender, fallbackRenderUrl, enableFallback, thumbMaxHeight })),
			);
		}

		// Plugin configuration: the `plugins.bundle.config` entry keyed by this
		// package's name, rendered on the plugin's own page in the Plugins panel,
		// between its description and its rows. The owner asks for one of two
		// views: `summary` wants a one-liner, `page` the form with its save
		// control. The page already shows the title, the version tag, and the
		// plugin-level enable switch - switching that off (Host restart) is how a
		// user stops the previews now - so this component renders only the one
		// setting of its own. It lives in the same localStorage-backed store the
		// chat renderer reads, so saving applies immediately everywhere.
		function MermaidPluginConfig(props) {
			const { thumbMaxHeight } = useSettings();
			const [draft, setDraft] = react.useState(String(thumbMaxHeight));
			// Keep the draft in sync when the store changes elsewhere.
			react.useEffect(() => { setDraft(String(thumbMaxHeight)); }, [thumbMaxHeight]);
			if (props !== null && props !== undefined && props.view === "summary") {
				return `Collapsed preview height: ${thumbMaxHeight}px`;
			}
			const dirty = draft !== String(thumbMaxHeight);
			const save = () => {
				const value = Number(draft);
				if (Number.isFinite(value) && value > 0) {
					updateSettings({ thumbMaxHeight: Math.round(value) });
				}
			};
			const discard = () => {
				setDraft(String(thumbMaxHeight));
			};
			return react.createElement("div", { className: "dsh-mermaid-config" },
				react.createElement("label", { className: "dsh-mermaid-field" },
					react.createElement("span", { className: "dsh-mermaid-label" }, "Collapsed preview height (px)"),
					react.createElement("input", {
						type: "number",
						min: 1,
						value: draft,
						onChange: (e) => setDraft(e.target.value),
					}),
				),
				react.createElement("div", { className: "dsh-mermaid-field" },
					react.createElement("span", { className: "dsh-mermaid-label" }, "Source"),
					react.createElement("a", {
						className: "dsh-mermaid-link",
						href: "https://github.com/baconbao/dsh-mermaid-image-preview",
						target: "_blank",
						rel: "noreferrer",
					}, "View on GitHub"),
				),
				react.createElement("div", { className: "dsh-mermaid-config-footer" },
					dirty ? react.createElement("span", { className: "dsh-mermaid-pending" }, "Unsaved changes") : null,
					react.createElement("button", {
						type: "button",
						className: "dsh-mermaid-discard",
						disabled: !dirty,
						onClick: discard,
					}, "Discard"),
					react.createElement("button", {
						type: "button",
						className: "dsh-mermaid-save",
						disabled: !dirty,
						onClick: save,
					}, "Save"),
				),
			);
		}

		// Required services: the slot registry. The render server base URL
		// arrives via the Host-injected boot global, so no settings/connection
		// dependency is needed here.
		const inject = ["slots"];

		function apply(ctx) {
			// Chat seat: an ordered `list` entry on the completed Turn's tail.
			ctx.slots.inject(TURN_TAIL_SLOT, () => ctx.slots.register(
				{
					name: TURN_TAIL_SLOT,
					id: CONTRIBUTION_ID,
					order: TURN_TAIL_ORDER,
					// Business face injected into the component props: a minimal
					// theme handle plus a theme-change subscription disposer.
					inject: () => ({
						theme: ctx.get("theme"),
						onThemeChange: (listener) => ctx.on("theme/change", listener),
					}),
				},
				MermaidTurnTail,
			));
			// Configuration seat: the plugin's own page in the Plugins panel,
			// keyed by the bundle's package name (the page dispatches
			// `entryKey = pkg.name` and shows the block only while this key exists).
			ctx.slots.inject(BUNDLE_CONFIG_SLOT, () => ctx.slots.register(
				{
					name: BUNDLE_CONFIG_SLOT,
					key: BUNDLE_CONFIG_KEY,
				},
				MermaidPluginConfig,
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
