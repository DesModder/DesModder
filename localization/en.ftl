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

## Category names
category-core-name = Core
category-utility-name = Utility
category-visual-name = Visual
category-integrations-name = Integrations

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = Render implicits on the GPU. Disabled on tab reload. Can cause the UI to slow down or freeze in rare cases; reload the page if you have issues.
GLesmos-label-toggle-glesmos = Render with GLesmos
GLesmos-confirm-lines = Confirm lines
GLesmos-confirm-lines-body = GLesmos line rendering can be slow. Be careful, especially for a list of layers.
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
builtin-settings-opt-expressionsTopbar-name = Show Expressions Top Bar
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
right-click-tray-desc = Allows settings tray to be opened with a right click instead of holding left click on the settings bubble

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
video-creator-ticks-step = Time step (ms):
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
video-creator-export-as = Export as { $fileType }
video-creator-fps = FPS:
video-creator-method-once = once
video-creator-method-slider = slider
video-creator-method-action = action
video-creator-method-ticks = ticks

## Shift+Enter Newline
shift-enter-newline-name = Shift+Enter Newline
shift-enter-newline-desc = Use Shift+Enter to type newlines in notes and image/folder titles.

## Wakatime
wakatime-name = WakaTime
wakatime-desc = Track your desmos activity on WakaTime.com
wakatime-opt-secretKey-name = Secret Key
wakatime-opt-secretKey-desc = API Key used for WakaTime servers
wakatime-opt-splitProjects-name = Split Projects by Graph
wakatime-opt-splitProjects-desc = Store each graph as its own project instead of branches of a unified Desmos Project
wakatime-opt-projectName-name = Project name
wakatime-opt-projectName-desc = Visible from WakaTime, and shared for all Desmos projects

## Performance Display
performance-info-name = Performance Display
performance-info-desc = Displays information about the performance of the current graph.
performance-info-refresh-graph = Refresh Graph
performance-info-refresh-graph-tooltip = Refresh the graph to test initial load time
performance-info-sticky-tooltip = Keep menu open
performance-info-time-in-worker = Time In Worker
performance-info-compiling = Compiling
performance-info-rendering = Rendering
performance-info-other = Other

## Better Evaluation View
better-evaluation-view-name = Better Evaluation View
better-evaluation-view-desc = Displays list elements, colors, and undefined values
better-evaluation-view-opt-lists-name = Show list elements
better-evaluation-view-opt-lists-desc = Show list elements instead of list length
better-evaluation-view-opt-colors-name = Show colors
better-evaluation-view-opt-colors-desc = Show colors as rgb values
better-evaluation-view-opt-colorLists-name = Show lists of colors
better-evaluation-view-opt-colorLists-desc = Show lists of colors as lists of rgb values

## Pillbox Menus
pillbox-menus-name = Pillbox Menus (Core)
pillbox-menus-desc = Show the buttons on the right side, such as the Video Creator or DesModder main menu

## Manage Metadata
manage-metadata-name = Manage Metadata (Core)
manage-metadata-desc = Manage Metadata, such as GLesmos or pinned/unpinned status

## Intellisense
intellisense-name = Intellisense
intellisense-desc = Brings several common IDE features to Desmos, including autocompletion suggestions, function call help, and jump to definition. Documentation here:
intellisense-jump2def-menu-instructions = has multiple definitions. Pick one from below to jump to.

