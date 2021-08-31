import { Assignment, Constant, FunctionDefinition } from "parsing/parsenode";
import { satisfiesType } from "parsing/nodeTypes";
import { builtins, getDependencies, getDefinition } from "./builtins";
import { ComputedContext } from "./computeContext";

export function orderDeps(context: ComputedContext, implicitIDs: string[]) {
  // topological order
  // assumes no cyclic dependencies (Desmos deal with this for us
  // by setting context.frame[id].type = "Error" instead of "FunctionDefinition")

  /*
  Suppose we have
    [implicit:] 0 = f(y)
    f(x) = g(x) · h(x)
    h(x) = 1 + g(x)
    g(x) = sqrt(x)
  Then we will push, in this order:
    f, (from implicit)
    g, h (from f)
    g (from h)
  We output in reversed order, with duplicates removed: g,h,f
  */

  let builtinFuncs = [];
  let builtinConsts = [];
  let funcsWithDuplicates = [];
  let varsWithDuplicates = [];
  for (let id of implicitIDs) {
    const analysis = context.analysis[id];
    // appease type checker; getImplicits() already excludes errors
    if (satisfiesType(analysis.rawTree, "Error")) continue;

    let deps = analysis.rawTree.getDependencies();
    let d;
    while ((d = deps.pop()) !== undefined) {
      let frameDep = context.frame[d];
      if (frameDep === undefined || d in builtins || !("type" in frameDep)) {
        if (d === "x" || d === "y") {
          continue;
        }
        // frameDep is {isFunction: true} or it's a function
        // this is a built-in like sin or abs
        builtinFuncs.push(d);
        deps.push(...getDependencies(d));
      } else {
        if (satisfiesType(frameDep, "FunctionDefinition")) {
          funcsWithDuplicates.push(d);
          deps.push(...frameDep.getDependencies());
        } else if (satisfiesType(frameDep, "Assignment")) {
          varsWithDuplicates.push(d);
          deps.push(...frameDep.getDependencies());
        } else if (satisfiesType(frameDep, "Constant")) {
          // this is e, pi, tau, infty, or trigAngleMultiplier
          builtinConsts.push(d);
        } else {
          throw `Dependency is of type ${frameDep.type}, but it is expected to be FunctionDefinition or Assignment`;
        }
      }
    }
  }

  return {
    funcs: reverseUnique(funcsWithDuplicates).map(
      (c) => context.frame[c] as FunctionDefinition
    ),
    vars: reverseUnique(varsWithDuplicates).map(
      (c) => context.frame[c] as Assignment
    ),
    builtinFuncs: reverseUnique(builtinFuncs).map(getDefinition),
    builtinConsts: reverseUnique(builtinConsts).map((c) => ({
      name: c,
      value: context.frame[c] as Constant,
    })),
  };
}

function reverseUnique(a: string[]) {
  let ordered: string[] = [];
  for (let i = a.length - 1; i >= 0; i--) {
    let c = a[i];
    if (!ordered.includes(c)) {
      ordered.push(c);
    }
  }
  return ordered;
}
