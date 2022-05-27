This is a living document for the current specification of the syntax

## Summary

## Expression

In mathematical sense, typically something that can be evaluated. Here is an overview of the extent of the syntax, without parsing details.

```c
// Constants
// Leading 0 cannot be omitted before a decimal point; not OK: .12345
1; 1.5; 300; 0.12345; -4.5
// Addition, subtraction, division
a + b; a - b; a / b
// Multiplication
// Juxtaposed (implicit) multiplication like ab is not supported
a * b
// Exponent
a ^ b
// Negative
-a
// Equals: use single equals for comparison. This is now unambiguous
a = b
// Less, less or equal, greater or equal, greater
a < b; a <= b; a >= b; a > b
// Double inequalities work too (currently no more than double)
// The comparisons must be in the same direction
a < b < c; a > b > c
// Function call
f(x); g(a,b,c)
// Identifier (multi-character are allowed)
f; quack42; total
// Integral
// TODO: figure out integral syntax
integral (a ... b) sin(x) dx
integral (c ... d) int (a ... b) sin(x) dx dy
// Repeated operator (sum, product)
// TODO: figure out repeated operator syntax
sum_{x=a}^{b}{sin(x)}
sum x=(a ... b) sin(x)
product n=(a...b) n
// Derivative
(d/dx) f(x,y)
// Prime (only one argument allowed)
f'(x); func''''(a)
// List
[1, x, sin(x), x^2]
// Range
[1...x]
[1,2,3...10,11,12]
// List access (includes list filters)
L[1...5]
L[M+1]
L[L>3]
// Dot access
L.random(5)
// Ordered pair access
(a,b).x; (a,b).y
// Update rule
a -> a+1
// Bare sequence
a -> a+1, b -> b+1
// Paren sequence
(a -> a+1, b -> b+1);
(1, 2)
// List comprehension (including one or more assignment expressions)
[a for a=[1...5]]
[a+b+c for a=[1...5],b=[1...4],c=[1,2,3]]
// Piecewise
{a > 5}
{a > 5: 7}
{a > 5: 7, 0}
{a > 5: 7, b > 3: 4}
// Style mapping
sty = @{color: RED, glesmos: true}
sty2 = @{
  color: "#abc",
  points: @{opacity: 0.8, style: "OPEN"},
  lines: @{width: a+1}
}
```

### On Identifiers

Desmos restricts variables to a single character, optionally followed by a subscript, for the main reason of adhering to math notation and allowing juxtaposition for multiplication. So it takes some care to ensure compatability.

Desmos has three identifier types, each of :

- Single letter: `a`, `a_123`
- Greek letter: `phi`, `phi_123`. In string LaTeX, these are stored with a preceding backslash like `\phi_{123}` to serve as a MathQuill command
- Long name: `total`, `ans_123`. In string LaTeX, these are stored within operatorname like `\operatorname{ans}_{123}`

Note that `\operatorname{phi}` cannot be told apart from `\phi`. So all three of these cases blend together, which is a blessing and a curse.

It's good because it unifies all identifiers into the same format. But this is an issue because it adds trouble in telling apart builtins like `total` from user variables like `phi`. In text mode, we also disallow subscripts in identifier names.

The text mode compiler must know which identifiers are builtin. Reference `main/mathquill-operators`. Most builtin identifiers should be wrapped in `\operatorname{}` with the exception of the auto commands, which should be preceded with a single backslash. All user identifiers should be converted to subscripts like value → `v_{alue}`. This avoids collisions with operatornames, and it's shorter.

### On equality

Desmos consistently uses single-equals, but this causes an ambiguity with function/variable definition: "f(x,y) = x+y" is a function definition but "x+y = f(x,y)" is an implicit equation. We use double-equals for comparison to avoid this ambiguity.

In general:

- single equals (`=`) for bindings, such as in list comprehensions, function definitions, and variable assignment
- double equals (`==`) for comparison, such as equations and piecewise conditions

### On unary operators

From a usability perspective, it makes sense to have a (prefix) unary minus operator `-` as well a (postfix) unary factorial operator `!`.