## Compact View
compact-view-name = Compact View
compact-view-desc = Offers a variety of options for condensing the UI so you can see more on the screen at once.
compact-view-opt-textFontSize-name = Text Font Size
compact-view-opt-textFontSize-desc = Size of the font in notes
compact-view-opt-mathFontSize-name = Math Font Size
compact-view-opt-mathFontSize-desc = Size of the font in mathematical expressions
compact-view-opt-bracketFontSizeFactor-name = Bracket Multiplier
compact-view-opt-bracketFontSizeFactor-desc = Text inside of brackets (parentheses, curly braces, etc.) decreases in size by this factor.
compact-view-opt-minimumFontSize-name = Min Font Size
compact-view-opt-minimumFontSize-desc = Minimum possible math font size (overrides Bracket Font Size Factor)
compact-view-opt-compactFactor-name = Remove Spacing
compact-view-opt-compactFactor-desc = Removes lots of empty space in the expressions list.
compact-view-opt-noSeparatingLines-name = No Separating lines
compact-view-opt-noSeparatingLines-desc = Removes the separating lines between expressions and replaces them with alternating colors.
compact-view-opt-highlightAlternatingLines-name = Highlight Alternating Lines
compact-view-opt-highlightAlternatingLines-desc = Highlights alternating expressions so that they can be easily distinguished from one another.
compact-view-opt-hideEvaluations-name = Collapse Evaluations
compact-view-opt-hideEvaluations-desc = Puts evaluations off to the side. They can be focused or hovered to be shown. 

## Multiline
multiline-name = Multiline Expressions
multiline-desc = Splits expressions onto multiple lines to better make use of available space. Can be done manually with Ctrl+M.
multiline-opt-widthBeforeMultiline-name = Width Threshold (%)
multiline-opt-widthBeforeMultiline-desc = Minimum width (as a percent of the viewport size) at which point wrapping will occur. On mobile, this value is tripled.
multiline-opt-automaticallyMultilinify-name = Automatically Multilinify
multiline-opt-automaticallyMultilinify-desc = Automatically splits expressions onto multiple lines.
multiline-opt-multilinifyDelayAfterEdit-name = Edit Delay (ms)
multiline-opt-multilinifyDelayAfterEdit-desc = Multiline expressions should be updated after no edits are made for this number of milliseconds.

## Custom MathQuill Config
custom-mathquill-config-name = Custom MathQuill Config
custom-mathquill-config-desc = Changes how equation input works.
custom-mathquill-config-opt-superscriptOperators-name = Operators in Exponents
custom-mathquill-config-opt-superscriptOperators-desc = Allows you to type operators like '+' in exponents
custom-mathquill-config-opt-noAutoSubscript-name = Disable Auto Subscripts
custom-mathquill-config-opt-noAutoSubscript-desc = Disable automatically putting numbers typed after variable names in subscripts
custom-mathquill-config-opt-noNEquals-name = Disable n= Sums
custom-mathquill-config-opt-noNEquals-desc = Disable sums automatically placing 'n=' in the lower bound
custom-mathquill-config-opt-subSupWithoutOp-name = Subscripts/Superscripts Without Operand
custom-mathquill-config-opt-subSupWithoutOp-desc = Allows subscripts and superscripts to be made even if not preceded by anything
custom-mathquill-config-opt-allowMixedBrackets-name = Allow Mismatched Brackets
custom-mathquill-config-opt-allowMixedBrackets-desc = Allows all brackets to match with each other (includes absolute value)
custom-mathquill-config-opt-subscriptReplacements-name = Allow Replacements in Subscripts
custom-mathquill-config-opt-subscriptReplacements-desc = Allows symbols and function names to be typed into subscripts
custom-mathquill-config-opt-noPercentOf-name = Disable % of
custom-mathquill-config-opt-noPercentOf-desc = Makes typing '%' insert the percent character instead of '% of'
custom-mathquill-config-opt-commaDelimiter-name = Comma Separators
custom-mathquill-config-opt-commaDelimiter-desc = Inserts commas as delimiters in numbers (purely visual)
custom-mathquill-config-opt-delimiterOverride-name = Custom Delimiter
custom-mathquill-config-opt-delimiterOverride-desc = Set the string to be used as number delimiters
custom-mathquill-config-opt-leftIntoSubscript-name = Left/Right into Subscripts
custom-mathquill-config-opt-leftIntoSubscript-desc = Moving the cursor left or right will go into subscript instead of superscript
custom-mathquill-config-opt-extendedGreek-name = More Greek Letters
custom-mathquill-config-opt-extendedGreek-desc = Enables replacements for all supported greek letters
