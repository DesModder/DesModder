/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */

const oldConsoleError = console.error;
console.error = () => {};
require("../../../../node_modules/.cache/desmos/calculator_desktop.js");
console.error = oldConsoleError;

const { latexTreeToString } = require("./augToRaw");
const { parseRootLatex } = require("./rawToAug");

function testRoundTripIdentical(raw: string) {
  test(raw, () => {
    const aug = parseRootLatex(raw);
    const raw2 = latexTreeToString(aug);
    expect(raw).toEqual(raw2);
  });
}

function testRoundTripParsesSame(raw: string) {
  test(raw, () => {
    const aug = parseRootLatex(raw);
    const raw2 = latexTreeToString(aug);
    const aug2 = parseRootLatex(raw2);
    expect(aug).toEqual(aug2);
  });
}

const raw = String.raw;

describe("Identical round trips", () => {
  const cases: string[] = [
    raw`\left(2\right)+\left(3\right)`,
    raw`\left(x\right)^{2}`,
  ];
  cases.forEach(testRoundTripIdentical);
});

describe("Same-parse round trips", () => {
  const cases: string[] = [
    "2+3",
    "x^2",
    raw`A_{main}\left(d\right)=A_{T}\left(d\right),\ A_{horizScroll}\left(0\right),\ A_{vertScroll}\left(0\right),\left\{Q_{pauseEval}=0:\ \left\{Q_{landscape}=1:\ A_{E}\left(0\right)\right\}\right\},\ A_{drag}\left(0\right),\ A_{scrollbarWidth}\left(0\right)`,
    raw`x_{1}\left(y\right)=1-4^{\operatorname{round}\left(\log_{4}\left(\left|3y-1\right|\right)-0.5b\right)+0.5b}`,
    raw`u=\left\{\frac{1}{3}+\frac{1}{6}\left(-2\right)^{\operatorname{floor}\left(\log_{2}\left(1-x\right)\right)}<y:\left\{0<x,0\right\},0\right\}`,
  ];
  cases.forEach(testRoundTripParsesSame);
});
