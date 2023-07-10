/* eslint-disable import/first */
/* eslint-disable no-console */
const oldConsoleError = console.error;
console.error = () => {};

import "../../node_modules/.cache/desmos/calculator_desktop.js";

console.error = oldConsoleError;
