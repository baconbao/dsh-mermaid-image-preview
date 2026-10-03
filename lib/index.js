// SPDX-FileCopyrightText: 2026 baconbao
// SPDX-License-Identifier: MIT

// @baconbao/dsh-mermaid-image-preview - node half.
// Two responsibilities:
//
// 1) Configure the render server through the profile patch config
//    (cordis.patch.yml), resolved HERE on the Host and shipped to the browser
//    as boot-time globals:
//
//        ~/.dsh/profiles/web/cordis.patch.yml:
//          - id: ui-dsh-mermaid-image-preview
//            config:
//              enableLocalRender: true
//              fallbackRenderUrl: https://your-own-server.example.com
//              enableFallback: false
//
// 2) Serve a built-in local mermaid renderer on `/dsh-mermaid-image-preview`
//    (path format: /dsh-mermaid-image-preview/svg/<urlsafe-base64>[?theme=dark]),
//    rendered in-process by `mermaid` + `svgdom` (no Chrome, no external
//    service). Set `enableLocalRender: false` in the profile patch to skip
//    the local renderer and use `fallbackRenderUrl` directly.
//
// The browser half never touches Host settings; it reads the injected globals
// only. Injecting them into the served index avoids the Host settings proxy
// allowlist (`settings-not-exposed`).
//
// Compatibility note: this half deliberately touches nothing but `webServer`.
// The Host settings API this plugin used to register an empty settings
// namespace (`@deepseek-ai/dsh-settings`: `settingsNamespace` +
// `settings.register`) was removed upstream in the 0.1.7 line, and the
// configuration block is contributed entirely from the browser half through
// the `plugins.bundle.config` slot on the plugin's own page in the Plugins
// panel, so no Host settings contract is involved.
import { createHTMLWindow } from "svgdom";
import mermaid from "mermaid";
import createDOMPurify from "dompurify";

// ── mermaid + svgdom engine (pure Node, no Chrome) ─────────────────────────
// Lazy: svgdom's window is injected into the globals ONLY on the first render,
// so the Host process is not polluted at module load. Diagram types that need
// canvas (mindmap) or full layout measurement (gantt) cannot render in Node
// without a real browser.
//
// `jsdom` is deliberately NOT a dependency, and no DOM implementation replaces
// it. jsdom reaches `tr46`, which issues `require("punycode/")`; the
// profile-scoped CJS resolver the Host installs (`dsh-app-boot`,
// `ResolutionRouter.routeScoped`) strips the subpath, looks the name up as
// Node's `punycode` builtin, receives `null` from `require.resolve.paths()` and
// throws inside an unguarded `for…of` ("createRequire.resolve.paths is not a
// function or its return value is not iterable"). That rejection escapes the
// Loader's import, so the whole row reports "failed to import" and never
// starts. mermaid nevertheless calls the sanitizer even at
// `securityLevel: "loose"` (its `sanitizeText` runs label text through
// DOMPurify regardless of the level), so the shared dompurify module object
// carries a passthrough binding instead of a DOM-bound instance. Verified
// equivalent: every diagram type this plugin renders locally produces the same
// SVG as with the former jsdom-bound sanitizer - for labels containing bare
// "<" / ">" only the tspan segmentation differs, with identical visible text -
// and mermaid emits label text escaped either way, never as raw markup. A
// future strict security level needs a real DOM back, together with the Host
// fix (upstream reports: deepseek-harness discussions #7031 and #7903;
// linkedom was measured as a jsdom stand-in and silently no-ops sanitize(),
// so it is not an option).
let mermaidReady = false;

function ensureMermaidReady() {
	if (mermaidReady) return;
	Object.assign(createDOMPurify, {
		isSupported: true,
		sanitize: (value) => String(value),
		addHook() {},
		removeHook() {},
		setConfig() {},
		clearConfig() {},
	});
	const svgWindow = createHTMLWindow();
	Object.assign(globalThis, { window: svgWindow, document: svgWindow.document });
	if (typeof globalThis.CSSStyleSheet === "undefined") {
		globalThis.CSSStyleSheet = class {
			constructor() { this.cssRules = []; }
			insertRule(rule, index = 0) { this.cssRules.splice(index, 0, rule); return index; }
		};
	}
	mermaidReady = true;
}

/** Render with the local engine (mermaid + svgdom). Theme is applied per render. */
async function renderLocal(code, dark) {
	ensureMermaidReady();
	mermaid.initialize({ htmlLabels: false, flowchart: { htmlLabels: false }, startOnLoad: false, securityLevel: "loose", ...(dark ? { theme: "dark" } : { theme: "default" }) });
	const { svg } = await mermaid.render("local-render", code);
	return svg;
}

/** Default render server when no override is configured. The browser half
 * mirrors this literal in `readFallbackRenderUrl` - change both together. */
const DEFAULT_MERMAID_INK_URL = "https://mermaid.ink";

/** Built-in local renderer route. The browser half mirrors this literal in
 * `readLocalRenderUrl` - change both together. */
const LOCAL_RENDER_PATH = "/dsh-mermaid-image-preview";

/** Request pattern of the built-in renderer route (path + `/svg/<urlsafe-base64>`). */
const ROUTE_PATTERN = new RegExp(`^${LOCAL_RENDER_PATH}/svg/([A-Za-z0-9_-]+)$`);

