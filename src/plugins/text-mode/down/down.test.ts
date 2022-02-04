import textToAST from "./textToAST";
import astToAug from "./astToAug";

function compileExpr(s: string) {
  const augLatex = astToAug(textToAST(`show ${s} @{id:"1",color:"#FFF"}`))
    .expressions.list[0];
  if (augLatex.type !== "expression") throw "Expected expression";
  return augLatex.latex;
}

function constant(x: number) {
  return {
    type: "Constant",
    value: x,
  };
}

test("Compiles 1", () => {
  expect(compileExpr("1")).toEqual(constant(1));
});
