---
name: userscripts
description: Write, review, or fix userscripts and userstyles for the Userscripts Safari extension (quoid/userscripts) — JavaScript (.user.js) and CSS (.user.css) files with a userscript metadata block, using @match/@include rules, @grant, @inject-into, @run-at, and the GM_/GM API (GM.xmlHttpRequest, GM.setValue, GM.addStyle, GM.info, etc.). Use when the user asks to write a script for Safari, a userscript for the Userscripts extension, automate/modify a webpage in Safari (iOS or macOS), or convert a Tampermonkey/Violentmonkey/Greasemonkey script for Userscripts Safari compatibility.
whenToUse: User asks to create/edit/debug a userscript or userstyle for Safari's Userscripts extension, or to make a webpage behave differently in Safari. Also when the target is a .user.js / .user.css file or when GM_/GM APIs appear in code under this project.
---

# Writing Scripts for Userscripts (Safari)

Userscripts (https://github.com/quoid/userscripts) is an open-source userscript manager that runs as a Safari Web Extension on **macOS and iOS/iPadOS**. Scripts are plain `*.user.js` (JavaScript) or `*.user.css` (CSS) files stored in a local save directory. There is no built-in network; all fetching of remote scripts/resources is the extension's job.

## First Principles

- A script only runs when its metadata block has **at least one `@match` or `@include`** that matches the page URL. Scripts without either never run.
- Only **http/https** URLs are supported (`@match` on `ftp:`/`file:` etc. is ignored).
- `@grant` is permissive-based: only the API methods you list are provided. **If no `@grant` lines exist, `none` is assumed.** If you write `@grant none` together with real grants, `none` wins.
- GM APIs are only available when the script is injected into the **content scope** (`@inject-into content` or `auto`). Scripts injected into `page` scope cannot use any `GM.*` method — use plain `fetch`/`XMLHttpRequest` there.
- All `GM.*` methods are **async** (Promise-based) unless noted. Use `await` or `.then`.
- `.user.css` files are stylesheets; they cannot run JavaScript and use plain CSS (optionally `@-moz-document`-style scoping is NOT a Userscripts feature — scope by `@match`/`@include` metadata instead).

## File & Metadata Format

Files live in the save location (macOS default: `~/Library/Containers/Userscripts/Data/Documents/scripts`). A `.user.js` file:

```js
// ==UserScript==
// @name         My Script
// @description  What it does
// @match        https://example.com/*
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(async () => {
  'use strict';
  const saved = await GM.getValue('myKey', 'default');
  // ...page logic...
})();
```

### Supported Metadata Keys (v4.x)

| Key | Meaning / Rules |
|---|---|
| `@name` | Display name + filename. Must be unique per file type in the directory. |
| `@description` | Shown in the sidebar. |
| `@icon` | No UI function, but its first value is exposed via `GM.info`/`GM_info`. |
| `@match` | Domain match patterns (MDN WebExtension match pattern structure). Repeatable. **http/https only.** |
| `@exclude-match` | Domain patterns where the script must NOT run. |
| `@include` | URL matching by globs and regex (Greasemonkey include/exclude rules). Repeatable. |
| `@exclude` | Like `@include` but prevents injection on match. |
| `@inject-into` | Injection context: `auto` (default), `content`, or `page`. **GM APIs require `content`/`auto`.** |
| `@run-at` | Timing: `document-start`, `document-end` (default), `document-idle`. **JS only.** |
| `@weight` | Integer 1–999, higher = earlier injection; orders scripts relative to each other. Non-integers ignored. |
| `@require` | Remote resource URL, must match the script's file type (JS for JS, CSS for CSS). Downloaded once at save; never re-fetched or updated unless removed and re-added. **Never trust untrusted remote resources.** |
| `@version` | Version string; only meaningful with `@updateURL`. |
| `@updateURL` | URL (`.meta.js` path) checked for newer versions; only meaningful with `@version`. |
| `@downloadURL` | URL (`.user.js` path) to download updates from; needs both `@version` and `@updateURL`. |
| `@noframes` | Takes no value; prevents injection into nested frames. |
| `@grant` | One API per line; controls which GM APIs are provided. Default `none`. |

Other common Tampermonkey keys (`@namespace`, `@author`, `@license`, `@homepageURL`, `@supportURL`, `@connect`, `@antifeature`, `@unwrap`, `@sandbox`, `@resource`) are **not** listed as supported — do not rely on them. `@namespace` is still exposed in `GM.info.script.namespace` if present.

### Match Pattern Rules (MDN structure)

- `<scheme>://<host><path>`, e.g. `https://example.com/*`, `http://localhost:3000/*`.
- `*` in host matches any subdomain: `*://*.example.com/*`.
- Use `*://example.com/*` to cover http and https.
- `@match` is exact-path-based — a script matching `https://example.com/` will NOT run on `https://example.com/foo`; end the path with `/*`.
- For loose URL matching (query strings, fuzzy prefixes) prefer `@include` with globs: `@include /^https?://example\.com\/.*/` or `@include https://example.com/*`.

## GM / GM_ API (content scope only)

Available by `@grant`-ing the method name (e.g. `@grant GM.setValue`). All return Promises.

| API | Description |
|---|---|
| `GM.addStyle(css)` | Inject CSS into the page. |
| `GM.setValue(key, value)` | Persist a JSON-serializable value. |
| `GM.getValue(key, defaultValue?)` | Read a value; returns `defaultValue` or `undefined` when unset. |
| `GM.deleteValue(key)` | Delete a stored value. |
| `GM.listValues()` | Array of currently set key names. |
| `GM.getTab()` | Tab-persistent data. **Deprecated, removed in v6.0** (issue #667). |
| `GM.saveTab(tabObj)` | Save tab-persistent data. **Deprecated, removed in v6.0** (issue #667). |
| `GM.openInTab(url, openInBackground=false)` | Open URL in a new tab; resolves with tab data. |
| `GM.closeTab(tabId?)` | Close a tab (default: caller tab). |
| `GM.setClipboard(data, type="text/plain")` | Copy text to clipboard. **Deprecated, removed in v6.0** (issue #655). |
| `GM.info` / `GM_info` | Script info — always available, **no grant needed**. See shape below. |
| `GM.xmlHttpRequest(details)` | Cross-origin XHR with full event handlers; returns a Promise that also has `.abort()`. |
| `GM_xmlhttpRequest(details)` | Legacy variant; returns `{ abort() }` only (no awaitable promise). |

### GM.info shape

```js
GM.info.scriptHandler          // "Userscripts"
GM.info.version                // Userscripts app version
GM.info.scriptMetaStr          // full metadata block string
GM.info.script = {
  description, "exclude-match": [], excludes: [], grant: [], includes: [],
  "inject-into", matches: [], name, namespace, noframes, require: [],
  resources: [] /* not implemented */, "run-at", version /* script version */
}
```

### GM.xmlHttpRequest details

```js
const xhr = GM.xmlHttpRequest({
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Accept': 'application/json' },
  timeout: 10000,
  responseType: 'json',
  onload: (res) => console.log(res.status, res.response),
  onerror: (res) => console.error('failed', res),
});
// xhr.abort();            // abort mid-flight
// const res = await xhr;  // or await the promise directly
```

Details object: `url` (required), `method` (default GET), `user`, `password`, `headers`, `overrideMimeType`, `timeout`, `data` (String/Blob/ArrayBuffer/TypedArray/DataView/FormData/URLSearchParams), `responseType`, `binary` (deprecated). Response objects expose `readyState`, `response`, `responseHeaders`, `responseType`, `responseURL`, `status`, `statusText`, `timeout`, and `responseText` (when responseType is text). Upload events (`onload`, `onprogress`, …) receive `{lengthComputable, loaded, total}`.

## Workflow for Writing a Script

1. **Identify the target pages** from the user's description or a provided URL; if a URL is given, inspect the page structure before writing selectors/logic.
2. **Pick the matching strategy**:
   - Whole site: `@match *://*.example.com/*`
   - Specific paths: `@match https://example.com/some/page/*`
   - Query-string/fuzzy URLs: `@include` globs or regex.
   - Avoid over-broad matches; add `@exclude-match` for known exceptions.
3. **Write the metadata block** first: `@name`, `@description`, `@match` (required), `@grant` lines (only what you use), `@run-at` when timing matters, `@inject-into content` when using GM APIs, `@noframes` for top-frame-only behavior.
4. **Write page logic** in an IIFE or `async` wrapper. Prefer `document-start` + `MutationObserver` for early DOM changes; use `document-idle` for simple post-load tweaks.
5. **Use GM APIs for cross-origin requests and persistence** instead of page `fetch` when the site's CSP or CORS blocks you.
6. **Keep the save location / file discipline** in mind (see below).

## CSP & Injection Context Notes (Common Failure Mode)

Safari blocks content scripts when the site has a strict Content Security Policy ("Refused to execute a script" errors). Mitigations, in order:

- Set `// @inject-into auto` (default) — Userscripts attempts to circumvent strict CSPs automatically.
- If that fails, set `// @inject-into content` explicitly.
- `page` injection is a last resort for CSP-heavy sites, but **GM APIs are unavailable in page scope** — write the script to avoid them (plain `fetch`, `localStorage`, etc.).
- Document this tradeoff to the user instead of silently switching contexts.

## Saving, Installing & Testing Notes

- New/changed files only take effect after the extension **popup has been opened and fully loaded** at least once (Safari extension state refresh).
- macOS default save dir: `~/Library/Containers/Userscripts/Data/Documents/scripts`. iOS uses the directory set in the companion app (iCloud folders work but can be slow/evicted — since macOS 15/iOS 18 enable "keep downloaded").
- `@require` files are stored in `~/Library/Containers/Userscripts/Data/Documents/require/` — never edit those or the manifest manually.
- Remote install: a URL whose **path** ends in `.user.js` (not in query/hash) triggers an install prompt in the popup.
- Changes are picked up from any external editor; the popup must still be opened once after edits.

## Common Pitfalls

- Forgetting `@match`/`@include` → script never runs.
- Granting APIs but injecting into `page` scope → GM undefined errors.
- Using `@grant none` together with grants → `none` wins, APIs missing.
- Relying on unsupported metadata keys (`@connect`, `@resource`, `@sandbox`…) → silently ignored; use `GM.xmlHttpRequest` instead of `@connect`-style permissions.
- Blocking on `GM_xmlhttpRequest` with `await` — it returns `{abort}`, not a Promise; use `GM.xmlHttpRequest` for awaitable style.
- Matching `https://example.com/` exactly but visiting subpages → nothing runs; use `/*` paths.
- Forgetting the file extension `.user.js`/`.user.css` in the save directory → not recognized.

## Reference

- Project README (metadata + API, per-version docs): https://github.com/quoid/userscripts
- API type definitions: https://github.com/userscriptsup/testscripts/blob/f2fcde4b556fa436fe806a44a89afb9eb5dccd0b/userscripts/types.d.ts
- Match patterns: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns
- Include/exclude rules: https://wiki.greasespot.net/Include_and_exclude_rules
- Violentmonkey metadata reference (behavioral parity for `@inject-into`/`@run-at`): https://violentmonkey.github.io/api/metadata-block/
