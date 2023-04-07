# DesModder

Supercharge your Desmos graph creation and sharing experience with many convenient features:

- Core
  - Adjust settings that can let you hide the keypad, lock the viewport, and more
  - Render implicit-filled expressions on the GPU
  - Export videos and GIFs of your graphs based on actions or sliders
  - View expressions in a text editor (Beta)
- Utility
  - Paste ASCIIMath (such as the results of Wolfram Alpha queries) into Desmos
  - Pin expressions to the top
  - Find and replace expressions
  - Display graph performance metrics
  - Adds right-click (instead of long press) on expressions to style them
  - Duplicate any expression with hotkey Ctrl+Q
  - Use Shift+Enter to write newlines in notes
  - Quickly dump a folder's entire contents, and merge expressions into a folder
- Visual
  - Change the primary color from blue to any color
  - Toggle display of expression IDs
  - Display list elements, colors, and undefined values in expression list
  - View tips including lesser-known features of Desmos
  - Hide and ignore unwanted slider suggestions
- Integration
  - Integration with WakaTime
- More to come!

All graphs created using this extension are compatible with vanilla Desmos. This means your graphs are always safe to share with others, regardless of whether or not they have DesModder.

- One small exception: expressions rendered using GLesmos may be much slower for people without the feature.

Chrome will warn you asking for permission for the declarativeNetRequest API ("Block content on any page you visit"). In this case, the warning is inaccurate because the net request rules apply [only to Desmos](https://github.com/DesModder/DesModder/blob/main/public/net_request_rules.json#L21) and simply modify response headers to provide permissions that enable in-browser video export. This extension follows Chrome's best practices and is open source (https://github.com/DesModder/DesModder), so you and others can contribute and see what goes on in the background.

Keep in mind that many features of this extension rely on unofficial, undocumented, or unstable parts of Desmos. When something stops working, report it on http://github.com/DesModder/DesModder/issues with a description of the issue.

Currently only works on the public-facing calculator at https://desmos.com/calculator.

Not affiliated with Desmos.

## Documentation

Refer to:

- [Installation](/docs/INSTALLATION.md) for installation instructions
- [Development](/docs/DEVELOPMENT.md) for setting up a development environment
- [Plugins](/docs/PLUGINS.md) for detailed information about the plugin structure
- [Changelog](/docs/CHANGELOG.md) for each release's changelog