/**
 * Resolve the external fallback render server URL. Defaults to mermaid.ink.
 * Used when `enableFallback` is true and the local renderer cannot handle a
 * diagram type, or when `enableLocalRender` is false.
 * @param config - row config from cordis.patch.yml (may carry fallbackRenderUrl).
 * @returns the resolved render server base URL.
 */
function resolveFallbackRenderUrl(config) {
	const fromConfig = config && typeof config.fallbackRenderUrl === "string" ? config.fallbackRenderUrl.trim() : "";
	return fromConfig !== "" ? fromConfig : DEFAULT_MERMAID_INK_URL;
}

/**
 * Resolve whether the local renderer is enabled (default true).
 * @param config - row config from cordis.patch.yml (may carry enableLocalRender).
 * @returns whether the built-in local renderer is used.
 */
function resolveEnableLocalRender(config) {
	return config && typeof config.enableLocalRender === "boolean" ? config.enableLocalRender : true;
}

/**
 * Resolve whether the external fallback flow is enabled (default false).
 * @param config - row config from cordis.patch.yml (may carry enableFallback).
 * @returns whether the external fallback flow is enabled.
 */
function resolveEnableFallback(config) {
	return config && typeof config.enableFallback === "boolean" ? config.enableFallback : false;
}

/**
 * Inject the resolved boot globals right after <body> opens, before the shell
 * mount and module scripts (same pattern as ui-theme's bootstrap).
 * @param html - Raw application index HTML.
 * @param enableLocalRender - Whether the local renderer is enabled.
 * @param fallbackRenderUrl - Resolved external fallback URL.
 * @param enableFallback - Whether the external fallback flow is enabled.
 * @returns HTML containing the bootstrap script.
 */
function injectBootGlobals(html, enableLocalRender, fallbackRenderUrl, enableFallback) {
	const script = `<script>window.__MERMAID_ENABLE_LOCAL_RENDER__ = ${enableLocalRender};window.__MERMAID_FALLBACK_RENDER_URL__ = ${JSON.stringify(fallbackRenderUrl)};window.__MERMAID_ENABLE_FALLBACK__ = ${enableFallback};<\/script>`;
	const body = /<body(?:\s[^>]*)?>/i.exec(html);
	if (body === null) return `${html}${script}`;
	const at = body.index + body[0].length;
	return `${html.slice(0, at)}${script}${html.slice(at)}`;
}

/**
 * Decode a URL-safe base64 string to UTF-8 text.
 * @param input - URL-safe base64 text.
 * @returns the decoded UTF-8 string.
 */
function decodeBase64Url(input) {
	const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
	const bytes = Buffer.from(padded, "base64");
	return bytes.toString("utf8");
}

/**
 * Serve the built-in local mermaid renderer:
 * GET /dsh-mermaid-image-preview/svg/<urlsafe-base64>[?theme=dark] -> SVG
 * @param req - Node IncomingMessage.
 * @param res - Node ServerResponse.
 */
async function renderRouteHandler(req, res) {
	const url = new URL(req.url, "http://localhost");
	// The body is chosen entirely by the request, so never let a browser
	// second-guess the declared Content-Type.
	res.setHeader("X-Content-Type-Options", "nosniff");
	const match = ROUTE_PATTERN.exec(url.pathname);
	if (match === null) {
		res.statusCode = 404;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end(`Not found. Use ${LOCAL_RENDER_PATH}/svg/<urlsafe-base64>[?theme=dark]`);
		return;
	}
	const code = decodeBase64Url(match[1]);
	if (code.trim() === "") {
		res.statusCode = 400;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end("Empty diagram");
		return;
	}
	const dark = url.searchParams.get("theme") === "dark";
	try {
		const svg = await renderLocal(code, dark);
		res.statusCode = 200;
		res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
		res.setHeader("Cache-Control", "no-store");
		res.end(svg);
	} catch (e) {
		res.statusCode = 400;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end(`Render failed: ${String(e && e.message || e)}`);
	}
}

/**
 * Inject the boot globals and register the local render route when the
 * optional Host HTTP service is composed. The local route is registered only
 * when local rendering is enabled - with `enableLocalRender: false` the
 * browser skips it entirely, so no route is mounted.
 * @param ctx - Host context that may acquire the webServer service.
 * @param config - row config from cordis.patch.yml (may carry enableLocalRender / fallbackRenderUrl / enableFallback).
 */
export function apply(ctx, config) {
	const enableLocalRender = resolveEnableLocalRender(config);
	ctx.inject(["webServer"], (httpCtx) => {
		httpCtx.effect(() => httpCtx.webServer.tapIndex((html) => injectBootGlobals(html, enableLocalRender, resolveFallbackRenderUrl(config), resolveEnableFallback(config))), "@baconbao/dsh-mermaid-image-preview: boot globals bootstrap");
		if (enableLocalRender) {
			httpCtx.effect(() => httpCtx.webServer.register({
				kind: "prefix",
				path: LOCAL_RENDER_PATH,
				handler: renderRouteHandler,
			}), "@baconbao/dsh-mermaid-image-preview: local render route");
		}
	});
}
