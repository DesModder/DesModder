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
// isLegalASCIIMath() is REQUIRED BEFORE executing wolfram2desmos()
// If isLegalASCIIMath() = false, THEN DON'T RUN wolfram2desmos()
// Ensure that JS DOESN'T override the clipboard
// Besides that, this should work flawlessly! Enjoy!

export function isLegalASCIIMath(input: string) {
  const count = (expr: RegExp) => input.match(expr)?.length ?? 0;

  return (
    // checks for illegal characters
    !input.includes("\\") &&
    !input.includes("\n") &&
    !/(?<=_|\^|\\\w+|\S]|}){/.test(input) &&
    !input.includes("//") &&
    // determines if the brackets are correct
    count(/\(/g) === count(/\)/g) &&
    count(/\{/g) === count(/\}/g) &&
    count(/\[/g) === count(/\]/g) &&
    count(/\|/g) % 2 === 0
  );
}

export function wolfram2desmos(input: string, config: Config): string {
  // FUNCTIONS
  // returns the first match's index
  const find = (expr: RegExp) => input.search(expr);

  // returns the last match's index (requires global expr)
  function findFinal(expr: RegExp): number {
    const recent = [...input.matchAll(expr)];
    return recent[recent.length - 1]?.index ?? -1;
  }

  // replaces all matches with replacement
  function replace(expr: RegExp, replacement: string): void {
    input = input.replace(expr, replacement);
  }

  function replaceAll(replacements: [RegExp, string][]): void {
    for (const [original, replacement] of replacements) {
      input = input.replace(original, replacement);
    }
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
  function bracketEval(i: number): 1 | 0 | -1 {
    if (input[i] === ")") {
      return 1;
    } else if (input[i] === "(") {
      return -1;
    } else {
      return 0;
    }
  }

  // iterates the bracket parser with {} in mind
  function finalBracketEval(i: number): 1 | 0 | -1 {
    if (/[)}\u{3015}]/u.test(input[i])) {
      return 1;
    } else if (/[({\u{3014}]/u.test(input[i])) {
      return -1;
    } else {
      return 0;
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

  const functionSymbols = /^[a-wΑ-ωⒶ-ⓏＡ-Ｚ⒜-⒵√%][(_^]/gi;
  input = ` ${input} `; // this gives some breathing space

  replaceAll(symbolSubs);

  const piecewiseBracketRegex = /(?<!_|\^|\\\w+|\S]|}){/;
  // replace piecewise {} brackets with special character
  while (find(piecewiseBracketRegex) !== -1) {
    let bracket = -1;
    const startingIndex = find(piecewiseBracketRegex);

    for (let i = startingIndex + 1; i <= input.length; i++) {
      bracket += finalBracketEval(i);
      if (bracket === 0) {
        overwrite(startingIndex, "〔");
        overwrite(i, "〕");
        break;
      }
    }
  }

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏＡＢＣＤ
  replaceAll(functionSubs);

  const modRegex = /(?<![A-Za-zΑ-ω])mod(?![A-Za-zΑ-ω])/;

  // ＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  while (find(modRegex) !== -1) {
    let i = find(modRegex) + 4;
    let bracket = -1;

    for (i; i <= input.length; i++) {
      bracket += bracketEval(i);
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

  replace(/(?<![A-Za-zΑ-ω])abs(olute)?/g, "Ｆ");
  while (find(/\|/) !== -1) {
    let i = find(/\|/);
    let bracket = -1;

    overwrite(i, "Ｆ(");
    i += 2;

    for (i; i <= input.length; i++) {
      bracket += finalBracketEval(i);
      if (bracket === -1 && input[i] === "|") {
        overwrite(i, ")");
        break;
      }
    }
  }

  // latin replacements
  replaceAll(latinSubs);

  if (find(/d(\^\d*)*\/dx(\^\d*)*/) !== -1) {
    const i = find(/d(\^\d*)*\/dx(\^\d*)*/);
    const [selection] = /(?<=\^)(\d*)/.exec(input) ?? [""];
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
  replaceAll(greekSubs);

  const missingBracketsRegex = /[/^_√∛%](?!\()/g;

  // MISSING BRACKETS
  // this will ensure brackets AFTER each operator
  while (findFinal(missingBracketsRegex) !== -1) {
    let i = findFinal(missingBracketsRegex) + 1;
    const insideFunction = functionSymbols.test(input.slice(i - 2, i));
    let bracket = -1;
    const selection = input.slice(i + 1, input.length);

    insert(i, "(");

    if (/^[-+±]/.test(selection)) {
      i++;
    }

    if (selection.search(functionSymbols) === 0 && selection[1] === "(") {
      i++;
    } else if (selection.search(/([0-9]*[.])?[0-9]+/) === 0) {
      i += /([0-9]*[.])?[0-9]+/.exec(selection)?.[0]?.length ?? 0;
      if (input[i + 1] === "(") {
        insert(i + 1, ")");
        continue;
      }
    }

    while (true) {
      i++;
      bracket += bracketEval(i);

      // These if statements can be refactored
      if (bracket === 0) {
        insert(i, ")");
        break;
      }

      if (insideFunction) {
        const shouldInsertBracket =
          ((isOperator1(i) || isOperator2(i)) && bracket === -1) ||
          (input[i] === "(" && bracket === -2);

        if (shouldInsertBracket) {
          insert(i, ")");
          break;
        }
      }

      if (bracket === -1) {
        const shouldInsertBracket =
          isOperator1(i) || /[ ,:]/.test(input[i]) || i === input.length;

        if (shouldInsertBracket) {
          insert(i, ")");
          break;
        }

        if (isOperator2(i)) {
          i++;
          bracket--;
          continue;
        }
      }
    }
  }

  // this will ensure brackets BEFORE each DIVISION | MODULO
  while (find(/\/|%/) !== -1) {
    const startingIndex = find(/\/|%/);
    let i = startingIndex - 1;
    let temp: string;
    let found = false;

    if (input[startingIndex] === "/") {
      replace(/\//, "╱");
    } else {
      replace(/%/, "⁒");
    }

    // preceded by a ")" scenario
    if (input[i] === ")") {
      let bracket = 1;
      i -= 2;

      for (i; i >= 0; i--) {
        bracket += bracketEval(i);
        if (bracket === 0) {
          temp = input[i] + "(";
          if (
            temp.search(functionSymbols) === 0 ||
            temp === "^(" ||
            temp === "_	("
          ) {
            found = true;
            break;
          }
        }
      }

      i += 2;
    }

    // preceded WITHOUT a ")" scenario
    if (input[i] !== ")" || found) {
      let bracket = 1;

      insert(startingIndex, ")");
      i = startingIndex - 1;

      for (i; i >= 0; i--) {
        bracket += bracketEval(i);
        if ((isOperator0(i) && bracket === 1) || bracket === 0) {
          insert(i + 1, "(");
          break;
        }
      }
    }
  }

  replace(/╱/g, "/");
  replace(/⁒/g, "%");
  // OFFICIAL BRACKET CHECKPOINT REACHED

  // BEGIN LATEX FORMATTING
  // implement function exponents
  while (find(/(?<=[Ⓐ-Ⓩ]\^)\(/) !== -1) {
    let bracket = -1;
    const startingIndex = find(/(?<=[Ⓐ-Ⓩ]\^)\(/);
    let i = startingIndex;

    overwrite(i, "‹");
    i++;

    for (i; i <= input.length; i++) {
      bracket += bracketEval(i);

      if (bracket === 0) {
        overwrite(i, "›");
        break;
      }
    }

    const selection = input.slice(startingIndex, i + 1);

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
        bracket += bracketEval(i);
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
    let bracket = -1;
    const startingIndex = find(/\//);
    let i = startingIndex + 1;

    overwrite(i, "{");
    i++;

    for (i; i <= input.length; i++) {
      bracket += bracketEval(i);
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
      bracket += bracketEval(i);
      if (bracket === 0) {
        overwrite(i, "\\frac{");
        break;
      }
    }
  }

  // implement modulo (BASED ON FRACTION IMPLEMENTATION)
  while (find(/%/) !== -1) {
    let bracket = -1;
    const startingIndex = find(/%/);
    let i = startingIndex + 1;

    overwrite(i, ",");
    i++;

    for (i; i <= input.length; i++) {
      bracket += bracketEval(i);
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
      bracket += bracketEval(i);
      if (bracket === 0) {
        overwrite(i, "Ｅ(");
        break;
      }
    }
  }

  // implement subscripts and superscripts
  while (find(/[_^√∛]\(/) !== -1) {
    let bracket = -1;
    let i = find(/[_^√∛]\(/) + 1;

    overwrite(i, "{");
    i++;

    for (i; i <= input.length; i++) {
      bracket += bracketEval(i);
      if (bracket === 0) {
        overwrite(i, "}");
        break;
      }
    }
  }

  // remove excess brackets
  while (find(/\\frac{\(/) !== -1) {
    let bracket = -1;
    const startingIndex = find(/\\frac\{\(/) + 6;
    let i = startingIndex + 1; // "("
    let temp = false;

    for (i; i <= input.length; i++) {
      bracket += finalBracketEval(i);
      if (temp) {
        if (input[i] === "}") {
          overwrite(startingIndex, "❌");
          overwrite(i - 1, "❌");
        } else {
          overwrite(startingIndex, "✅");
        }

        break;
      } else if (bracket === 0) {
        temp = true;
      }
    }

    replace(/❌/g, "");
  }

  replace(/✅/g, "(");

  // implement absolutes
  replace(/(?<=Ｆ)\s*/g, "");
  while (find(/Ｆ\(/) !== -1) {
    let i = find(/Ｆ\(/) + 1;
    let bracket = -1;

    replace(/Ｆ\(/, "«");

    for (i; i <= input.length; i++) {
      bracket += finalBracketEval(i);
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
    let bracket = 0;
    const startingIndex = findFinal(reciprocalExponentsRegex);
    let i = startingIndex + 1;
    let selection!: string;

    for (i; i <= input.length; i++) {
      bracket += finalBracketEval(i);
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
        bracket += finalBracketEval(i);
        if (bracket === 0) {
          overwrite(startingIndex - 1, "}");
          overwrite(i, "{");
          const [match] =
            /(?<=\^\{\\frac\{1\}\{)[A-z\d\s.\t+\-*]*(?=\}\})/.exec(selection) ??
            [];
          if (match) insert(i, "√[" + match + "]");
          break;
        }
      }
    }
    // preceded WITHOUT a ")" scenario
    else {
      insert(startingIndex, "}");

      for (i; i >= 0; i--) {
        bracket += finalBracketEval(i);
        if ((isOperator0(i) && bracket === 1) || bracket === 0) {
          insert(i + 1, "{");
          const [match] =
            /(?<=\^\{\\frac\{1\}\{)[A-z\d\s.\t+\-*]*(?=\}\})/.exec(selection) ??
            [];
          if (match) insert(i, "√[" + match + "]");
          break;
        }
      }
    }
  }

  // implement double-argument logarithm
  replace(/(?<=Ⓩ)\s*/g, "");
  while (find(/(?<=Ⓩ)\(/) !== -1) {
    let bracket = -1;
    const startingIndex = find(/(?<=Ⓩ)\(/);
    let i = startingIndex + 1;

    for (i; i <= input.length; i++) {
      bracket += finalBracketEval(i);
      if (input[i] === "," && bracket === -1) {
        overwrite(i, "");
        input =
          input.slice(0, startingIndex + 1) + input.slice(i, input.length);

        const selection = input.slice(startingIndex + 1, i);
        insert(startingIndex, "_{" + selection + "}");
        break;
      }

      if (bracket === 0) {
        overwrite(startingIndex, "✅");
        break;
      }
    }
  }

  replace(/✅/g, "(");

  // FINAL REPLACEMENTS
  // implement proper brackets when all the operator brackets are gone
  replaceAll(finalBracketSubs);

  // symbol replacements
  replaceAll(finalSymbolSubs);

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ
  replaceAll(finalFunctionSubs);

  // ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  replaceAll(finalLatinSubs);

  while (find(/Ｍ/) !== -1) {
    let bracket = -1;
    const startingIndex = find(/Ｍ/);
    let i = startingIndex + 3;
    let selection!: string;

    for (i; i <= input.length; i++) {
      bracket += finalBracketEval(i);
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
  replaceAll(finalGreekSubs);

  replace(/(^(\s*))|(\s*$)/g, "");

  return input;
}
