Overview of header modification:

The manifest specifies that `https://*.desmos.com/*` can be modified, and it loads the ruleset `net_request_rules.json` through the [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest) API.

The ruleset `net_request_rules.json` modifies the headers on Desmos URLs to include:

- `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` to [enable SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), necessary for ffmpeg.wasm for video-creator export
  - Only the resource types `main_frame` and `script` are included here as a minimal set. If more are needed, see the [full list of resource types](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType)
- `Cross-Origin-Resource-Policy: cross-origin` is necessary to permit loading thumbnail images through `saved-work.desmos.com` from `www.desmos.com`
