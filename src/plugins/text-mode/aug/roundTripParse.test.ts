/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */

const oldConsoleError = console.error;
console.error = () => {};
require("../../../../node_modules/.cache/desmos/calculator_desktop.js");
console.error = oldConsoleError;

const { latexTreeToString } = require("./augToRaw");
const { parseRootLatex } = require("./rawToAug");

function leftRight(s: string) {
  return s
    .replace(/[[(]|\\{/g, (x) => "\\left" + x)
    .replace(/[\])]|\\}/g, (x) => "\\right" + x)
    .replace(/\*/g, "\\cdot ");
}

function testRoundTripIdentical(raw: string) {
  test(raw, () => {
    const raw1 = leftRight(raw);
    const aug = parseRootLatex(raw1);
    const raw2 = latexTreeToString(aug);
    expect(raw2).toEqual(raw1);
  });
}

function testRoundTripParsesSame(raw: string) {
  test(raw, () => {
    const aug = parseRootLatex(raw);
    const raw2 = latexTreeToString(aug);
    const aug2 = parseRootLatex(raw2);
    expect(aug2).toEqual(aug);
  });
}

const raw = String.raw;

describe("Identical round trips", () => {
  const cases: string[] = [
    "2+3",
    "x^{2}",
    "(-5)^{2}",
    "(x)!",
    "(x+2)!",
    "f''(x)",
    "(P).x",
    raw`(L).\operatorname{random}(5)`,
    "(2+3)*4",
    "2*3+4",
    "(0,4)",
    raw`\frac{(2)}{(3)}*4`,
    raw`[a+b\operatorname{for}a=[1...5],b=[-3...4]]`,
    raw`\int_{a}^{b}f(x)dx`,
  ];
  cases.forEach(testRoundTripIdentical);
});

describe("Same-parse round trips", () => {
  const cases: string[] = [
    raw`A_{main}\left(d\right)=A_{T}\left(d\right),\ A_{horizScroll}\left(0\right),\ A_{vertScroll}\left(0\right),\left\{Q_{pauseEval}=0:\ \left\{Q_{landscape}=1:\ A_{E}\left(0\right)\right\}\right\},\ A_{drag}\left(0\right),\ A_{scrollbarWidth}\left(0\right)`,
    raw`x_{1}\left(y\right)=1-4^{\operatorname{round}\left(\log_{4}\left(\left|3y-1\right|\right)-0.5b\right)+0.5b}`,
    raw`u=\left\{\frac{1}{3}+\frac{1}{6}\left(-2\right)^{\operatorname{floor}\left(\log_{2}\left(1-x\right)\right)}<y:\left\{0<x,0\right\},0\right\}`,
    raw`C\left(p\right)=\left(1-t\right)^{3}p\left[1\right]+3t\left(1-t\right)^{2}p\left[2\right]+3t^{2}\left(1-t\right)p\left[3\right]+t^{3}p\left[4\right]`,
    raw`\left[P\left(C_{1}\left(\left(x_{30},y_{30}\right)\left[1...4\right],\left[1-t,t-1\right]\right)\right),P\left(C_{1}\left(\left(x_{31},y_{31}\right)\left[1...4\right],\left[1-t,t-1\right]\right)\right)\right]+0.25\left(2\cos\left(17\tau t\right),\sin\left(27\tau t\right)\right)t\left(t-1\right)^{2}\left(t-2\right)`,
    raw`y=-0.8605\sum_{n=1}^{13}\frac{\prod_{i=1}^{n}\left(2i-1\right)^{2}}{0.76075^{2n}\left(2n\right)!\left(2n-1\right)}\left(x-0.36125\right)^{2n}+8.181\left\{-0.1676\le x\le0.225\right\}`,
    raw`r_{otate}\left(p,\theta\right)=\left(p.x\cos\left(\tau\theta\right)+p.y\sin\left(\tau\theta\right),-p.x\sin\left(\tau\theta\right)+p.y\cos\left(\tau\theta\right)\right)`,
    raw`\left[\operatorname{polygon}\left(\left(\frac{\left(-2\right)^{i-1}-1}{3},\frac{2-2^{i}3}{2}+2b_{ounce}\left(t+1.1-1.1^{-i}\right)\right)+\frac{\left(\left[-1,1,1,-1\right],\left[-1,-1,1,1\right]\right)}{2^{1-i}}\right)\operatorname{for}i=-\left[0...7\right],t=T+\frac{l}{2}\right]`,
  ];
  cases.forEach(testRoundTripParsesSame);
});
