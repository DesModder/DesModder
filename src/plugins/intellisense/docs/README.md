# DesModder Intellisense Docs

## Function Documentation

DesModder Intellisense supports documentation for functions. Function documentation will appear while you are filling out the parameters for a function.

Put a text expression (either through the expression dropdown or by hitting the `"` key in an empty expression) directly before a function and put text in it to provide documentation for that function.

Function documentation can also contain rendered LaTeX mathematical expressions, which are enclosed by backticks (`\``). These use [Text Mode](../../text-mode/docs/intro.md) syntax. If an expression cannot be parsed as a Text Mode expression, it will fall back to being parsed as regular Desmos LaTeX.

### Parameter Documentation

You can provide documentation for specific function parameters by typing `@param=PARAMNAME`, where `PARAMNAME` is the name of the function parameter as if it were written in [Text Mode](../../text-mode/docs/intro.md) format.

## Jump to Definition

Press F9 while the cursor is hovering over an identifier to jump to that identifier's definition.

## Autocomplete

Use the up and down arrow keys to navigate through the autocomplete menu. Use the Enter key to auto-complete an expression.
