# DesModder Changelog

## 0.15.0

New features:

- New plugin: Quake pro. Increase field-of-view extra wide in 3D.
- (Video Creator) Reflect "reverse contrast" mode in captures.

Bug fixes and enhancements:

- (Better Evaluation View) Fix display of various types, such as lists of polygons.
- (Better Evaluation View) Fix display of `\infty i`.
- (Video Creator) Fix mosaic capture.
- (Video Creator) Fix horizontal overflow of long actions in the capture menu.
- (Syntax Highlighting) Fix styling of "add base case" suggestion in some cases.
- (Pin Expressions) Fix ordering of pinned expressions and tickers after search bar closed.
- (Code Golf) Keep code golf display under dropdowns like "cumulative probability."
- (Hide Errors) Only hide errors with shift-enter if the selected expression currently has an error.

Translations:

- Updates to Japanese and Spanish translations.
- Reflect the reality that GLesmos is no longer disabled on page reloads.

## 0.14.9

Bug fixes:

- (Wolfram to Desmos) No longer prevent copying a whole folder.
- (GLesmos) Fix replacement error.

Translations:

- Updates to Chinese translations (zh-CN).

## 0.14.8

Bug fixes:

- (Better Evaluation View) Stop crashing the page when a '0' is rendered when plugin is off.

## 0.14.7

New features:

- (Better Evaluation View) Allow toggling 'Advanced Floating Point' (previously always on, now default off).

Bug fixes and tweaks:

- (Compact View) Apply math font size to the ticker.
- (Paste Image) Don't paste images into secret folders like the metadata folder.
- (Better Evaluation View) Don't use 'Advanced Floating Point' when plugin is off.
- (Better Evaluation View) Disable 'Show List Elements' for new installs by default.

## 0.14.6

New features:

- (Video Creator) Support exporting as WebP, an image format that happens to support video, similar to APNG and GIF.

Bug fixes:

- Fix coloring of the pillbox buttons.
- (Better Evaluation View) Show points in lists as points rather than complex.
- (GLesmos) Fix replacement error
- (Syntax Highlighting) Do not highlight inside base case suggestions.

Translations:

- Updates to Japanese translations.

## 0.14.5

New features:

- (Better Navigation) Add "Show Scrollbar" toggle when "Scrollable Expressions" is enabled.

Bug fixes:

- Fix broken replacements affecting Code Golf, GLesmos, Text Mode, and other plugins.

Translations:

- Updates to Spanish translations.

## 0.14.4

Bug fixes

- Fix broken replacements that removed the opacity and line width options in some situations.
- Fix broken replacements affecting GLesmos, Better Evaluation View, and other plugins.

## 0.14.3

Bug fixes

- Fix broken replacements affecting Intellisense, GLesmos, and other plugins.

Translations:

- Updates to Japanese translations.

## 0.14.2

New features:

- (Video Creator) Mosaic capture: Pick mosaic dimensions bigger than 1x1 to stitch together a large image from smaller captures.
  - Axis numbers may clutter the capture (disable in the wrench settings menu).
- (Calculator Settings) Add "Show Performance Meter" (once enabled, click the meter in the bottom-right to toggle modes).
- (Firefox) Click the DesModder icon to jump straight to the calculator. If it's not pinned to the toolbar, you can find it from the puzzle-piece "Extensions" button.

Bug fixes

- (Better Evaluation View) Fix broken replacements
- (GLesmos) Fix broken replacements
- (Compact View) Show folder toggles (visible from author features) when checked even if "Hide Folder Toggles" is checked.
- (Text Mode) Fix bug where style settings would sometimes be offset to the top of the page.
- (Text Mode) Persist the complex mode toggle.
- (Text Mode) Track 3d rotation slightly better.
- (Builtin Settings) Prevent soft-lock from disabling both graphpaper and expressions.
- (Find-Replace) Fix bug where Leibniz derivatives would be corrupted on find-replace.

## 0.14.1

Bug fixes

- Fix loading process in all calculators.
- (Intellisense) Fix bug where the number before an identifier could be deleted with auto-subscriptify enabled.
- (Intellisense) Include identifiers exported by tables or regressions
- (GLesmos) Tweak behavior of showing warning that GLesmos is required.
- (Video Creator) Avoid error message when a size field is empty.

## 0.14.0

New features:

- New plugin: Paste image. Copy-paste images into the calculator. Enabled by default.

Bug fixes:

- (Video Creator) Fix default filename detection.
- (Better Evaluation View) Show display for complex numbers. Note -0 and +0 are treated the same for complex numbers.
- (Code Golf) Fix replacement error.
- (Code Golf) Avoid warning when opening a graph with many folders.
- (Text Mode) Close expression tray when scrolling.
- Store DesModder metadata inside a note, instead of a note inside a folder.
- Merge DesModder metadata when pasting a link to a graph into another graph.
- Delete invalid DesModder metadata notes/folders (which can come from pasting-by-link when DesModder is disabled).

