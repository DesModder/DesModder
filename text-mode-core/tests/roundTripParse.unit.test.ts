// Following imports must go after Desmos loads.
import { buildConfigFromGlobals } from "..";
import { Expression, Concrete } from "../TextAST";
import { AnyRootOrChild } from "../aug/AugLatex";
import { latexTreeToString as _latexTreeToString } from "../aug/augLatexToRaw";
import { parseRootLatex as _parseRootLatex } from "../aug/rawToAug";
import { childExprToAug } from "../down/astToAug";
import { parse as _parse } from "../down/textToAST";
import { TextEmitOptions, astToText } from "../up/astToText";
import { rootLatexToAST } from "../up/augToAST";
// eslint-disable-next-line @desmodder/eslint-rules/no-reach-past-exports
import "../../src/tests/run_calc_for_tests";

const Calc = window.Desmos.GraphingCalculator(
  document.getElementById("graph-container")!
);
const cfg = buildConfigFromGlobals(window.Desmos, Calc);

function parseRootLatex(s: string) {
  return _parseRootLatex(cfg, s);
}

function latexTreeToString(n: AnyRootOrChild) {
  return _latexTreeToString(cfg, n);
}

function parse(s: string) {
  return _parse(cfg, s);
}

function leftRight(s: string) {
  return s
    .replace(/[[(]|\\{/g, (x) => "\\left" + x)
    .replace(/[\])]|\\}/g, (x) => "\\right" + x)
    .replace(/\\\\left/g, "")
    .replace(/\\\\right/g, "")
    .replace(/\*/g, "\\cdot ")
    .replace(/\\o/g, "\\operatorname");
}

function testRoundTripIdenticalViaAug(raw: string) {
  test(raw, () => {
    const raw1 = leftRight(raw);
    const aug = parseRootLatex(raw1);
    const raw2 = latexTreeToString(aug);
    expect(raw2).toEqual(raw1);
  });
}

function testRoundTripIdenticalViaAST(raw: string) {
  test(raw, () => {
    const raw1 = leftRight(raw);
    const aug = parseRootLatex(raw1);
    const ast = rootLatexToAST(aug);
    // don't have id, index, pos, but that doesn't single expr
    const aug2 = childExprToAug(ast as any as Expression<Concrete>);
    const raw2 = latexTreeToString(aug2);
    expect(raw2).toEqual(raw1);
  });
}

