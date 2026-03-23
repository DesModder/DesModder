import { Config } from "./config";
import {
  finalBracketSubs,
  finalFunctionSubs,
  finalGreekSubs,
  finalLatinSubs,
  finalSymbolSubs,
  functionSubs,
  greekSubs,
  latinSubs,
  symbolSubs,
} from "./substitutions.ts";

// IMPORTANT
// isIllegalASCIIMath() is REQUIRED BEFORE executing wolfram2desmos()
// If isIllegalASCIIMath() = false, THEN DON'T RUN wolfram2desmos()
// Ensure that JS DOESN'T override the clipboard
// Besides that, this should work flawlessly! Enjoy!

export function isIllegalASCIIMath(input: string) {
  const count = (expr: RegExp) => input.match(expr)?.length ?? 0;

  return !(
    // checks for illegal characters
    (
      input.search(/\\/) !== -1 ||
      input.search(/\n/) !== -1 ||
      input.search(/(?<=_|\^|\\\w+|\S]|}){/) !== -1 ||
      input.search(/\/\//) !== -1 ||
      // determines if the brackets are correct
      count(/\(/g) !== count(/\)/g) ||
      count(/\{/g) !== count(/\}/g) ||
      count(/\[/g) !== count(/\]/g) ||
      count(/\|/g) % 2 === 1
    )
  );
}

