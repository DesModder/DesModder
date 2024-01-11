# Graph State

Typescript definitions for all possible Desmos graph states.

Quote from the API docs:

> Warning: Calculator states should be treated as opaque values. Manipulating states directly may produce a result that cannot be loaded by GraphingCalculator.setState.

This package is for people who want to throw caution to the wind and spurn that advice to make their own projects manipulating the graph state. The definitions themselves are in `state.ts`; everything else is testing code.

This is an unofficial project and may neither be perfectly complete nor accurate. However, I have made a best effort at testing it on many graphs.

Desmos is subject to change at any time, and this package may become out-of-date or otherwise incorrect, so use it with caution.

## Specifics

Any graph state obtainable through `Calc.getState()` should be accepted by the `State` interface. (If you have any incompatabilities, raise them on the GitHub issue tracker).

There are some properties where the `State` interface is broader. For example, default properties (such as `hidden: false` on an expression) are never included in the graph state from `Calc.getState()`, but they are allowed in the type definitions because scripts may want to output a state that includes the properties without needing to handle excluding the property (such as by using `hidden: booleanVariable`), and Desmos handles these as expected.

Keep in mind that the Desmos server does not perform full server-side validation on uploaded graph states, so a user could set them to anything by changing the server request. Similarly, `Calc.setState()` expands the full set of possible graph states; for example, it accepts `number`s in place of `Latex`.
