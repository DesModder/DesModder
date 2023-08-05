# Math Expressions

Expressions are the core of Desmos. Here's a broad overview of all the building blocks of math expressions, with more details later (not yet documented).

Notes to avoid confusion:

- Juxtaposed (implicit) multiplication like `ab` or `a b` is not allowed; it must be `a*b`.
- Equality is currently single-equals like `a = b`, unlike some other programming languages
- In a derivative, the `d/d` must have no spaces, and there must be a space after it, e.g. `(d/d x)`
- Decimal values must not have a trailing decimal point. Write `123`, not `123.`

```js
// Constants
// Leading 0 cannot be omitted before a decimal point; not OK: .12345
1; 1.5; 300; 0.12345; -4.5
// Addition, subtraction, division, multiplication, exponentiation
a + b; a - b; a / b; a * b; a ^ b
// Negative, Factorial
-a; a!
// Equals, less, less or equal, greater or equal, greater
a = b; a < b; a <= b; a >= b; a > b
// Double inequalities work too
// The comparisons must be in the same direction
a < b < c; a > b > c
// Function call
f(x); g(a,b,c)
// Identifier (multi-character are allowed)
f; quack42; total
// Integral; sum; product
integral x=(0 ... 5) x^2
sum n=(1...5) n
product n=(1...5) n
// Derivative
(d/d x) f(x,y)
// Prime (only one argument allowed)
f''(x); func''''(arg)
// List
[1, x, sin(x), x^2]
// Range
[1...x]
[1,2,3...11,12]
// List access
L[1...5]
L[M+1]
// List filters
L[L>3]
// Dot access
L.random(5)
// Ordered pair access
(a,b).x; (a,b).y
// Update rules, sequence
a -> a+1, b -> b+1
// List comprehension
[a for a=[1...5]]
[a + b + c for a=[1...5], b=[1...4], c=[1,2,3]]
// Piecewise
{a > 5}
{a > 5: 7}
{a > 5: 7, 0}
{a > 5: 7, b > 3: 4}
```
