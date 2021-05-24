# DesModder

Supercharge your Desmos graph creation and sharing experience with many convenient features:

- Export videos and GIFs of your graphs based on simulations or sliders
- Find and replace expressions
- Enable features including simulations, clickable objects, and more
- Paste ASCIIMath (such as the results of Wolfram Alpha queries) into Desmos
- Press Ctrl+Q to duplicate an expression
- Right-click on expressions to style them
- More to come!

All graphs created using this extension are compatible with vanilla Desmos. This means your graphs are always safe to share with others, regardless of whether or not they have DesModder.

Chrome will warn you asking for permission for the declarativeNetRequest API ("Block content on any page you visit"). In this case, the warning is inaccurate because the net request rules apply [only to Desmos](https://github.com/DesModder/DesModder/blob/main/public/net_request_rules.json#L21) and simply modify response headers to provide permissions that enable in-browser video export. This extension follows Chrome's best practices and is open source (https://github.com/DesModder/DesModder), so you and others can contribute and see what goes on in the background.

Keep in mind that many features of this extension rely on unofficial, undocumented, or unstable parts of Desmos. When something stops working, report it on http://github.com/DesModder/DesModder/issues with a description of the issue.

Currently only works on the public-facing calculator at https://desmos.com/calculator.

Changelog: https://github.com/DesModder/DesModder/blob/main/docs/CHANGELOG.md.

---

This extension is intended to be more organized than the existing system of userscripts in the form of gists and repos that need to be toggled manually in Tampermonkey.

Think of it like an unofficial plugin/modding API, like Forge does for Minecraft. (DesModder is not affiliated with Desmos).
