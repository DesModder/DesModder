# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Harcdoded in the Typescript:
# [pluginID]-name = Name
# [pluginID]-desc = Description
# [pluginID]-opt-[optionKey]-name = Option Name
# [pluginID]-opt-[optionKey]-desc = Option Description

## General
menu-learn-more = Learn more
menu-desmodder-plugins = DesModder Plugins
menu-desmodder-tooltip = DesModder Menu

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = Render implicits on the GPU. Disabled on tab reload. Can cause the UI to slow down or freeze in rare cases; reload the page if you have issues.
GLesmos-label-toggle-glesmos = Render with GLesmos
# Missing: error messages

## Tips
show-tips-name = Show Tips
show-tips-desc = Show tips at the bottom of the expressions list.
# Missing: all tips. Is it worthwhile?

## Text Mode
text-mode-name = Text Mode BETA
text-mode-desc = Expect bugs. Temporary documentation:
text-mode-toggle = Toggle Text Mode
# Missing: error messages

## Debug Mode
debug-mode-name = Debug Mode
debug-mode-desc = Show expression IDs instead of indices

## Find and Replace
find-and-replace-name = Find and Replace
find-and-replace-desc = Adds a "replace all" button in the Ctrl+F Menu to let you easily refactor variable/function names.
find-and-replace-replace-all = replace all

## Wolfram To Desmos
wolfram2desmos-name = Wolfram To Desmos
wolfram2desmos-desc = Lets you paste ASCII Math (such as the results of Wolfram Alpha queries) into Desmos.
wolfram2desmos-opt-reciprocalExponents2Surds-name = Radical Notation
wolfram2desmos-opt-reciprocalExponents2Surds-desc = Converts fractional powers less than one to a radical equivalent (surd)
wolfram2desmos-opt-derivativeLoopLimit-name = Expand Derivatives
wolfram2desmos-opt-derivativeLoopLimit-desc = Expands the nth derivative of Leibniz notation into repeated derivatives (limited to 10).

## Pin Expressions
pin-expressions-name = Pin Expressions
pin-expressions-desc = Pin expressions from Edit List mode
pin-expressions-pin = Pin
pin-expressions-unpin = Unpin

## Builtin Settings
builtin-settings-name = Calculator Settings
builtin-settings-desc = Lets you toggle features built-in to Desmos. Most options apply only to your own browser and are ignored when you share graphs with others.
builtin-settings-opt-advancedStyling-name = Advanced styling
builtin-settings-opt-advancedStyling-desc = Enable label editing, show-on-hover, text outline, and one-quadrant grid
builtin-settings-opt-graphpaper-name = Graphpaper
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = Author features
builtin-settings-opt-authorFeatures-desc = Toggle hidden folders, toggle readonly, and more
builtin-settings-opt-pointsOfInterest-name = Show points of interest
builtin-settings-opt-pointsOfInterest-desc = Intercepts, holes, intersections, etc.
builtin-settings-opt-trace-name = Trace along curves
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = Show Expressions
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = Show Zoom Buttons
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-expressionsTopbar-name = Show Top Bar
builtin-settings-opt-expressionsTopbar-desc = {""}
builtin-settings-opt-border-name = Border
builtin-settings-opt-border-desc = Subtle border around the calculator
builtin-settings-opt-keypad-name = Show keypad
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-qwertyKeyboard-name = QWERTY Keyboard
builtin-settings-opt-qwertyKeyboard-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = Duplicate Expression Hotkey
duplicate-expression-hotkey-desc = Type Ctrl+Q or Ctrl+Shift+Q to duplicate the selected expression.

## Right Click Tray
right-click-tray-name = Right Click Tray
right-click-tray-desc = Allows you to right click the settings bubble (style circle) to open the settings tray instead of having to hold left click.

## Set Primary Color
set-primary-color-name = Set Primary Color
set-primary-color-desc = Choose the primary color for the user interface
set-primary-color-opt-primaryColor-name = Primary Color
set-primary-color-opt-primaryColor-desc = Primary color across the calculator
set-primary-color-opt-doFavicon-name = Update Site Icon
set-primary-color-opt-doFavicon-desc = Toggle updating the site icon

## Hide Errors
hide-errors-name = Hide Errors
hide-errors-desc = Click error triangles to fade them and hide suggested sliders.
hide-errors-hide = hide

## Folder Tools
folder-tools-name = Folder Tools
folder-tools-desc = Adds buttons in edit-list-mode to help manage folders.
folder-tools-dump = Dump
folder-tools-merge = Merge
folder-tools-enclose = Enclose

## Video Creator
video-creator-name = Video Creator
video-creator-desc = Lets you export videos and GIFs of your graphs based on actions or sliders.
video-creator-menu = Video Creator Menu
video-creator-to = to
video-creator-step = , step
video-creator-prev-action = Prev
video-creator-next-action = Next
video-creator-size = Size:
video-creator-step-count = Step count:
video-creator-target-same-pixel-ratio = Target same pixel ratio
video-creator-target-tooltip = Adjusts scaling of line width, point size, label size, etc.
video-creator-ffmpeg-loading = FFmpeg loading...
video-creator-ffmpeg-fail = If this doesn't work in the next few seconds, try reloading the page or reporting this bug to DesModder devs.
video-creator-exporting = Exporting...
video-creator-cancel-capture = Cancel
video-creator-cancel-export = Cancel
video-creator-capture = Capture
video-creator-preview = Preview
video-creator-delete-all = Delete all
video-creator-filename-placeholder = set a filename
video-creator-export = Export
video-creator-export-ff = Export (Warning: currently unreliable/slow in Firefox)
video-creator-export-as = Export as { $fileType }
video-creator-fps = FPS:
video-creator-method-once = once
video-creator-method-slider = slider
video-creator-method-action = action

## Shift+Enter Newline
shift-enter-newline-name = Shift+Enter Newline
shift-enter-newline-desc = Use Shift+Enter to type newlines in notes and image/folder titles.

## Performance Display
performance-info-name = Performance Display
performance-info-desc = Displays information about the performance of the current graph.
