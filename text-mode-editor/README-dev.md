This Text Mode (originally intended to not be its final name) is meant to improve on my previous experiments in the form of [DesmosText](https://github.com/jared-hughes/DesmosText) and [DesmosPlus](https://github.com/jared-hughes/DesmosPlus), as well as learnings from others' projects: [Graphgame](https://github.com/uellenberg/Graphgame) (which is built on [Logimat](https://github.com/uellenberg/Logimat/)), [LISPsmos](https://github.com/radian628/lispsmos/), and [DesmoScript](https://github.com/radian628/desmoscript).

Some learnings:

- LISPsmos is versatile, but this comes at the cost of using lisp syntax. This is a parsing convenience, but is not desirable as we want to stick close to Desmos syntax.
- DesmosText syntax aligns too closely with the state JSON, so the program looks too cluttered, and the language spec is too large (take "lines: show, dotted" as an example)
- Graphgame has great syntax (with the exception of the "state" variable for successive processing) and tooling, but it requires going into a separate website. This text mode is integrated into Desmos for convenience.
- Graphgame and LISPsmos allow for splitting a program into files. While that may be useful some day, a robust system of nested folders and folder collapsing should suffice and adhere closer to vanilla Desmos syntax.
- Graphgame's object/behavior system is great for abstraction and expressive power, but it ends up being relatively inefficient. Any objects should stick to being simple record types with performance as the first priority before adding new features.
- DesmoScript is great and seems to have been inspired in syntax a little by this Text Mode a little. This Text Mode leans more towards correctness/completionism of integration with Desmos, while DesmoScript focuses more on power (e.g. macros).
- All of the above programs use setState to update the entire state at once, when incremental updates are possible for performance.

Most of the motivation for this project comes from the inability in vanilla Desmos to:

- split an expression across several lines
- nest folders
- copy-paste an entire graph without messing with saves or JSON states
- create records (structs)
- create enums
- create encapsulated libraries for re-use

Most of these are unlikely to ever be implemented by Desmos, so it's a great feature to add separately, though this Text Mode has not yet reached maturity to begin implementing records, enums, and libraries.

In terms of implementation, there are a few broad state types to be concerned with:

- Text Mode `string`: string text representation
- `TextAST`: the AST of the text mode state
- `Aug`: augmented JSON state. Similar to the plain state, but:
  - latex is a tree representation `Aug.Latex`
  - DesModder metadata is stored on each expression
- Raw `GraphState`: raw JSON state. Note:
  - latex is stored as a string
  - DesModder metadata is in a dsm-metadata expression

A future plan is to keep track of edited string text to allow swapping between Mathquill and Text Mode without losing all the text.

The compilation goes in two directions:

One direction is going from top to bottom:

1. lexer + parser from Text Mode `string` to `TextAST`

   - all syntax errors are checked here, so there should be no syntax errors later in the raw latex.

2. convert `TextAST` to `Aug`
3. simple transformation from `Aug` to Raw `GraphState`
4. set the state from the Raw graph

Another direction is going from bottom to top:

1. convert Raw `GraphState` to `Aug` (relatively easy since we have access to Desmos's parser)
2. convert `Aug` to `TextAST`
3. stringify `TextAST` to the final Text Mode `string`

- this uses Prettier to get decent automatic newlines, so it uses Prettier's `Doc` format as an intermediate

Large swathes of future work remain:

- incremental updates, to avoid needing to `setState` the whole graph
- get functional info (e.g. type errors) back from the graph to the text mode.
