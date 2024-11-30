import { replacer } from "./backend";
import "../../tests/run_calc_for_tests";

function testRepl(from: string, to: string, cases: [string, string][]) {
  const repl = replacer(from, to);
  describe(`/${from}/${to}/`, () => {
    for (const [s, exp] of cases) {
      test(s, () => {
        const r = repl(s);
        expect(r).toBe(exp);
      });
    }
  });
}

describe("Find-replace string", () => {
  testRepl("<", "\\le", [
    ["y<x<2", "y\\le x\\le2"],
    ["\\width<x<y", "\\width\\le x\\le y"],
  ]);
  testRepl("x^{2}", "u", [
    ["x^{2}<\\sin(x^{2})+x<x^{2}", "u<\\sin(u)+x<u"],
    ["\\int_{1}^{x^{2}} x^{2} dx", "\\int_{1}^{u} u dx"],
  ]);
});

describe("Find-replace identifier", () => {
  testRepl("x", "u", [
    ["y<x<2", "y<u<2"],
    ["x_{123}+x+a_{12x34}", "x_{123}+u+a_{12x34}"],
  ]);
  testRepl("x_{2}", "u", [["x_{2}<x_{23}+x_{2}<x+x_{2}", "u<x_{23}+u<x+u"]]);
  testRepl("x_{2}", "(a+b)", [["x_{2}^{3}", "(a+b)^{3}"]]);
});

describe("Find-replace empty string", () => {
  testRepl("", "u", [
    ["y<x<2", "y<x<2"],
    ["x_{123}+x+a_{12x34}", "x_{123}+x+a_{12x34}"],
  ]);
});
