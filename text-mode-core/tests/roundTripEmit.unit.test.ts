import { astToText, buildConfig } from "..";
import { parse } from "../down/textToAST";
import { TextEmitOptions } from "../up/astToText";

/** Round-trip Text code through AST, and make sure you get back what you started. */
function testRoundTripIdenticalViaAST(text: string, emitOpts: TextEmitOptions) {
  test(text, () => {
    const analysis = parse(buildConfig({}), text);
    expect(analysis.diagnostics).toEqual([]);
    const children = analysis.program.children;
    expect(children.length).toEqual(1);
    const item = children[0];
    const emitted = astToText(item, emitOpts);
    expect(emitted).toBe(text);
  });
}

describe("Text Emit round-trips (keeping optional spaces)", () => {
  const cases: string[] = [
    `[x for x = [1 ... 5]]`,
    // TODO: what happens if multiple regression params?
    `e_1 = a ~ a #{
      a = 1
    }`,
    `image "name" @{
      url: "data:image/png;base64,aaaaaaaaaaaaaaaaaaaaaa",
      width: 10,
      height: 10,
      center: (0, 0),
    }`,
    `table {
      x_1 = [1, 2, 3]
      
      y_1 = [4, 5, 6] @{ color: "#2d70b3" }
    }`,
    `"asdfasdf"`,
    `folder "title" {
      (1, a) @{
        points: @{
          opacity: 0.8,
          style: "OPEN",
          drag: "NONE",
          size: 1 + 1 + 1 + 1 + 1 + 1,
        },
      }

      y = sin(x ^ 2)
    }`,
    `ticker a -> a + 1 @{ minStep: 123 }`,
    `y = f''''(x)`,
    `y = arctan(y, x)`,
    `(d/d x) (x ^ 2)`,
    `sum n=(1 ... 5) (n ^ 2)`,
    `[1, 2, 3, 4]`,
    `[1, 3 ... 11, 13]`,
    `L[1 ... 5]`,
    `L[1, 2, 3, 4]`,
    `L[M]`,
    `L.x`,
    // TODO: parentheses are unnecessary here
    `(uniformdist()).random()`,
    `(1, 2), (3, 4)`,
    `a -> a + 1, b -> b - 1`,
    `[a + 1 for a = [1 ... 5]]`,
    `[b + a for b = [1 ... 5], a = [1 ... 3]]`,
    `sin(x) with x = 5`,
    `x + y with x = 5, y = -5`,
    `{}`,
    // TODO: preserve (lack of) `:1` in round-trip
    `{x > 5: 1}`,
    `{x > 5: 2}`,
    `{x > 5: 2, 3}`,
    // TODO: preserve (lack of) `:1` in round-trip
    `{x > 5: 1, 3}`,
    `{x > 5: 1, y < 6: 2}`,
    `x ^ 2 * sin(x)`,
    `(x / y) * z`,
    `2 < x < 5`,
    `-sin(-x)`,
    `|(2, x)|`,
    `sin(x!)!`,
    `y = 1e99 - 1 / 1e-99`,
    `y = 100000 - 0.000001`,
    // TODO: NaN support
    `y = infty ^ 3 + (-infty) ^ 3`,
  ].map(dedentString);
  for (const text of cases) {
    testRoundTripIdenticalViaAST(text, {});
  }
});

describe("Text Emit round-trips (discarding optional spaces)", () => {
  const cases: string[] = [
    `[x for x=[1...5]]`,
    `[x+1 for x=[1...5]]`,
    `e_1=a~a#{
      a=1
    }`,
    `image"name name"@{
      url:"data:image/png;base64,aaaaaaaaaaaaaaaaaaaaaa",
      width:10,
      height:10,
      center:(0,0),
    }`,
    `table{
      x_1=[1,2,3]
      
      y_1=[4,5,6]@{color:"#2d70b3"}
    }`,
    `"note note"`,
    `folder"title title"{
      (1,a)@{points:@{size:1}}
      
      y=sin(x^2)
    }`,
    `ticker a->a+1@{minStep:123}`,
    `ticker|x|`,
    `y=f''''(x)`,
    `y=arctan(y,x)`,
    `(d/d x)(x^2)`,
    `sum n=(1...5)(n^2)`,
    `[1,2,3,4]`,
    `[1,3...11,13]`,
    `L[1...5]`,
    `L[1,2,3,4]`,
    `L[M]`,
    `L.x`,
    `(1,2),(3,4)`,
    `a->a+1,b->b-1`,
    `[sin(a)for a=[1...5]]`,
    `[b+a for b=[1...5],a=[1...3]]`,
    `sin(x)with x=5`,
    `x+y with x=5,y=-5`,
    `{x>5:2}`,
    `{x>5:1,y<6:2,3}`,
    `x^2*sin(x)`,
    `(x/y)*z`,
    `2<x<5`,
    `|(2,x)|`,
    `sin(x!)!`,
    `y=1e99-1/1e-99`,
  ].map(dedentString);
  for (const text of cases) {
    testRoundTripIdenticalViaAST(text, { noOptionalSpaces: true });
  }
});

describe("Text Emit round-trips (discarding newlines and optional spaces)", () => {
  const cases: string[] = [
    `e_1=a~a#{a=1}`,
    `image"name name"@{url:"data:image/png;base64,aaaaaaaaaaaaaaaaaaaaaa",width:10,height:10,center:(0,0)}`,
    `table{x_1=[1,2,3];y_1=[4,5,6]@{color:"#2d70b3"}}`,
    `folder"title title"{(1,a)@{points:@{size:1}};y=sin(x^2)}`,
    `y=1e99-1/1e-99!`,
  ].map(dedentString);
  for (const text of cases) {
    testRoundTripIdenticalViaAST(text, {
      noNewlines: true,
      noOptionalSpaces: true,
    });
  }
});

describe("Text Emit round-trips (discarding newlines)", () => {
  const cases: string[] = [
    `e_1 = a ~ a #{ a = 1 }`,
    `image "name name" @{ url: "data:image/png;base64,aaaaaaaaaaaaaaaaaaaaaa", width: 10, height: 10, center: (0, 0) }`,
    `table {x_1 = [1, 2, 3];y_1 = [4, 5, 6] @{ color: "#2d70b3" }}`,
    `folder "title title" {(1, a) @{ points: @{ size: 1 } };y = sin(x ^ 2)}`,
    `y = 1e99 - 1 / 1e-99!`,
  ].map(dedentString);
  for (const text of cases) {
    testRoundTripIdenticalViaAST(text, { noNewlines: true });
  }
});

function dedentString(str: string) {
  const lines = str.split("\n");
  const trailingLines = lines.slice(1);
  if (lines.length <= 1) return str;
  const dedentAmount = Math.min(
    ...trailingLines
      .filter((line) => /\S/.test(line))
      .map((line) => line.match(/^\s*/)![0].length)
  );
  let s = lines[0];
  for (const line of trailingLines) {
    s += "\n" + (/\S/.test(line) ? line.slice(dedentAmount) : "");
  }
  return s;
}