## 0.13.11

New features:

- (Compact View) Add "Hide Folder Toggles" when author features or advanced styling are enabled.

Bug fixes:

- Fixes a whole bunch of loading errors.
- (Intellisense) Sort suggestions by list order again.
- (Video Creator) Fix sizing when screenshot width is smaller than viewport width.
- (Video Creator) Stop playing when all frames are deleted.
- (Compact View) Default math size to the vanilla math size, instead of 10% bigger.

Translations:

- Major updates for Japanese: corrections and completeness
- Minor updates for Spanish

## 0.13.10

Breaking Changes:

- (Builtin Settings) Remove three settings: Border, QWERTY Keyboard, and Show Expressions Top Bar.

New Features:

- (Builtin Settings) Add "Show IDs" toggle.

Bug fixes:

- Fix missing text on all buttons.
- Fix styling of blue buttons.
- Fix Intellisense showing an empty list.
- Fix vertical offset on labels containing both math and text.

## 0.13.9

Breaking Changes:

- (Debug Mode) Remove Debug Mode plugin (use ?showIDs instead for now).

Enhancements:

- (Video Creator) Support labels in "fast captures" mode

Bug fixes

- Scroll version number along with rest of settings
- Fix CSS on toggle switches

## 0.13.8

Enhancements:

- (GLesmos) Don't disable on page reloads.
- (Video Creator) Add "fast screenshots" option in 2d calculators. The old approach (slow screenshots) will be removed eventually if there are no problems with "fast screenshots."

Bug fixes:

- (Hide errors) Fix bug where clicking doesn't work on error triangles.

## 0.13.7

Bug Fixes

- Fix error preventing GLesmos from being enabled
- Fix error breaking Better Evaluation View
- Fix CSS issue affecting transparent colors with Set Primary Color

## 0.13.6

Bug Fixes

- Fix CSS issues causing the expressions list to split in half.
- Fix CSS issues affecting Set Primary Color and other plugins.
- Fix bug where scrolling/zooming would jump to the selected expression when Video Creator was enabled.

## 0.13.5

Bug Fixes

- Prevent duplicate loading (such as might occur after an update in Firefox).
- Fix error from non-expression error triangles with hide-errors enabled.

## 0.13.4

Bug Fixes

- Fix Video Creator not loading.
- Fix shift-click on error triangle not working to hide errors.

## 0.13.3

Fix compatibility error preventing everything from loading.

## 0.13.2

Bug Fixes

- Fix crash on Firefox <=124.
- (Video Creator) Fix accidental scrolljacking when 3d scene spins.
- (Shift-Enter-Newline) Remove plugin since it is a vanilla feature now.

## 0.13.1

Bug Fixes

- (Video Creator) Fix text wrapping in some buttons in Japanese language.
- (Video Creator) The "cancel" button now always works, even when capturing a slow frame.
- (Performance View) Keep undo/redo history after using Refresh Graph
- On a panic ("DesModder loading errors manager"), the home link at the top is now clickable.
- Fix replacement error

## 0.13.0

Bug Fixes

- (Text Mode) Fix error when opening Text Mode.
- (Intellisense) Fix typing a "." after a subscript in some cases.
- (Intellisense) Handle keys like "enter" even when Multiline or better Navigation are enabled.
- (Intellisense) Show operatornames like "sin()" correctly instead of "n()."
- (Right Click Tray) Close existing tray before opening a new one.
- (Find-Replace) Avoid overwriting exponents in some cases.

## 0.12.9

Internal fix to avoid replacement error.

## 0.12.8

GLesmos now uses Desmos's GLSL compiler:

- Fixes many graphs where GLesmos would previously give an error.
- Improves performance in some GLesmos plots that depend on moving sliders.
- Some GLesmos plots may be slower.

## 0.12.7

Bug Fixes:

- (Core) Fix bug where menus could overlap.
- (Text Mode) Persist u,v,r,phi bounds in 3d.

## 0.12.6

New Features:

- (Text Mode) Support more chaining (`1<x<y<z` and `x=y=z`)
- (Text Mode) Support interval comprehensions (`(a,a) for 1<a<3`)
- (Text Mode) Support list comprehensions without brackets.

Bug Fixes:

- (Find-Replace) Prevent empty string in "from" field.
- (Show Tips) Fix replacement error.

Translations:

- (Spanish) Updates for Video Creator.

## 0.12.5

New Features:

- (Video Creator) Control orientation when capturing in 3d.

Bug fixes:

- (More Greek Letters) Fix breakage of "rho" in 3d.
- (Video Creator) Show progress pie when exporting.
- (Text Mode) Fix restrictions producing errors.
- (Text Mode) Fix associativity of exponent.
- (Text Mode) Fix empty table conversion to Text Mode.
- (Find Replace) Fix bug where a space was missing between a command and a letter.
- (Find Replace) Apply replacements to 3D u/v/r/phi domains and some other scenarios.
- (Multiline) Map Ctrl+M to run multiline only, and not toggle muting.
- (Syntax Highlighting) Don't override textcolor specified in LaTeX.

