# DesModder Changelog

The following guide describes changes in each version, including how to migrate graphs from earlier versions to later versions if necessary.

Regarding version numbers: The `1.0` release will be when the plugin API is a bit more stable. While in `0.*` releases, I increment the minor number if a new plugin is added and the patch number if a release consists only of bug fixes and enhancements.

## 0.5.0

Emergency bug fix because tickers got released, breaking some DesModder features because simulations were removed. Do not expect all features to work.

## 0.4.1

Improvements and Bug Fixes:

- (Video Creator) Fix bug where screenshot capture is distorted when the x and y axes have different scales
- (Video Creator) Fix bug where simulations did not capture for more than a few frames
- (Video Creator) Warning if FFMpeg cannot load, preventing someone from wasting time in capturing only for ffmpeg not to load
- (Pin Expressions) Pinned expressions are now visible, even when a parent folder is collapsed
- (Pin Expressions) Styling of pinned expressions tweaked to align with existing elements
- (Wolfram To Desmos) Pasting URLS and subscript braces such as `a_{0}.x` no longer breaks the output
- (Wolfram To Desmos) Fix rare condition where Wolfram To Desmos would enter an infinite loop
- (Improved Duplication) Add the duplicate icon for non-expressions such as folders

## 0.4.0

New features:

- Pin expressions (only visible for DesModder users)
- Click on the DesModder extension icon to open a new graph
- Shift-Enter for newlines in notes and titles of images/folders

Improvements and Bug Fixes:

- Pillbox buttons no longer cover up the expressions when graphpaper is disabled
- (Builtin Settings) Extension no longer overrides query parameters such as [?nographpaper](https://www.desmos.com/calculator?nographpaper)
- (Duplicate Hotkey) You can duplicate folders, images, and more using Ctrl+Q while selecting them
- (Wolfram To Desmos) Improvements in handling pasted tables and more
- (Video Creator) Prevent screenshot from capturing before simulation tick
- (Video Creator) Prevent starting a new export while exporting
- (Video Creator) Avoid long simulations extending off the right of the screen
- (Video Creator) Default export type to mp4 because GIF is bad
- (Video Creator) Improve GIF palette generation
- Many under-the-hood improvements

## 0.3.2

Improvements and Bug Fixes:

- Narrow scope of the COEB override, which previously broke sites like teacher.desmos.com under the same domain name but which are not the calculator
- Clarify descriptions of the builtin-settings plugin
- Remove git submodules, which should make development easier

## 0.3.1

Improvements and Bug Fixes:

- Save plugin settings in chrome storage
- Fix two bugs related to the placement of pillbox buttons and popover
- (Wolfram2Desmos) Initialize immediately, and allow disabling the plugin
- (Bultin Settings) disable administerSecretFolders by default
- (Video Creator) Add APNG export support
- (Video Creator) Allow custom screenshot sizes

## 0.3.0

Adds dev plugins:

- Calculator Settings
- Right Click Tray

Improvements and Bug Fixes:

- (Video Creator) Add <kbd>Delete All</kbd> button
- (Video Creator) Reduce memory usage
- (Video Creator) Fix sliders for Greek variables and variables with subscripts
- (Find and Replace) Include polar & parametric bounds in replacements
- Many more!

Plugin API:

- Allow easily creating pillbox popovers like the main DesModder settings or in Video Creator
- Now require plugin IDs

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