export function wolfram2desmos(input: string, config: Config): string {
  // FUNCTIONS
  // returns the first match's index
  const find = (expr: RegExp) => input.search(expr);

  // returns the last match's index (requires global expr)
  function findFinal(expr: RegExp): number {
    const recent = [...input.matchAll(expr)];
    return recent.at(-1)?.index ?? -1;
  }

  // replaces all matches with replacement
  function replace(expr: RegExp, replacement: string): void {
    input = input.replace(expr, replacement);
  }

  // inserts replacement at given index
  function insert(index: number, replacement: string): void {
    if (index >= 0) {
      input =
        input.slice(0, index) + replacement + input.slice(index, input.length);
    }
  }

  // overwrites current index with replacement
  function overwrite(index: number, replacement: string): void {
    input =
      input.slice(0, index) +
      replacement +
      input.slice(index + 1, input.length);
  }

  // iterates the bracket parser
  function bracketEval(): void {
    if (input[i] === ")") {
      bracket++;
    } else if (input[i] === "(") {
      bracket--;
    }
  }

  // iterates the bracket parser with {} in mind
  function bracketEvalFinal(): void {
    if (/[)}〕]/.test(input[i])) {
      bracket++;
    } else if (/[({〔]/.test(input[i])) {
      bracket--;
    }
  }

  // checks if its an operator
  const isOperator0 = (x: number) =>
    [
      "+",
      "-",
      "±",
      "*",
      "=",
      ">",
      "<",
      "≥",
      "≤",
      "≠",
      "→",
      " ",
      "〔",
      "〕",
      ":",
    ].includes(input[x]);

  const isOperator1 = (x: number) =>
    [
      "+",
      "-",
      "±",
      "*",
      "=",
      ">",
      "<",
      "≥",
      "≤",
      "≠",
      "→",
      "/",
      "%",
      "〔",
      "〕",
      ":",
    ].includes(input[x]);

  const isOperator2 = (x: number) => ["^", "_"].includes(input[x]);

  // PREPARATIONS
  // predefine some variables.
  let i: number;
  let bracket: number;
  let startingIndex: number;
  let selection!: string;
  let temp: string | boolean;
  const functionSymbols = /^[a-wΑ-ωⒶ-ⓏＡ-Ｚ⒜-⒵√%][(_^]/gi;
  input = ` ${input} `; // this gives some breathing space

  for (const [original, replacement] of symbolSubs) {
    replace(original, replacement);
  }

  const pieceWiseBracketRegex = /(?<!_|\^|\\\w+|\S]|}){/;
  // replace piecewise {} brackets with special character
  while (find(pieceWiseBracketRegex) !== -1) {
    startingIndex = find(pieceWiseBracketRegex);
    i = startingIndex + 1;
    bracket = -1;

    for (i; i <= input.length; i++) {
      bracketEvalFinal();
      if (bracket === 0) {
        overwrite(startingIndex, "〔");
        overwrite(i, "〕");
        break;
      }
    }
  }

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏＡＢＣＤ
  for (const [original, replacement] of functionSubs) {
    replace(original, replacement);
  }

  const modRegex = /(?<![A-Za-zΑ-ω])mod(?![A-Za-zΑ-ω])/;

  // ＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  while (find(modRegex) !== -1) {
    i = find(modRegex) + 4;
    bracket = -1;

    for (i; i <= input.length; i++) {
      bracketEval();
      if (input[i] === "," && bracket === -1) {
        replace(modRegex, "Ｅ");
        break;
      }

      if (bracket === 0) {
        replace(modRegex, "%");
        break;
      }
    }
  }

  replace(/(?<![A-Za-zΑ-ω])abs(olute|)/g, "Ｆ");
  while (find(/\|/) !== -1) {
    i = find(/\|/);
    overwrite(i, "Ｆ(");
    bracket = -1;
    i += 2;

    for (i; i <= input.length; i++) {
      bracketEvalFinal();
      if (bracket === -1 && input[i] === "|") {
        overwrite(i, ")");
        break;
      }
    }
  }

  for (const [original, replacement] of latinSubs) {
    replace(original, replacement);
  }

  if (find(/d(\^\d*)*\/dx(\^\d*)*/) !== -1) {
    i = find(/d(\^\d*)*\/dx(\^\d*)*/);
    [selection] = input.match(/(?<=\^)(\d*)/) ?? [""];
    replace(/d(\^\d*)*\/dx(\^\d*)*/, "");
    insert(i, "Ｍ");
    insert(i + 1, "^(" + selection + ")");
  }

  // unused: ⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵

  // dead space removal
  replace(/(?<=[/^_√∛%])\s*/g, "");
  replace(/\s*(?=[/^_%])/g, "");

  // trail removal
  replace(/\sfor(?!.*\sfor).*/g, "");
  replace(/\(Taylor series\)/g, "");

  // greek replacements
  for (const [original, replacement] of greekSubs) {
    replace(original, replacement);
  }

  const missingBracketsRegex = /[/^_√∛%](?!\()/g;

  // MISSING BRACKETS
  // this will ensure brackets AFTER each operator
  while (findFinal(missingBracketsRegex) !== -1) {
    i = findFinal(missingBracketsRegex) + 1;
    insert(i, "(");
    temp = input.slice(i - 2, i);
    temp = temp.search(functionSymbols) !== -1;
    bracket = -1;
    selection = input.slice(i + 1, input.length);

    if (/^[-+±]/.test(selection)) {
      i++;
    }

    if (selection.search(functionSymbols) === 0 && selection[1] === "(") {
      i++;
    } else if (selection.search(/([0-9]*[.])?[0-9]+/) === 0) {
      i += selection.match(/([0-9]*[.])?[0-9]+/)?.[0]?.length ?? 0;
      if (input[i + 1] === "(") {
        insert(i + 1, ")");
        continue;
      }
    }

    while (true) {
      i++;
      bracketEval();

      // This can probably be simplified
      if (
        bracket === 0 ||
        (bracket === -1 &&
          (isOperator1(i) || /[ ,:]/.test(input[i]) || i === input.length)) ||
        (temp &&
          (((isOperator1(i) || isOperator2(i)) && bracket === -1) ||
            (input[i] === "(" && bracket === -2)))
      ) {
        break;
      }

      if (bracket === -1 && isOperator2(i)) {
        i++;
        bracket--;
      }
    }

    insert(i, ")");
  }

  // this will ensure brackets BEFORE each DIVISION | MODULO
  while (find(/\/|%/) !== -1) {
    startingIndex = find(/\/|%/);
    i = startingIndex - 1;
    temp = false;

    if (input[startingIndex] === "/") {
      replace(/\//, "╱");
    } else {
      replace(/%/, "⁒");
    }

    // preceded by a ")" scenario
    if (input[i] === ")") {
      bracket = 1;
      i -= 2;

      for (i; i >= 0; i--) {
        bracketEval();
        if (bracket === 0) {
          temp = input[i] + "(";
          if (
            temp.search(functionSymbols) === 0 ||
            temp === "^(" ||
            temp === "_	("
          ) {
            temp = true;
            break;
          }
        }
      }

      i += 2;
    }

    // preceded WITHOUT a ")" scenario
    if (input[i] !== ")" || temp) {
      insert(startingIndex, ")");
      i = startingIndex - 1;
      bracket = 1;

      for (i; i >= 0; i--) {
        bracketEval();
        if ((isOperator0(i) && bracket === 1) || bracket === 0) {
          insert(i + 1, "(");
          break;
        }
      }

      i++;
    }
  }

  replace(/╱/g, "/");
  replace(/⁒/g, "%");
  // OFFICIAL BRACKET CHECKPOINT REACHED

  // BEGIN LATEX FORMATTING
  // implement function exponents
  while (find(/(?<=[Ⓐ-Ⓩ]\^)\(/) !== -1) {
    startingIndex = find(/(?<=[Ⓐ-Ⓩ]\^)\(/);
    i = startingIndex;
    overwrite(i, "‹");
    bracket = -1;
    i++;

    for (i; i <= input.length; i++) {
      bracketEval();

      if (bracket === 0) {
        overwrite(i, "›");
        break;
      }
    }

    selection = input.slice(startingIndex, i + 1);

    if (
      selection !== "‹2›" &&
      (selection !== "‹-1›" || input[startingIndex - 2] === "Ⓩ")
    ) {
      input =
        input.slice(0, startingIndex - 1) + input.slice(i + 1, input.length);
      i = startingIndex + 1;
      insert(i - 3, "(");
      bracket = -2;

      for (i; i <= input.length; i++) {
        bracketEval();
        if (bracket === -1) {
          insert(i + 1, ")");
          insert(i + 2, "^" + selection);
          break;
        }
      }
    }
  }

  replace(/‹/g, "(");
  replace(/›/g, ")");

  // implement fractions
  while (find(/\//) !== -1) {
    startingIndex = find(/\//);
    i = startingIndex + 1;
    bracket = -1;
    overwrite(i, "{");
    i++;

    for (i; i <= input.length; i++) {
      bracketEval();
      if (bracket === 0) {
        overwrite(i, "}");
        break;
      }
    }

    i = startingIndex;
    bracket = 1;
    overwrite(i, "");
    i--;
    overwrite(i, "}");
    i--;

    for (i; i >= 0; i--) {
      bracketEval();
      if (bracket === 0) {
        overwrite(i, "\\frac{");
        break;
      }
    }
  }

  // implement modulo (BASED ON FRACTION IMPLEMENTATION)
  while (find(/%/) !== -1) {
    startingIndex = find(/%/);
    i = startingIndex + 1;
    bracket = -1;
    overwrite(i, ",");
    i++;

    for (i; i <= input.length; i++) {
      bracketEval();
      if (bracket === 0) {
        overwrite(i, ")");
        break;
      }
    }

    i = startingIndex;
    bracket = 1;
    overwrite(i, "");
    i--;
    overwrite(i, "");
    i--;

    for (i; i >= 0; i--) {
      bracketEval();
      if (bracket === 0) {
        overwrite(i, "Ｅ(");
        break;
      }
    }
  }

  // implement subscripts and superscripts
  while (find(/[_^√∛]\(/) !== -1) {
    i = find(/[_^√∛]\(/) + 1;
    overwrite(i, "{");
    bracket = -1;
    i++;

    for (i; i <= input.length; i++) {
      bracketEval();
      if (bracket === 0) {
        overwrite(i, "}");
        break;
      }
    }
  }

  // remove excess brackets
  while (find(/\\frac{\(/) !== -1) {
    startingIndex = find(/\\frac\{\(/) + 6;
    i = startingIndex + 1; // "("
    bracket = -1;
    temp = false;

    for (i; i <= input.length; i++) {
      bracketEvalFinal();
      if (temp) {
        if (input[i] === "}") {
          overwrite(startingIndex, "❌");
          overwrite(i - 1, "❌");
          break;
        } else if (input[i] !== "}") {
          overwrite(startingIndex, "✅");
          break;
        }
      }

      if (!temp && bracket === 0) {
        temp = true;
      }
    }

    replace(/❌/g, "");
  }

  replace(/✅/g, "(");

  // implement absolutes
  replace(/(?<=Ｆ)\s*/g, "");
  while (find(/Ｆ\(/) !== -1) {
    i = find(/Ｆ\(/) + 1;
    replace(/Ｆ\(/, "«");
    bracket = -1;

    for (i; i <= input.length; i++) {
      bracketEvalFinal();
      if (bracket === 0) {
        overwrite(i, "»");
        break;
      }
    }
  }

  const reciprocalExponentsRegex = /\^\{\\frac\{1\}\{[A-z\d\s.\t+\-*]*\}\}/g;
  // convert reciprocal exponents to surd
  while (
    config.reciprocalExponents2Surds &&
    findFinal(reciprocalExponentsRegex) !== -1
  ) {
    startingIndex = findFinal(reciprocalExponentsRegex);
    i = startingIndex + 1;
    bracket = 0;

    for (i; i <= input.length; i++) {
      bracketEvalFinal();
      if (bracket === 0) {
        selection = input.slice(startingIndex, i + 1);
        input =
          input.slice(0, startingIndex) + input.slice(i + 1, input.length);
        break;
      }
    }

    i = startingIndex - 2;
    bracket = 1;

    // proceeding with a ")" scenario
    if (input[i] === ")") {
      for (i; i >= 0; i--) {
        bracketEvalFinal();
        if (bracket === 0) {
          overwrite(startingIndex - 1, "}");
          overwrite(i, "{");
          const [match] =
            selection.match(
              /(?<=\^\{\\frac\{1\}\{)[A-z\d\s.\t+\-*]*(?=\}\})/
            ) ?? [];
          if (match) insert(i, "√[" + match + "]");
          break;
        }
      }
    }
    // preceded WITHOUT a ")" scenario
    else {
      insert(startingIndex, "}");

      for (i; i >= 0; i--) {
        bracketEvalFinal();
        if ((isOperator0(i) && bracket === 1) || bracket === 0) {
          insert(i + 1, "{");
          const [match] =
            selection.match(
              /(?<=\^\{\\frac\{1\}\{)[A-z\d\s.\t+\-*]*(?=\}\})/
            ) ?? [];
          if (match) insert(i, "√[" + match + "]");
          break;
        }
      }
    }
  }

  // implement double-argument logarithm
  replace(/(?<=Ⓩ)\s*/g, "");
  while (find(/(?<=Ⓩ)\(/) !== -1) {
    startingIndex = find(/(?<=Ⓩ)\(/);
    i = startingIndex + 1;
    bracket = -1;

    for (i; i <= input.length; i++) {
      bracketEvalFinal();
      if (input[i] === "," && bracket === -1) {
        overwrite(i, "");
        selection = input.slice(startingIndex + 1, i);
        input =
          input.slice(0, startingIndex + 1) + input.slice(i, input.length);
        insert(startingIndex, "_{" + selection + "}");
        break;
      }
      if (bracket === 0) {
        overwrite(startingIndex, "✅");
        break;
      }
    }

    i--;
  }

  replace(/✅/g, "(");

  // FINAL REPLACEMENTS
  // implement proper brackets when all the operator brackets are gone
  for (const [original, replacement] of finalBracketSubs) {
    replace(original, replacement);
  }

  // symbol replacements
  for (const [original, replacement] of finalSymbolSubs) {
    replace(original, replacement);
  }

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ
  for (const [original, replacement] of finalFunctionSubs) {
    replace(original, replacement);
  }

  // ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  for (const [original, replacement] of finalLatinSubs) {
    replace(original, replacement);
  }

  while (find(/Ｍ/) !== -1) {
    startingIndex = find(/Ｍ/);
    i = startingIndex + 3;
    bracket = -1;

    for (i; i <= input.length; i++) {
      bracketEvalFinal();
      if (bracket === 0) {
        selection = input.slice(startingIndex + 3, i);
        input =
          input.slice(0, startingIndex + 1) + input.slice(i + 1, input.length);
        break;
      }
    }

    i--;

    if (selection.search(/[^\d]*/g) !== -1) {
      const selectionNum = parseInt(selection);
      if (selectionNum <= 10 && config.derivativeLoopLimit) {
        replace(/Ｍ/, "");

        for (i = 0; i < selectionNum; i++) {
          insert(startingIndex, "\\frac{d}{dx}");
        }

        break;
      }
    }

    replace(/Ｍ/, "\\frac{d^{" + selection + "}}{dx^{" + selection + "}}");
  }

  // unused: ⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵

  // greek replacements
  for (const [original, replacement] of finalGreekSubs) {
    replace(original, replacement);
  }

  replace(/(^(\s*))|(\s*$)/g, "");

  return input;
}
