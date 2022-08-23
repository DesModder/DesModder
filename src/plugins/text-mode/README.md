This text mode (not its final name) is meant to improve on my previous experiments in the form of [DesmosText](https://github.com/jared-hughes/DesmosText) and [DesmosPlus](https://github.com/jared-hughes/DesmosPlus), as well as learnings from others' projects: [Graphgame](https://github.com/uellenberg/Graphgame) (which is built on [Logimat](https://github.com/uellenberg/Logimat/)) and [LISPsmos](https://github.com/radian628/lispsmos/).

Some learnings:

- LISPsmos is versatile, but this comes at the cost of using lisp syntax. This is a parsing convenience, but is not desirable as we want to stick close to Desmos syntax.
- DesmosText syntax aligns too closely with the state JSON, so the program looks too cluttered, and the language spec is too large (take "lines: show, dotted" as an example)
- Graphgame has great syntax (with the exception of the "state" variable for successive processing) and tooling, but it requires going into a separate website. This text mode is integrated into Desmos for convenience.
- Graphgame and LISPsmos allow for splitting a program into files. While that may be useful some day, a robust system of nested folders and folder collapsing should suffice and adhere closer to vanilla Desmos syntax.
- Graphgame's object/behavior system is great for abstraction and expressive power, but it ends up being relatively inefficient. Any objects should stick to being simple record types with performance as the first priority before adding new features.
- All of the above programs use setState to update the entire state at once, when incremental updates are possible for performance.

Major gripes with the Desmos language which are unlikely to be implemented in the near future by the Desmos team, motivating this project:

- lack of records (structs), such as (x,y,z) triples.
- lack of enums
- mixed dynamic scoping
  - list comprehensions and summations introduce a "local" variable that can't be used by any expression dependent on that listcomp/summation
  - wack-scoped (dynamic-scoped) variables in functions
  - name collisions when using libraries
- lack of "where" clauses like `f(x) = a^2 where a = 2*x`
  - the best ways to emulate this are either `f(x) = a^2; a = 2*x` which binds `a` for the entire graph, or `f(x) = g(2*x); g(a) = a^2` which is hard to work with
- lack of the ability to split an expression across several lines
- lack of nested folders

In terms of implementation, there are a few broad state types to be concerned with:

- Text: string text representation
- Internal: various internal text mode representations (tree)
- Aug: augmented JSON state
  - latex is a tree representation
  - DesModder metadata is stored on each expression
- Raw: raw JSON state
  - latex is stored as a string
  - DesModder metadata is in a dsm-metadata expression

Note that Text (when edited) should be stored as an expression on Raw

One big component of the project is going from top to bottom:

- lexer + parser from Text to Internal
- application of various language features to reduce Internal eventually to Aug
- simple transformation from Aug to Raw
- applying Raw to the computed graph. This is where state diffs should be taken to apply incremental changes.

Another component of the project is from bottom to top:

- convert Raw to Aug (relatively easy since we have access to `require("parser").parse`)
- Aug can then be converted directly to Text (no special language features to go through)
