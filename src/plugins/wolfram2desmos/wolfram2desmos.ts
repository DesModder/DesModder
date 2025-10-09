import { Config } from "./config";
import {
  symbolReplacements,
  functionReplacements,
  greekReplacements,
  functionFinalReplacements,
  bracketFinalReplacements,
  greekFinalReplacements,
  latinReplacements,
  finalSymbolReplacements,
} from "./replacements.ts";

// IMPORTANT
// isIllegalASCIIMath() is REQUIRED BEFORE executing wolfram2desmos()
// If isIllegalASCIIMath() = false, THEN DON'T RUN wolfram2desmos()
// Ensure that JS DOESN'T override the clipboard
// Besides that, this should work flawlessly! Enjoy!

export function isIllegalASCIIMath(input: string) {
  function count(expr: RegExp) {
    if (input.match(expr) != null) {
      return input.match(expr)?.length ?? 0;
    }
    return 0;
  }

  if (
    // checks for illegal characters
    input.search(/\\/) !== -1 ||
    input.search(/\n/) !== -1 ||
    input.search(/(?<=_|\^|\\\w+|\S]|}){/) !== -1 ||
    input.search(/\/\//) !== -1 ||
    // determines if the brackets are correct
    count(/\(/g) !== count(/\)/g) ||
    count(/\{/g) !== count(/\}/g) ||
    count(/\[/g) !== count(/\]/g) ||
    count(/\|/g) % 2 === 1
  ) {
    return false;
  }
  return true;
}

