# DesModder

Several plugins for the Desmos graphing calculator, bundled into a single extension:

- Find and replace expressions
- Paste ASCIIMath (such as the results of Wolfram Alpha queries) into Desmos
- Press Ctrl+Q to duplicate an expression
- More to come, including GIF exports via sliders and simulations!

Keep in mind that many features of this extension rely on unofficial, undocumented, or unstable components of Desmos. When something stops working, report it on http://github.com/jared-hughes/DesModder/issues with a description of the issue.

Currently only works on the public-facing calculator at https://desmos.com/calculator.

This extension is intended to be more organized than the previous system of userscripts in the form of gists and repos that need to be toggled manually in Tampermonkey.

Think of it like an unofficial plugin/modding API, like Forge does for Minecraft. (DesModder is not affiliated with Desmos).

Build system forked from https://github.com/jared-hughes/DesThree.

## Development

To clone the repository, use:

```
git clone --recurse-submodules https://github.com/jared-hughes/DesModder
```

This clones the repository and downloads the submodules.

Install packages with `npm install`.

Use command `npm run dev` to start the dev server, and `npm run build` to build production files (clear the dist folder first)

Load the unpacked extension through directions at https://developer.chrome.com/docs/extensions/mv2/getstarted/#manifest (see "load unpacked"). Load the `dist/` folder

### Testing extension in the browser

Suggested setup for convenience: three workspaces (virtual desktops)

1. Code editor, documentation, etc.
2. Terminal and chrome://extensions page
3. Test page

Setting it up this way forces you to remember to reload the extension every time (as you transition from workspace 1 to 3 through workspace 2), and it let you see any errors in the terminal during the same transition.

### Changing submodules

To add a new submodule, run:

```
git submodule add https://github.com/jared-hughes/desmodder-find-replace src/plugins/find-replace
```

To update a submodule to the most recent commit, run:

```
git submodule update --remote wolfram2desmos
```

or equivalent for other module names. This should only be done when submodules changed.

More information at https://git-scm.com/book/en/v2/Git-Tools-Submodules.

## The plan

Each plugin would consist of a `onEnable` and `onDisable` hook.

There are two types of plugins:

- development tools
  - people can view graphs without these plugins
  - example: Wolfram2Desmos, which makes it easier to copy-paste ASCIIMath expressions into Desmos
- graph dependencies
  - these are needed for the graph to run
  - example: DesThree or Expressions Nested Too Deeply Bypass which add actual visual features.

## The name

CyanidesDuality came up with the name "DesThree," but he abandoned his project early-on. He's letting me use the name under one condition:

> if you take the name you gotta include my features then
>
> which is: a sort of header that tells you what plugins a specific graph needs, and then enables/disables them as needed

That is the plan anyway (for plugins which are graph dependencies), so it shouldn't be too difficult to follow this request once graph dependencies are added. This already exists as the version check of DesThree.
