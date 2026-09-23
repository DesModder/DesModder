/**
 * The rewrites here, checked against thousands of expressions nobody chose.
 *
 * Every other test in this directory is a case somebody thought of, which means
 * the cases that are missing are exactly the ones nobody thought of. A rewrite
 * is a claim that two expressions are the same function, and that claim is
 * checkable on any expression at all — so this generates them, runs each
 * rewrite, and evaluates both sides.
 *
 * Deterministic on purpose. A seeded generator means a failure here is a
 * failure anybody can reproduce by running the file again, and a random one
 * would be a test that fails on somebody else's machine and passes on the
 * machine where it is being fixed. The seeds are listed rather than derived
 * from the clock for the same reason.
 *
 * ## Why "inconclusive" is counted rather than ignored
 *
 * A random expression is undefined at most points: a logarithm of something
 * negative, a division by something that came out zero, a power that overflowed.
 * Those points cannot decide anything and are skipped — but skipping quietly is
 * how a check that never checks anything passes. So every tree records whether
 * it was decided, and the suite fails if too few were.
 */
import { condense } from "./condense";
import { evaluate, type Bindings } from "./evaluate";
import { expand, EXPANSION_LIMIT } from "./expand";
import { fold } from "./fold";
import {
  dependsOn,
  exceedsNodeCount,
  identifiersIn,
  nodeCount,
  sameTree,
  type Node,
} from "./tree";
import { AugBuilders } from "../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

/**
 * A 32-bit linear congruential generator.
 *
 * Its own rather than `Math.random`, because the point is that the same trees
 * come out on every machine and in every run.
 */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const NAMES = ["x", "y", "k"];
const CALLS = ["sin", "cos", "exp", "ln", "sqrt", "abs", "tanh"];

/**
 * A random expression of at most `depth` operators.
 *
 * Weighted toward the shapes the rewrites actually handle — sums, products,
 * quotients, small integer powers — because a generator that spent its time on
 * node types nothing here touches would run thousands of trees through the
 * default branch and prove nothing.
 */
function randomTree(next: () => number, depth: number): Node {
  if (depth <= 0) {
    const pick = next();
    if (pick < 0.45) return id(NAMES[Math.floor(next() * NAMES.length)]);
    if (pick < 0.55) return id(next() < 0.5 ? "e" : "pi");
    return number(Math.floor(next() * 9) - 4);
  }
  const pick = next();
  const child = () => randomTree(next, depth - 1);
  if (pick < 0.18) return binop("Add", child(), child());
  if (pick < 0.34) return binop("Subtract", child(), child());
  if (pick < 0.54) return binop("Multiply", child(), child());
  if (pick < 0.68) return binop("Divide", child(), child());
  if (pick < 0.78)
    return binop("Exponent", child(), number(Math.floor(next() * 5) - 1));
  if (pick < 0.88) return negative(child());
  return functionCall(id(CALLS[Math.floor(next() * CALLS.length)]), [child()]);
}

/** Points spread over a range where the ordinary functions are defined. */
const SAMPLES: readonly Bindings[] = [
  { x: 0.37, y: 1.21, k: 2.3 },
  { x: 0.83, y: 0.44, k: 1.7 },
  { x: 1.29, y: 2.05, k: 0.9 },
  { x: 1.74, y: 0.71, k: 3.1 },
  { x: 2.16, y: 1.58, k: 1.4 },
  { x: 2.62, y: 0.29, k: 2.8 },
  { x: 3.08, y: 1.93, k: 0.6 },
  { x: 3.51, y: 2.47, k: 1.1 },
];

type Verdict = "same" | "different" | "undecided";

/**
 * Whether two trees evaluate the same wherever both are defined.
 *
 * The tolerance is relative and loose. These are floating-point evaluations of
 * expressions that may have gone through several rewrites, and a product of
 * exponentials reaches magnitudes where the last few digits are noise; the
 * failure this is looking for is a dropped term or a lost sign, which is never
 * a part-per-million difference.
 */
function compare(before: Node, after: Node): Verdict {
  let decided = 0;
  for (const bindings of SAMPLES) {
    const a = evaluate(before, bindings);
    const b = evaluate(after, bindings);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    // Beyond this the difference between two orders of the same arithmetic is
    // larger than any tolerance worth setting, and says nothing about the
    // rewrite.
    if (Math.abs(a) > 1e12 || Math.abs(b) > 1e12) continue;
    decided += 1;
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    if (Math.abs(a - b) > 1e-7 * scale) return "different";
  }
  return decided >= 2 ? "same" : "undecided";
}

interface Tally {
  same: number;
  undecided: number;
  failures: { seed: number; index: number }[];
}

function sweep(
  label: string,
  rewrite: (node: Node) => Node,
  options: { depth?: number; trees?: number } = {}
) {
  const { depth = 4, trees = 400 } = options;
  const tally: Tally = { same: 0, undecided: 0, failures: [] };
  for (const seed of [1, 7, 31, 127, 8191]) {
    const next = generator(seed);
    for (let index = 0; index < trees; index += 1) {
      const before = randomTree(next, depth);
      const after = rewrite(before);
      const verdict = compare(before, after);
      if (verdict === "different") tally.failures.push({ seed, index });
      else if (verdict === "same") tally.same += 1;
      else tally.undecided += 1;
    }
  }
  // Named in the assertion so a failure says which rewrite and which tree,
  // which is the whole value of a seeded generator.
  expect({ label, failures: tally.failures }).toEqual({ label, failures: [] });
  // A sweep that decided almost nothing would pass while testing nothing.
  expect({ label, decided: tally.same > tally.undecided }).toEqual({
    label,
    decided: true,
  });
  return tally;
}