function testRoundTripIdenticalViaText(raw: string, emitOpts: TextEmitOptions) {
  test(raw, () => {
    const raw1 = leftRight(raw);
    const aug = parseRootLatex(raw1);
    const ast = rootLatexToAST(aug);
    const text = astToText(ast, emitOpts);
    const analysis = parse(text);
    expect(analysis.diagnostics).toEqual([]);
    const { children } = analysis.program;
    expect(children.length).toEqual(1);
    const [item] = children;
    expect(item.type).toEqual("ExprStatement");
    if (item.type !== "ExprStatement") throw new Error("Jest lied.");
    const aug2 = childExprToAug(item.expr);
    const raw2 = latexTreeToString(aug2);
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

describe("Operator Precedence round-trip", () => {
  const cases: string[] = [
    /// parent = Integral
    "\\int_{a}^{b}f(x)dx",
    "\\int_{x-1}^{x+1}(f(t)-1)dt",
    "\\int_{5*x}^{5*x}5*tdt",
    "\\int_{a\\o{with}a=1}^{a\\o{with}a=3}(a\\o{with}a=t)dt",
    /// parent = ListAcccess
    "L[x]",
    "L^{2}[x]",
    "L![x]",
    "(-L)[x]",
    "(L*M)[x]",
    "L[1,2,3]",
    "L[[1,2,3]+4]",
    "L[1...5]",
    "L[L>3]",
    "L[f(M)]",
    /// parent = DotAccess
    "L.\\o{random}(5)",
    "L^{2}.\\o{unique}",
    "L!.\\o{unique}",
    "(-L).\\o{unique}",
    "(L*M).\\o{unique}",
    /// parent = OrderedPairAccess
    "L.x",
    "L[5].x",
    "(-L).y",
    /// parent = RepeatedOperator
    "\\sum_{n=a}^{b}(m\\o{with}m=n)",
    "\\sum_{n=a}^{b}(n+5)",
    "\\sum_{n=a}^{b}n*5",
    "\\sum_{n=a}^{b}-n",
    "\\sum_{n=a+1}^{b+2}n+5",
    "\\prod_{n=a}^{b}(m\\o{with}m=n)",
    "\\prod_{n=a}^{b}(n+5)",
    "\\prod_{n=a}^{b}n*5",
    "\\prod_{n=a}^{b}-n",
    "\\prod_{n=a+1}^{b+2}n+5",
    /// parent = Derivative
    "\\frac{d}{dx}(x+5)",
    "\\frac{d}{dx}(x-5)",
    "\\frac{d}{dx}-x",
    "\\frac{d}{dx}x*5",
    "\\frac{d}{dx}\\frac{d}{dx}x^{3}",
    /// parent = Comparator
    "x<(b\\o{with}b=3)",
    "(b\\o{with}b=3)\\le x",
    "1+x<2*y",
    "A=a\\to a+1",
    "A=a\\to a+1,b\\to b-a",
    /// parent = ComparatorChain
    "0<x<y<z<1",
    "0\\le x<y\\le z<1",
    "0\\ge x>y\\ge z>1",
    "x=y=z=1",
    /// parent = DoubleInequality
    "x<y<x+1",
    "(b\\o{with}b=3)\\le y\\le x+3",
    /// parent = BinaryOperator
    // parent = Exponent
    "x^{2}",
    "4^{2}",
    "(-5)^{2}",
    "f(x)^{2}",
    "P.x^{2}",
    "L[5]^{4}",
    "(2^{3})^{4}",
    "x!^{4}",
    "2^{3^{4}}",
    "2^{a\\o{with}a=3}",
    "\\frac{1}{2}^{\\frac{3}{4}}",
    // parent = Multiply
    "x*y*z",
    "x*(y*z)",
    "(x+y)*z",
    "x*(y+z)",
    "-x*y",
    "x*-y",
    "x!*y",
    "x*y!",
    "x^{2}*y^{2}",
    "4*\\frac{2}{3}",
    // CrossMultiply involvement
    "(x*y)\\times z",
    "x*(y\\times z)",
    "x\\times (y*z)",
    "(x\\times y)*z",
    "\\frac{x\\times y}{3}",
    // parent = Divide
    "\\frac{a\\o{with}a=3}{b\\o{with}b=2}+4",
    "\\frac{\\frac{1}{2}}{\\frac{3}{4}}",
    "\\frac{1+2}{3*4}",
    // parent = Add
    "x+y+z",
    "x+(y+z)",
    "x+y*z",
    "x*y+z",
    "(b\\o{with}b=3)+x",
    "\\frac{2}{3}+4",
    // parent = Subtract
    "1-2-3",
    "1-(2-3)",
    "1+2-3",
    "1-(2+3)",
    "(b\\o{with}b=3)-x",
    "-x-y",
    "x--y",
    "x*y-z",
    "x-y*z",
    /// parent = Negative
    "-(x-y)",
    "-(b\\o{with}b=3)",
    "-(x*y)",
    "-5",
    "-x!",
    "-x^{2}",
    "-L.x",
    /// parent = Norm
    "\\left|x+y\\right|",
    "\\left|b\\o{with}b=3\\right|",
    "\\left|(3,4)\\right|",
    // From TETH
    "\\left|x-y\\right|+\\left|\\left|x+y+\\left|x\\right|\\right|-x\\right|=1",
    /// parent = FunctionCall
    "f((b\\o{with}b=3),4+5,b\\o{with}b=3)",
    "f(2*3,L[5])",
    // special cases of FunctionCall
    "\\sqrt{x}",
    "\\sqrt\\[5\\]{x}",
    "\\o{log}(x)",
    "\\log_{x+y}(x-y)",
    "\\o{sin}(x)",
    // fragile names
    "\\o{polyGamma}(x,2)",
    "\\o{argmin}([1,2,x])",
    "\\o{argmax}([1,2,x])",
    "\\o{uniquePerm}([1,2,x])",
    "\\o{rtxsqpone}(x)",
    "\\o{rtxsqmone}(x)",
    "\\o{hypot}(x,y)",
    /// parent = factorial
    "x!!!",
    "L[x]!",
    "x^{2}!",
    "(-x)!",
    "(x+2)!",
    /// parent = ListComprehension
    "a+b\\o{for}a=[1...5]",
    "[a+b\\o{for}a=[1...5]]",
    "[a+b\\o{for}a=[2...6],b=[-3...4]]",
    "[(a,a)\\o{for}1<a\\le 3]",
    "[(a,a+i)\\o{for}1\\le a<3,i=[1...3]]",
    "[(a,a+b,b)\\o{for}1\\le a<3,3\\le b\\le c]",
    "[P\\o{for}1\\le a<3,3\\le b\\le c,i=[1],j=[1],k=[2]]",
    "[a\\o{with}a=b+3\\o{for}b=[-3...4]]",
    /// parent = Substitution
    "a+(1,1)\\o{with}a=(1,2)",
    "(b\\to a+1,c\\to a-1)\\o{with}a=3",
    // TODO fix this: "with" needs a different precedence for itself and its children.
    // "b\\to 4,(c\\to a-1\\o{with}a=3)",
    "b\\to 4,c\\to a-1\\o{with}a=3",
    /// parent = Seq
    "a\\to a+1,b\\to b-1",
    "((a\\o{with}a=3),x+3)",
    "(5*x,b\\o{with}b=3)",
    /// parent = Prime
    "f''(x)",
    "f''(2*3)",
    "f'(b\\o{with}b=3)",
    /// parent = Visualization
    "\\o{stats}([1,2,3])",
    "\\o{boxplot}([1,2,3,5,4]+L)",
    "\\o{dotplot}(L*M)",
    "\\o{histogram}([1,2,3],4)",
    "\\o{ttest}((b\\o{with}b=[1,2,3]),[4,5,6])",
    "\\o{ttest}([i+j\\o{for}i=[1...5],j=L])",
    /// parent = List
    "[1,2,3]",
    "[(b\\o{with}b=3),2,b\\o{with}b=3]",
    "[b\\o{with}b=3]",
    /// parent = Restriction
    "y=x\\cdot \\{\\}",
    "y=x\\cdot \\{x=5\\}",
    "y=x\\cdot \\{x=5,y=4\\}",
    "y=x\\cdot \\{x=5,y=4,z>7\\}",
    /// parent = Piecewise or Restriction
    "\\{x=5:2,y=4\\}",
    "\\{x>1:3+x,5*y\\}",
    "\\{x>1:5\\}",
    "\\{x>1\\}",
    "\\{x>1:5,x<0:3,45\\}",
    "\\{x>1:(b\\o{with}b=3),x<0:(b\\o{with}b=3),b\\o{with}b=3\\}",
    "\\{x>1:(b\\o{with}b=3),x<0:b\\o{with}b=3\\}",
    /// parent = Range
    "[1...5]",
    "[1,2,3...9,10,11]",
    "[1+2,(b\\o{with}b=3)...(b\\o{with}b=4),b\\o{with}b=5]",
    /// parent = ???? default
  ];
  roundTrips(cases);
});

describe("Identifiers round-trip", () => {
  const cases = [
    "a_{bcd}",
    "t_{heta}",
    "\\theta",
    // Bit surprsing that it's \operatorname{sin} instead of just \sin.
    "\\o{sin}(x)",
    "\\o{min}",
    "\\o{min}_{xy}",
    "\\o{hypot}",
    "\\o{dt}",
    "\\o{index}",
    "\\token{123}",
  ];
  roundTrips(cases);
});

function roundTrips(cases: string[]) {
  describe("via Aug", () => cases.forEach(testRoundTripIdenticalViaAug));
  describe("via AST", () => cases.forEach(testRoundTripIdenticalViaAST));
  describe("via Text", () =>
    cases.forEach((r) => testRoundTripIdenticalViaText(r, {})));
  describe("via Text without optional spaces", () =>
    cases.forEach((r) =>
      testRoundTripIdenticalViaText(r, {
        noOptionalSpaces: true,
      })
    ));
  describe("via Text without newlines", () =>
    cases.forEach((r) =>
      testRoundTripIdenticalViaText(r, {
        noNewlines: true,
      })
    ));
  describe("via Text without newlines or optional spaces", () =>
    cases.forEach((r) =>
      testRoundTripIdenticalViaText(r, {
        noNewlines: true,
        noOptionalSpaces: true,
      })
    ));
}

describe("Same-parse round trips", () => {
  const { raw } = String;

  const cases: string[] = [
    raw`A_{main}\left(d\right)=A_{T}\left(d\right),\ A_{horizScroll}\left(0\right),\ A_{vertScroll}\left(0\right),\left\{Q_{pauseEval}=0:\ \left\{Q_{landscape}=1:\ A_{E}\left(0\right)\right\}\right\},\ A_{drag}\left(0\right),\ A_{scrollbarWidth}\left(0\right)`,
    raw`x_{1}\left(y\right)=1-4^{\operatorname{round}\left(\log_{4}\left(\left|3y-1\right|\right)-0.5b\right)+0.5b}`,
    raw`u=\left\{\frac{1}{3}+\frac{1}{6}\left(-2\right)^{\operatorname{floor}\left(\log_{2}\left(1-x\right)\right)}<y:\left\{0<x,0\right\},0\right\}`,
    raw`C\left(p\right)=\left(1-t\right)^{3}p\left[1\right]+3t\left(1-t\right)^{2}p\left[2\right]+3t^{2}\left(1-t\right)p\left[3\right]+t^{3}p\left[4\right]`,
    raw`\left[P\left(C_{1}\left(\left(x_{30},y_{30}\right)\left[1...4\right],\left[1-t,t-1\right]\right)\right),P\left(C_{1}\left(\left(x_{31},y_{31}\right)\left[1...4\right],\left[1-t,t-1\right]\right)\right)\right]+0.25\left(2\cos\left(17\tau t\right),\sin\left(27\tau t\right)\right)t\left(t-1\right)^{2}\left(t-2\right)`,
    raw`y=-0.8605\sum_{n=1}^{13}\frac{\prod_{i=1}^{n}\left(2i-1\right)^{2}}{0.76075^{2n}\left(2n\right)!\left(2n-1\right)}\left(x-0.36125\right)^{2n}+8.181\left\{-0.1676\le x\le0.225\right\}`,
    raw`r_{otate}\left(p,\theta\right)=\left(p.x\cos\left(\tau\theta\right)+p.y\sin\left(\tau\theta\right),-p.x\sin\left(\tau\theta\right)+p.y\cos\left(\tau\theta\right)\right)`,
    raw`\left[\operatorname{polygon}\left(\left(\frac{\left(-2\right)^{i-1}-1}{3},\frac{2-2^{i}3}{2}+2b_{ounce}\left(t+1.1-1.1^{-i}\right)\right)+\frac{\left(\left[-1,1,1,-1\right],\left[-1,-1,1,1\right]\right)}{2^{1-i}}\right)\operatorname{for}i=-\left[0...7\right],t=T+\frac{l}{2}\right]`,
    raw`x=-0.4y-24\left\{0<0.6y-73\right\}\left\{1.2x>0.6y-166\right\}\left\{x<-0.4y-12.3\right\}\left\{\right\}`,
    raw`\o{factorial}(x)`,
  ];
  cases.forEach(testRoundTripParsesSame);
});