## 0.12.4

Bug fixes:

- Fix replacement used for Text Mode and Pin Expressions.

## 0.12.3

Bug fixes:

- Fix pillbox buttons on [https://desmos.com/geometry](https://desmos.com/geometry).
- (Video Creator) Fix vertical stretching of captured frames in 3d.

## 0.12.2

Bug fixes:

- (Better Navigation) Fix Ctrl+Backspace not triggering a graph update.

## 0.12.1

Bug fixes:

- (Set Primary Color) Fix the hue for /calculator and /geometry.

## 0.12.0

New: support [https://desmos.com/3d](https://desmos.com/3d)!

New Features:

- Better Navigation plugin: use Ctrl+Arrow to jump along expression, and scroll expressions horizontally.
- Multiline: support manual newline insertion.

## 0.11.11

New Features:

- Syntax Highlighting Plugin
- Code Golf Plugin

Bug fixes:

- Fix Pillbox Buttons loading error.

Thanks to SlimRunner for his continued support on Spanish translations.

## 0.11.10

New Features:

- (Custom Mathquill Config) Option to reduce kerning of "f".
- (Text Mode) Press a button to auto-format; toggle whitespace and newlines.

Bug fixes:

- Fix sizing and spacing of pillbox buttons.

## 0.11.9

New: translations for Japanese!

Bug fixes and improvements:

- (GLesmos) Fix loading error.
- Add message in console explaining the unavoidable error.

## 0.11.8

New Features:

- (Intellisense) Auto-subscriptify

Bug fixes:

- (Custom MathQuill Config) Remove `nu` from "More greek letters"
- (Custom MathQuill Config) Error no longer happens when changing settings with a table on the page.
- (Pin Expressions) Fix loading error.
- (GLesmos) No longer re-renders highlighted expressions at the screen refresh rate
- (Text Mode) Fix loading issue.
- "Learn More" links now have color again.

## 0.11.7

Bug fixes:

- Fix loading on https://desmos.com/geometry
- (Text Mode) Show IDs instead of line numbers in debug mode

## 0.11.6

New Features:

- (Intellisense) Mark expressions as `@private`.
- (Intellisense) Fixes to update handling.
- (Text Mode) Enabled for https://desmos.com/geometry-beta.

Bug fixes:

- Various localization improvements.
- (GLesmos) Avoid crashing the whole page if WebGL canvas is unsupported.
- Flag `?nographpaper` no longer crashes the page.

## 0.11.5

Bug fixes:

- (GLesmos) Fix loading error.

## 0.11.4

Bug fixes:

- (GLesmos) Fix loading error.

## 0.11.3

New Features:

- Custom MathQuill Config plugin
- (Text Mode) absolute value with `|x|`

Bug fixes:

- (Video Creator) MP4s are now readable across most programs
- (Intellisense) Various edge case fixes

## 0.11.2

Bug fixes:

- (GLesmos) Fix loading error.

## 0.11.1

Bug fixes and improvements

- Disable Intellisense by default
- (Intellisense) Hide for fields that don't support graph variables
- (Intellisense) Close menu when expression is deleted
- Minor tweaks and bugfixes.

## 0.11.0

New Features:

- Intellisense plugin
- Multiline plugin
- Compact View plugin

Bug fixes and improvements:

- (Video Creator) Support ZIP export
- (Text Mode) Show style circles and expression footers
- (GLesmos) Fix canvas flashing when the plugin is enabled and disabled
- (Video Creator) Fix wand icon

## 0.10.7

Bug fixes and improvements:

- (GLesmos) Fix loading error.
- Internal improvements to handle future loading errors more gracefully

## 0.10.6

Bug fixes and improvements:

- Fix loading error
- (Text Mode) Show statement number instead of line number
- (Text Mode) Remove "else" from piecewises, moving closer to Desmos syntax

## 0.10.5

New: translations for Chinese (Simplified, PRC; zh-CN)

Bug fixes and improvements:

- Fix main loading error
- Show brief description of problem on loading error
- Collapse loading error menu by default
- Load CSS earlier, preventing interface "jumping"
- (Text Mode) Minimize parentheses emitted to LaTeX

## 0.10.4

New: translations for Spanish!

Enables DesModder for Geometry Beta.

Bug fixes and improvements:

- (GLesmos) Fix loading error
- (GLesmos) Warning text for "lines" is no longer too wide
- (Set Primary Color) Now works nicely with the Dark Reader extension
- (Text Mode) Your text does not get overwritten as you're writing it
- (Text Mode) Requires double-newlines between expressions
- (Text Mode) Reduced parentheses emitted to LaTeX
- (Text Mode) Many other fixes: most graphs should work the same after converting through Text Mode

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