export function wolfram2desmos(input: string, config: Config): string {
  // FUNCTIONS
  // returns the first match's index
  function find(expr: RegExp): number {
    return input.search(expr);
  }

  // returns the last match's index (requires global expr)
  function findFinal(expr: RegExp): number {
    const recent = [...input.matchAll(expr)];
    return recent[recent.length - 1]?.index ?? -1;
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
      bracket += 1;
    } else if (input[i] === "(") {
      bracket -= 1;
    }
  }

  // iterates the bracket parser with {} in mind
  function bracketEvalFinal(): void {
    if (input[i] === ")" || input[i] === "}" || input[i] === "〕") {
      bracket += 1;
    } else if (input[i] === "(" || input[i] === "{" || input[i] === "〔") {
      bracket -= 1;
    }
  }

  // checks if its an operator
  function isOperator0(x: number): boolean {
    return [
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
  }

  function isOperator1(x: number): boolean {
    return [
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
  }

  function isOperator2(x: number): boolean {
    return ["^", "_"].includes(input[x]);
  }

  // PREPARATIONS
  // predefine some variables.
  let i: number;
  let bracket: number;
  let startingIndex: number;
  let selection!: string;
  let temp;
  const functionSymbols = /^[a-wΑ-ωⒶ-ⓏＡ-Ｚ⒜-⒵√%][(_^]/gi;
  input = " " + input + " "; // this gives some breathing space

  symbolReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });

  // replace piecewise {} brackets with special character
  while (find(/(?<!_|\^|\\\w+|\S]|}){/) !== -1) {
    startingIndex = find(/(?<!_|\^|\\\w+|\S]|}){/);
    i = startingIndex;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket === 0) {
        overwrite(startingIndex, "〔");
        overwrite(i, "〕");
        break;
      }
    }
  }

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ
  functionReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });

  // ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  while (find(/(?<![A-Za-zΑ-ω])mod(?![A-Za-zΑ-ω])/) !== -1) {
    i = find(/(?<![A-Za-zΑ-ω])mod(?![A-Za-zΑ-ω])/) + 3;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEval();
      if (input[i] === "," && bracket === -1) {
        replace(/(?<![A-Za-zΑ-ω])mod(?![A-Za-zΑ-ω])/, "Ｅ");
        break;
      }
      if (bracket === 0) {
        replace(/(?<![A-Za-zΑ-ω])mod(?![A-Za-zΑ-ω])/, "%");
        break;
      }
    }
    continue;
  }
  replace(/(?<![A-Za-zΑ-ω])abs(olute|)/g, "Ｆ");
  while (find(/\|/) !== -1) {
    i = find(/\|/) + 1;
    overwrite(i - 1, "Ｆ(");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket === -1 && input[i] === "|") {
        overwrite(i, ")");
        break;
      }
    }
  }
  latinReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });
  if (find(/d(\^\d*)*\/dx(\^\d*)*/) !== -1) {
    i = find(/d(\^\d*)*\/dx(\^\d*)*/);
    [selection] = /(?<=\^)(\d*)/.exec(input) ?? [""];
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
  greekReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });

  // MISSING BRACKETS
  // this will ensure brackets AFTER each operator
  while (findFinal(/[/^_√∛%](?!\()/g) !== -1) {
    i = findFinal(/[/^_√∛%](?!\()/g) + 1;
    insert(i, "(");
    temp = input.slice(i - 2, i);
    temp = temp.search(functionSymbols) !== -1;
    bracket = -1;
    selection = input.slice(i + 1, input.length);
    if (/^[-+±]/.test(selection)) {
      i += 1;
    }
    if (selection.search(functionSymbols) === 0 && selection[1] === "(") {
      i += 1;
    } else if (selection.search(/([0-9]*[.])?[0-9]+/) === 0) {
      i += /([0-9]*[.])?[0-9]+/.exec(selection)?.[0]?.length ?? 0;
      if (input[i + 1] === "(") {
        insert(i + 1, ")");
        continue;
      }
    }
    while (true) {
      i++;
      bracketEval();
      if (bracket === 0) {
        insert(i, ")");
        break;
      }
      if (temp) {
        if ((isOperator1(i) || isOperator2(i)) && bracket === -1) {
          insert(i, ")");
          break;
        }
        if (input[i] === "(" && bracket === -2) {
          insert(i, ")");
          break;
        }
      }
      if (bracket === -1) {
        if (isOperator1(i)) {
          insert(i, ")");
          break;
        }
        if (isOperator2(i)) {
          i++;
          bracket -= 1;
          continue;
        }
        if (input[i] === " " || input[i] === "," || input[i] === ":") {
          // eg: "a/(a 2" → "a/(a) (2)"
          insert(i, ")");
          break;
        }
        if (i === input.length) {
          insert(i, ")");
          break;
        }
      }
    }
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
      while (i > 1) {
        i -= 1;
        bracketEval();
        if (bracket === 0) {
          temp = input[i - 1] + "(";
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
    }

    // preceded WITHOUT a ")" scenario
    if (input[i] !== ")" || temp) {
      insert(startingIndex, ")");
      i = startingIndex;
      bracket = 1;
      while (i > 0) {
        i -= 1;
        bracketEval();
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
    startingIndex = find(/(?<=[Ⓐ-Ⓩ]\^)\(/);
    i = startingIndex;
    overwrite(i, "‹");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket === 0) {
        overwrite(i, "›");
        break;
      }
    }
    selection = input.slice(startingIndex, i + 1);
    if (
      selection === "‹2›" ||
      (selection === "‹-1›" && input[startingIndex - 2] !== "Ⓩ")
    ) {
      continue;
    } else {
      input =
        input.slice(0, startingIndex - 1) + input.slice(i + 1, input.length);
      i = startingIndex;
      insert(i - 2, "(");
      bracket = -2;
      while (i < input.length) {
        i++;
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
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket === 0) {
        overwrite(i, "}");
        break;
      }
    }
    i = startingIndex;
    bracket = 1;
    overwrite(i, "");
    i -= 1;
    overwrite(i, "}");
    while (i > 0) {
      i -= 1;
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
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket === 0) {
        overwrite(i, ")");
        break;
      }
    }
    i = startingIndex;
    bracket = 1;
    overwrite(i, "");
    i -= 1;
    overwrite(i, "");
    while (i > 0) {
      i -= 1;
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
    while (i < input.length) {
      i++;
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
    i = startingIndex; // "("
    bracket = -1;
    temp = false;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (temp) {
        if (input[i] === " ") {
          continue;
        }
        if (input[i] === "}") {
          overwrite(startingIndex, "❌");
          overwrite(i - 1, "❌");
          break;
        } else {
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
    i = find(/Ｆ\(/);
    replace(/Ｆ\(/, "«");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket === 0) {
        overwrite(i, "»");
        break;
      }
    }
  }

  // convert reciprocal exponents to surd
  while (
    config.reciprocalExponents2Surds &&
    findFinal(/\^\{\\frac\{1\}\{[A-z\d\s.\t+\-*]*\}\}/g) !== -1
  ) {
    startingIndex = findFinal(/\^\{\\frac\{1\}\{[A-z\d\s.+\-*]*\}\}/g);
    i = startingIndex;
    bracket = 0;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket === 0) {
        selection = input.slice(startingIndex, i + 1);
        input =
          input.slice(0, startingIndex) + input.slice(i + 1, input.length);
        break;
      }
    }

    i = startingIndex - 1;
    // proceeding with a ")" scenario
    if (input[i] === ")") {
      bracket = 1;
      while (i > 0) {
        i -= 1;
        bracketEvalFinal();
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
      bracket = 1;
      while (i > 0) {
        i -= 1;
        bracketEvalFinal();
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
    startingIndex = find(/(?<=Ⓩ)\(/);
    i = startingIndex;
    bracket = -1;
    while (i < input.length) {
      i++;
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
  }
  replace(/✅/g, "(");

  // FINAL REPLACEMENTS
  // implement proper brackets when all the operator brackets are gone
  bracketFinalReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });

  // symbol replacements
  finalSymbolReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ
  functionFinalReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });

  // ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  finalSymbolReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });
  while (find(/Ｍ/) !== -1) {
    startingIndex = find(/Ｍ/);
    i = startingIndex + 2;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket === 0) {
        selection = input.slice(startingIndex + 3, i);
        input =
          input.slice(0, startingIndex + 1) + input.slice(i + 1, input.length);
        break;
      }
    }
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
  greekFinalReplacements.forEach((x) => {
    replace(x[0], x[1]);
  });

  replace(/(^(\s*))|(\s*$)/g, "");
  return input;
}
