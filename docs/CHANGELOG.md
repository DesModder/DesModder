# DesModder Changelog

The following guide describes changes in each version, including how to migrate graphs from earlier versions to later versions.

## 0.1.0

First release. As this is an `0.*` release, expect features to change drastically in later releases.

Includes dev plugins:

 - Duplicate Expression Hotkey
 - Wolfram2Desmos
 - Find and Replace

No graph-dependency plugins are included.

API:
 - `window.DesModder.registerPlugin` is exposed to allow plugins to be registered in Tampermonkey userscripts, but consider it unstable for now.
 - other properties of `window.DesModder` should not be accessed.
