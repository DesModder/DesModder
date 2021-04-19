# DesModder Changelog

The following guide describes changes in each version, including how to migrate graphs from earlier versions to later versions if necessary.

Regarding version numbers: The `1.0` release will be when the plugin API is much more stable than it is now. While in `0.*` releases, I increment the minor number if a new plugin is added and the patch number if a release consists only of bug fixes and enhancements.

## 0.2.0

Adds dev plugins:

 - Video Creator

No graph-dependency plugins are included.

Bug fixes:

 - Load correctly even if `Calc.controller` takes longer to be defined (#12)
 - Rework of find-replace UI to deal with breaking change introduced by Desmos modifying that interface (looks cleaner now)
 - Many minor UI changes

Plugin API:

 - Broaden `Calc` interface
 - Add a few components including `Button`, `SegmentedControl`, and `SmallMathQuillInput`

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
