/* eslint-disable import/first */
/* eslint-disable no-console */
const oldConsoleError = console.error;
console.error = () => {};

// eslint-disable-next-line rulesdir/no-reach-past-exports
import "../../node_modules/.cache/desmos/calculator_desktop.js";

console.error = oldConsoleError;