Unary minus isn't much of an issue; most discussion about parsing unary minus is about choosing between high precedence (so `-x^5` is `(-x)^5`) or low precedence (so `-x^5` is `-(x^5)`). We will stick with the mathematical convention of low precedence. Then the main ambiguity is numbers as the base of an exponent: `-2^x` can be parsed as `(-2)^x` (where `-2` is a number literal) or `-(2^x)`. Again, we use the latter case because negative bases are uncommon.

Derivative is also a (prefix) unary operator, but it doesn't parse ambiguously

Factorial is a little trickier. Allowing factorial opens up ambiguities such as `x!=5` (which could be parsed as `(x!)=5` or `x != 5`).

A few ways to solve this:

- Using a different character pair to represent not-equals, e.g. `/=` like in Haskell or `<>` like in spreadsheets. I prefer `/=`.
- Using double-equals for comparison. Then this removes the ability for `!==` later. I'd rather have `/==`

# Line types

## Statement

```cpp
// Equation
show y = 2*x + 5
show sin(x) = sin(y) @style
// Assignment
a = 7.5
b = a + 1
// Function definition
hide f(x) = x + 1
f(a,b,c) = a + 2 * b + c
// Visualization
show stats(L)
show histogram(L) @{mode: "density"}
// Regression
regression a + 1 ~ sin(a)
regression y1 ~ a*x1 + b {
  expr a = 1.234
  expr b = 6.521
}
// Other expression
show sin(x) @{lines: @{opacity: 0.6}}
show 1 + 7/2;
show y < x + 2 @style
```

## Table

```js
table {
  // The first column header must be an identifier or nothing
  // just "[1, 2, 3, 4]" without the "x1 =" is ok
  expr x1 = [1, 2, 3, 4]
  show y1 = [5, 6, 7, 8] @{color: "#abc"}
  // this takes the value of the list y2 from elsewhere in the graph
  expr y2
  // Any column can have no header
  show [9, 10, 11, 12]
  // If a formula is more than just a fixed list of specific values, then it
  // must be placed in the header with no value entry
  show [1 ... 4]
}
```

## Image

Images lol. The textual representation isn't critical because image expressions should be replaced with a widget.

TODO: figure out image details

```js
image "Picture of my dog" "data:image/png,rest_of_image_url"
```

## Folder

Collapsed folder data could be stored based on code mirror editor state, but it should really be in the text with the rest of the graph state. One idea is a hyphen (`-`) before the open brace, but I'm not vibing too much with it, so just shoving it into a style map.

```
folder {
  contents
}
folder "Title" {
  contents
}
folder "This one is collapsed" {
  contents
} @{
  collapsed: true
}
```

## Text

A note(text expression) can be made by just creating a string between two other expressions, like

```py
y = sin(x)
"This is a note"
y = cos(x)
""" First line ok?
This is a multiline string perhaps
Maybe we go with this syntax, maybe not.
"""
```

## Graph Settings

```
settings @{
  randomSeed: "ab13few...",
  viewport: {
    xmin: -10,
    ymin: -10,
    xmax: 10,
    ymax: 10
  }
}
```

## On unclosed objects

Suppose that someone creates an unclsoed block comment like `/*`. Then the entire rest of the file would break, making interactivity slower. A simple way to deal with this is not to update the state if there is an unclosed comment or a nested comment like `/* unclosed /* nested */`, but this is not great in all conditions.

Another approach would require fully starred block comments like

```c
/**
 * contents
 * contents
 */
```

where each leading asterisk indicates "yup, continue on this line," but this would be hard to ensure as well; if it's missing, there would be another parsing error.

Multiline strings have a similar issue, except they can't be accidentally nested (`" unclosed " nested "` is actually `" closed " nothing "` ending on unclosed).

Not sure how to resolve these issues yet, and not worth the time yet.

Another issue is an expression in progress. If someone starts typing `y =`, then the parser will continue to the next line to start looking for the right-hand side of the equality. This could break the next line for a chain reaction to break interactivity. Two possible fixes:

- have the editor automatically insert a semicolon _after_ the cursor in order to break quickly enough
- require a prefix like `expr` for each expression (or use a different prefix for each type of expression: `def`, `let`, `show`, etc.). This also fixes some other issues like `=` ambiguity, so I'm going with it