describe("a rewrite never changes what an expression means", () => {
  test("fold", () => {
    sweep("fold", fold);
  });

  test("expand", () => {
    sweep("expand", (node) => expand(node).node);
  });

  test("condense", () => {
    sweep("condense", (node) => condense(node).node);
  });

  test("expand then condense, which is every rewrite in one pass", () => {
    sweep("expand+condense", (node) => condense(expand(node).node).node);
  });

  test("condense then expand, the other way round", () => {
    sweep("condense+expand", (node) => expand(condense(node).node).node);
  });
});

describe("the rewrites settle rather than run", () => {
  test("fold is idempotent, which is what lets its results be cached", () => {
    // Also the property that makes `fold` safe to call defensively: a caller
    // that folds something already folded should pay nothing and change
    // nothing.
    for (const seed of [2, 11, 97, 1009]) {
      const next = generator(seed);
      for (let index = 0; index < 400; index += 1) {
        const once = fold(randomTree(next, 4));
        const twice = fold(once);
        expect({ seed, index, stable: sameTree(once, twice) }).toEqual({
          seed,
          index,
          stable: true,
        });
      }
    }
  });

  test("expand is idempotent, and never exceeds its own ceiling", () => {
    for (const seed of [3, 13, 101]) {
      const next = generator(seed);
      for (let index = 0; index < 300; index += 1) {
        const once = expand(randomTree(next, 4)).node;
        const twice = expand(once).node;
        expect({ seed, index, stable: sameTree(once, twice) }).toEqual({
          seed,
          index,
          stable: true,
        });
        expect({
          seed,
          index,
          within: nodeCount(once) <= EXPANSION_LIMIT,
        }).toEqual({ seed, index, within: true });
      }
    }
  });

  test("condense is idempotent", () => {
    for (const seed of [5, 23, 211]) {
      const next = generator(seed);
      for (let index = 0; index < 300; index += 1) {
        const once = condense(randomTree(next, 4)).node;
        const twice = condense(once).node;
        expect({ seed, index, stable: sameTree(once, twice) }).toEqual({
          seed,
          index,
          stable: true,
        });
      }
    }
  });

  test("a rewrite that changed nothing reports no notes", () => {
    // The panel uses empty notes to decide whether to offer a second form at
    // all, so "nothing to say" and "nothing done" have to be the same thing.
    const next = generator(17);
    for (let index = 0; index < 600; index += 1) {
      const before = fold(randomTree(next, 4));
      for (const [label, result] of [
        ["expand", expand(before)],
        ["condense", condense(before)],
      ] as const) {
        if (result.notes.length !== 0) continue;
        expect({
          label,
          index,
          unchanged: sameTree(before, result.node),
        }).toEqual({ label, index, unchanged: true });
      }
    }
  });
});

describe("the tree utilities agree with each other", () => {
  test("dependsOn finds exactly the identifiers identifiersIn lists", () => {
    const next = generator(29);
    for (let index = 0; index < 800; index += 1) {
      const node = randomTree(next, 4);
      const listed = identifiersIn(node);
      for (const name of [...NAMES, "e", "pi", "notpresent"]) {
        expect({
          index,
          name,
          agree: dependsOn(node, name) === listed.includes(name),
        }).toEqual({ index, name, agree: true });
      }
    }
  });

  test("exceedsNodeCount answers what nodeCount would", () => {
    const next = generator(37);
    for (let index = 0; index < 600; index += 1) {
      const node = randomTree(next, 4);
      const size = nodeCount(node);
      for (const limit of [0, 1, 4, size - 1, size, size + 1, 1000]) {
        if (limit < 0) continue;
        expect({
          index,
          limit,
          agree: exceedsNodeCount(node, limit) === size > limit,
        }).toEqual({ index, limit, agree: true });
      }
    }
  });

  test("sameTree is reflexive across a rebuilt copy, and rejects a change", () => {
    const next = generator(41);
    for (let index = 0; index < 600; index += 1) {
      const node = randomTree(next, 4);
      // A structural copy through JSON has different object identity and the
      // same content, which is what the old `JSON.stringify` spelling could
      // not be trusted to see once keys were rebuilt in another order.
      const copy = JSON.parse(JSON.stringify(node)) as Node;
      expect({ index, equal: sameTree(node, copy) }).toEqual({
        index,
        equal: true,
      });
      expect({
        index,
        equal: sameTree(node, binop("Add", node, number(1))),
      }).toEqual({ index, equal: false });
    }
  });

  test("key order does not decide whether two trees are the same", () => {
    // The concrete case the structural walk fixed: `{ ...node, args }` rebuilds
    // a call with its fields in a different order, and the two are the same
    // expression.
    const call = functionCall(id("sin"), [id("x")]);
    const reordered = { args: call.args, callee: call.callee, type: call.type };
    expect(Object.keys(call)).not.toEqual(Object.keys(reordered));
    expect(sameTree(call, reordered as Node)).toBe(true);
  });
});
