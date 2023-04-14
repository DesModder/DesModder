# DesModder Changelog

## 0.10.3

New: translations for French!

Bug fixes and improvements:

- Fancier title for popover menus (DesModder menu, Video Creator menu, Performance View menu)
- Allow vertical scrollbar for the popover menus
- Divide plugins into categories on the main menu
- Automatically re-enable plugins when version is updated
- (Better Evaluation View) Use horizontal scrollbar instead of overflowing output
- (Video Creator) Fix bug where the previewed frame would "jump around"
- (Find and Replace) Fix bug where replacements would not work on tables
- (Text Mode) Fix initialization error
- (Text Mode) Fix ticker overflow visual issue

## 0.10.2

Fix GLesmos loading error.

## 0.10.1

Internal fixes.

## 0.10.0

New features:

- Better Evaluation View plugin
- (GLesmos) Now supports lines (outlines)
- (Video Creator) Support capturing all moving sliders simultaneously

Bug fixes and improvements:

- (GLesmos) Rescale brightness to allow reaching pure white
- (GLesmos) No longer breaks when toggled off then on
- (GLesmos) Some list bugs fixed
- (Set Primary Color) Styling improvements
- (Wolfram to Desmos) Fix radical notation
- (Folder Tools) Merge next folder if no expressions are between
- (Video Creator) FFmpeg load can no longer be circumvented by toggling the menu
- (Video Creator) Fixes defaulting video export name to graph title
- Internal stability improvements

## 0.9.3

Bug fixes and improvements:

- Various internal stability improvements
- Faster loading time
- Show a message if WakaTime secret key is wrong

## 0.9.2

Fixes another race condition preventing loading under certain conditions.

## 0.9.1

Fixes a loading race condition introduced by the previous release.

## 0.9.0

Another emergency bugfix; fixes the loading error.

Also comes with some performance improvements from an overhaul of the patching system.

## 0.8.7

Emergency bugfix after Desmos changed a bunch of internals.

- Fixes Video Creator, WakaTime, and GLesmos

## 0.8.6

- Fix various WakaTime bugs
- Allow configuring WakaTime project name

## 0.8.5

Bug fixes:

- (WakaTime) Fix heartbeats in Firefox

## 0.8.4

New features:

- WakaTime plugin

Bug fixes and improvements:

- (Video Creator) Fix UI bugs that prevented capture
- (Video Creator) Fix mp4 0-byte export
- (GLesmos) Cache compiled shaders: huge performance gain
- (GLesmos) Clamp fill opacity between 0 and 1
- (GLesmos) Fix two-argument sort when the lists are different lengths
- (GLesmos) Fix lists in piecewise expressions
- (Tip) Widen tips when the expression list is wide

## 0.8.3

Bug fixes:

- (GLesmos) No longer freeze the UI when enabled
- (GLesmos) Lists of points now work properly
- (Text Mode) Fix some edge cases with piecewises

## 0.8.2

Bug fix:

- (Video Creator) Actually fix inline math inputs

## 0.8.1

New features:

- Performance Display plugin

Bug fixes and improvements:

- (Video Creator) Fix inline math inputs
- (Text Mode) Decrease unary minus precedence below exp
- (Tips) New tips
- (Calculator Settings) Follow Desmos rename to "Author features" where appropriate
- (Pin Expressions) Fill outside of bookmarks, following readonly button style
- Prepare translations support

## 0.8.0

New features:

- Text Mode plugin (beta)

Bug fixes and improvements:

- (Video Creator) Exported mp4s on Ubuntu and some Mac are no longer zero bytes
- (Set Primary Color) Fix various styling issues
- (Set Primary Color) Fix wrong favicon when plugin is disabled
- (Find and Replace) Ctrl+F once again works when the expressions list is unfocused
- (GLesmos) Naming collisions (including `round`) avoided
- (GLesmos) `median` function implemented

## 0.7.3

Emergency bug fix because Desmos removed the `parser` module in favor of `core/math/parser`

Bug fixes and improvements:

- Fix `Uncaught Error: No parser/parser` on load
- (GLesmos) Fix infinity literals

## 0.7.2

New features:

- Set Primary Color plugin
- Always disable GLesmos on page load

Bug fixes and improvements:

- Fix colors that became invisible after the blue update
- (GLesmos) Proper list support, including `max` and `min`
- (GLesmos) Add `erf` implementation
- (Video Creator) Fix media type for non-mp4s
- (Video Creator) Fix mp4 export chroma (yuv420p)
- (Video Creator) Default video export name to graph title
- (Duplicate Hotkey) Fix duplicate hotkey for folders
- (Builtin Settings) Remove lock viewport to avoid duplication
- (Folder tools) Merge past secret folders

## 0.7.1

This version is released only for Firefox as the first Firefox build.

## 0.7.0

New features

- GLesmos: use the GPU to render implicits via GLSL. Disabled by default: enable through the plugins list.

Bug fixes and improvements:

- (Find and Replace): handle list comprehensions better
- (Hide Errors): replace left-click on triangle with shift-left-click
- (Hide Errors): add "hide" button after suggested sliders
- (Folder Tools): fix undo-redo stack
- (Tips): new tips
- (Tips): move through tips in a stable order instead of random
- (Improved Duplication → Duplicate Hotkey) cede control of duplication to new vanilla duplication
- (Core) fix Desmos loading in iframes

## 0.6.1

Bug fixes and improvements:

- Pressing down arrow no longer moves the cursor to the bottom of the expressions list
- Duplicating an expression now duplicates the associated metadata, such as pinned status or whether errors/sliders are hidden
- (Wolfram To Desmos) Fix pasting of piecewises that contain division at the end of the condition

## 0.6.0

New features

- Folder tools: dump a folder, merge a folder with subsequent unfoldered expressions, and convert a note into a table
- Click on a warning triangle (or press shift+enter) to fade the warning and hide sliders
- Show tips at the bottom of the expressions list. Hover to reveal more detail, and click for a new tip.
- Debug mode: Replace expression indices with their internal IDs

Bug fixes and improvements:

- The DesModder settings icon now uses the DesModder logo instead of a generic cogwheel. This change was made to avoid confusion with the edit-list-mode cogwheel settings icon
  - This change is more important in nographpaper mode
- (Video Creator) Allow cancelling video export
- (Video Creator) Let long action preview scroll horizontally instead of overflowing the popover
- (Wolfram to Desmos) Fix pasting of piecewises, `mod`, and `abs` under certain conditions
- (Improved Duplication) Headers in duplicated tables now keep the same root as the original table
- (Improved Duplication) Duplicated folders are now placed after the original folder
- (Improved Duplication) Table header subscripts are now correctly enclosed when longer than one digit
- (Find and Replace) Fix error when a double inequality is present during a find-and-replace
- (Pin expressions) Deleting the last pinned expressions now correctly removes the pinned expressions style

## 0.5.1

Adds back the pin-expressions and duplicate-expression-hotkey plugins

Other improvements:

- (Video Creator) Action capture added (including a step count latex)
  - The old "while" latex from simulations can be replicated using action capture, which will pause if the action variable is undefined: [example](https://www.desmos.com/calculator/zsz8dwcp3j).

Fixes bugs introduced by 0.5.0 and the action release:

- (Find Replace) Now works inside tickers
- (Builtin Settings) No longer lets you toggle clickableObjects (simulations)
- (Video Creator) Slider capture no longer crashes immediately

Intentionally adds back the following issue because its previous fix is unmaintainable:

- (Pin Expressions) Using up/down arrows when expressions are pinned can cause some jumping around ([#149](https://github.com/DesModder/DesModder/issues/149))

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
