import { controller } from "./index";

// IMPORTANT
// isIllegalASCIIMath() is REQUIRED BEFORE executing wolfram2desmos()
// If isIllegalASCIIMath() = false, THEN DON'T RUN wolfram2desmos()
// Ensure that JS DOESN'T override the clipboard
// Besides that, this should work flawlessly! Enjoy!

export function isIllegalASCIIMath(input: string) {
  function count(expr: RegExp) {
    if (input.match(expr) != null) {
      return input.match(expr)?.length ?? 0;
    } else {
      return 0;
    }
  }

  // checks for illegal characters
  if (input.search(/\\/) != -1) {
    return false;
  }
  if (input.search(/\n/) != -1) {
    //console.warn("Newline detected");
    return false;
  }
  if (input.search(/(?<=_|\^|\\\w+|\S]|}){/) != -1) {
    //console.warn("Function curly bracket detected");
    return false;
  }
  if (input.search(/\/\//) != -1) {
    //console.warn("URL detected");
    return false;
  }

  // determines if the brackets are correct
  if (count(/\(/g) > count(/\)/g)) {
    //console.warn("Input has " + (count(/\(/g) - count(/\)/g)) + " more '(' characters than ')' characters");
    return false;
  }
  if (count(/\(/g) < count(/\)/g)) {
    //console.warn("Input has " + (count(/\)/g) - count(/\(/g)) + " more ')' characters than '(' characters");
    return false;
  }
  if (count(/\{/g) > count(/\}/g)) {
    //console.warn("Input has " + (count(/\{/g) - count(/\}/g)) + " more '{' characters than '}' characters");
    return false;
  }
  if (count(/\{/g) < count(/\}/g)) {
    //console.warn("Input has " + (count(/\}/g) - count(/\{/g)) + " more '}' characters than '{' characters");
    return false;
  }
  if (count(/\[/g) != count(/\]/g)) {
    //console.warn("Input has " + (count(/\[/g) - count(/\]/g)) + " more '[' characters than ']' characters");
    return false;
  }
  /*if (count(/\[/g) < count(/\]/g)) {
    //console.warn("Input has " + (count(/\]/g) - count(/\[/g)) + " more ']' characters than '[' characters");
    return false;
  }*/
  if (count(/\|/g) % 2 == 1) {
    //console.warn("Input has uneven '|' brackets");
    return false;
  }
  return true;
}

export function wolfram2desmos(input: string) {
  // FUNCTIONS
  // returns the first match's index
  function find(expr: RegExp) {
    return input.search(expr);
  }

  // returns the last match's index (requires global expr)
  function findFinal(expr: RegExp) {
    let recent = [...input.matchAll(expr)];
    return recent[recent.length - 1]?.index ?? -1;
  }

  // replaces all matches with replacement
  function replace(expr: RegExp, replacement: string) {
    input = input.replace(expr, replacement);
  }

  // inserts replacement at given index
  function insert(index: number, replacement: string) {
    if (index >= 0) {
      input =
        input.slice(0, index) + replacement + input.slice(index, input.length);
    }
  }

  // overwrites current index with replacement
  function overwrite(index: number, replacement: string) {
    input =
      input.slice(0, index) +
      replacement +
      input.slice(index + 1, input.length);
  }

  // iterates the bracket parser
  function bracketEval() {
    if (input[i] == ")") {
      bracket += 1;
    } else if (input[i] == "(") {
      bracket -= 1;
    }
  }

  // iterates the bracket parser with {} in mind
  function bracketEvalFinal() {
    if (input[i] == ")" || input[i] == "}" || input[i] == "???") {
      bracket += 1;
    } else if (input[i] == "(" || input[i] == "{" || input[i] == "???") {
      bracket -= 1;
    }
  }

  // checks if its an operator
  function isOperator0(x: number) {
    return [
      "+",
      "-",
      "??",
      "*",
      "=",
      ">",
      "<",
      "???",
      "???",
      "???",
      "???",
      " ",
      "???",
      "???",
      ":",
    ].includes(input[x]);
  }

  function isOperator1(x: number) {
    return [
      "+",
      "-",
      "??",
      "*",
      "=",
      ">",
      "<",
      "???",
      "???",
      "???",
      "???",
      "/",
      "%",
      "???",
      "???",
      ":",
    ].includes(input[x]);
  }

  function isOperator2(x: number) {
    return ["^", "_"].includes(input[x]);
  }

  // PREPARATIONS
  // predefine some variables.
  let i: number;
  let bracket: number;
  let startingIndex: number;
  let selection!: string;
  let temp;
  let functionSymbols = /^[a-w??-?????-??????-??????-??????%][\(\_\^]/gi;
  input = " " + input + " "; // this gives some breathing space

  // symbol replacements
  replace(/??/g, "??");
  replace(/\*\*/g, "^");
  replace(/(?<![A-Za-z??-??])sqrt/g, "???");
  replace(/(?<![A-Za-z??-??])cbrt/g, "???");
  replace(/(?<![A-Za-z??-??])infinity|infty/g, "???");
  replace(/(?<![A-Za-z??-??])mod(ulus|ulo)/g, "mod");
  replace(/(?<![A-Za-z??-??])mod(?!\s*\()/g, "%");
  replace(/(?<![A-Za-z??-??])pm/g, "??");
  replace(/??|???/g, "*");
  replace(/==/g, "=");
  replace(/\>\=/g, "???");
  replace(/\<\=/g, "???");
  replace(/\!\=/g, "???");
  replace(/\-\>/g, "???");

  // replace piecewise {} brackets with special character
  while (find(/(?<!_|\^|\\\w+|\S]|}){/) != -1) {
    startingIndex = find(/(?<!_|\^|\\\w+|\S]|}){/);
    i = startingIndex;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket == 0) {
        overwrite(startingIndex, "???");
        overwrite(i, "???");
        break;
      }
    }
  }

  // function replacements
  // ??????????????????????????????????????????????????????????????????????????????
  replace(/(?<![A-Za-z??-??])arcsinh/g, "???"); // 	https://qaz.wtf/u/convert.cgi?
  replace(/(?<![A-Za-z??-??])arccosh/g, "???");
  replace(/(?<![A-Za-z??-??])arctanh/g, "???");
  replace(/(?<![A-Za-z??-??])arccsch/g, "???");
  replace(/(?<![A-Za-z??-??])arcsech/g, "???");
  replace(/(?<![A-Za-z??-??])arccoth/g, "???");
  replace(/(?<![A-Za-z??-??])sinh/g, "???");
  replace(/(?<![A-Za-z??-??])cosh/g, "???");
  replace(/(?<![A-Za-z??-??])tanh/g, "???");
  replace(/(?<![A-Za-z??-??])csch/g, "???");
  replace(/(?<![A-Za-z??-??])sech/g, "???");
  replace(/(?<![A-Za-z??-??])coth/g, "???");
  replace(/(?<![A-Za-z??-??])arcsin/g, "???");
  replace(/(?<![A-Za-z??-??])arccos/g, "???");
  replace(/(?<![A-Za-z??-??])arctan/g, "???");
  replace(/(?<![A-Za-z??-??])arccsc/g, "???");
  replace(/(?<![A-Za-z??-??])arcsec/g, "???");
  replace(/(?<![A-Za-z??-??])arccot/g, "???");
  replace(/(?<![A-Za-z??-??])sin/g, "???");
  replace(/(?<![A-Za-z??-??])cos/g, "???");
  replace(/(?<![A-Za-z??-??])tan/g, "???");
  replace(/(?<![A-Za-z??-??])csc/g, "???");
  replace(/(?<![A-Za-z??-??])sec/g, "???");
  replace(/(?<![A-Za-z??-??])cot/g, "???");
  replace(/(?<![A-Za-z??-??])log|ln/g, "???");

  // ??????????????????????????????????????????????????????????????????????????????
  replace(/int(egral|)(?!\S)/g, "???");
  replace(/int(egral|)(?=_)/g, "???");
  replace(/sum(?=_)/g, "???");
  replace(/prod(uct|)(?=_)/g, "???");
  while (find(/(?<![A-Za-z??-??])mod(?![A-Za-z??-??])/) != -1) {
    i = find(/(?<![A-Za-z??-??])mod(?![A-Za-z??-??])/) + 3;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEval();
      if (input[i] == "," && bracket == -1) {
        replace(/(?<![A-Za-z??-??])mod(?![A-Za-z??-??])/, "???");
        break;
      }
      if (bracket == 0) {
        replace(/(?<![A-Za-z??-??])mod(?![A-Za-z??-??])/, "%");
        break;
      }
    }
    continue;
  }
  replace(/(?<![A-Za-z??-??])abs(olute|)/g, "???");
  while (find(/\|/) != -1) {
    i = find(/\|/) + 1;
    overwrite(i - 1, "???(");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket == -1 && input[i] == "|") {
        overwrite(i, ")");
        break;
      }
    }
  }
  replace(/(?<![A-Za-z??-??])binomial(?![A-Za-z??-??])/g, "???");
  replace(/(?<![A-Za-z??-??])floor(?![A-Za-z??-??])/g, "???");
  replace(/(?<![A-Za-z??-??])ceiling(?![A-Za-z??-??])/g, "???");
  replace(/(?<![A-Za-z??-??])round(?![A-Za-z??-??])/g, "???");
  replace(/(?<![A-Za-z??-??])(gcd|gcf)(?![A-Za-z??-??])/g, "???");
  replace(/(?<![A-Za-z??-??])lcm(?![A-Za-z??-??])/g, "???");
  while (find(/d(\^\d*)*\/dx(\^\d*)*/) != -1) {
    i = find(/d(\^\d*)*\/dx(\^\d*)*/);
    selection = input.match(/(?<=\^)(\d*)/)?.[0] ?? "";
    replace(/d(\^\d*)*\/dx(\^\d*)*/, "");
    insert(i, "???");
    insert(i + 1, "^(" + selection + ")");
    break;
  }

  // unused: ??????????????????????????????????????????????????????????????????????????????

  // dead space removal
  replace(/(?<=[\/\^\_\??????%])\s*/g, "");
  replace(/\s*(?=[\/\^\_%])/g, "");

  // trail removal
  replace(/\sfor(?!.*\sfor).*/g, "");
  replace(/\(Taylor series\)/g, "");

  // latin replacements
  replace(/(?<![A-Za-z??-??])alpha/g, "??");
  replace(/(?<![A-Za-z??-??])beta/g, "??");
  replace(/(?<![A-Za-z??-??])Gamma/g, "??");
  replace(/(?<![A-Za-z??-??])gamma/g, "??");
  replace(/(?<![A-Za-z??-??])Delta/g, "??");
  replace(/(?<![A-Za-z??-??])delta/g, "??");
  replace(/(?<![A-Za-z??-??])epsilon/g, "??");
  replace(/(?<![A-Za-z??-??])zeta/g, "??");
  replace(/(?<![A-Za-z??-??])eta/g, "??");
  replace(/(?<![A-Za-z??-??])Theta/g, "??");
  replace(/(?<![A-Za-z??-??])theta/g, "??");
  replace(/(?<![A-Za-z??-??])iota/g, "??");
  replace(/(?<![A-Za-z??-??])kappa/g, "??");
  replace(/(?<![A-Za-z??-??])Lambda/g, "??");
  replace(/(?<![A-Za-z??-??])lambda/g, "??");
  replace(/(?<![A-Za-z??-??])mu/g, "??");
  replace(/(?<![A-Za-z??-??])nu/g, "??");
  replace(/(?<![A-Za-z??-??])Xi/g, "??");
  replace(/(?<![A-Za-z??-??])xi/g, "??");
  replace(/(?<![A-Za-z??-??])Pi/g, "??");
  replace(/(?<![A-Za-z??-??])pi/g, "??");
  replace(/(?<![A-Za-z??-??])rho/g, "??");
  replace(/(?<![A-Za-z??-??])Sigma/g, "??");
  replace(/(?<![A-Za-z??-??])sigma/g, "??");
  replace(/(?<![A-Za-z??-??])tau/g, "??");
  replace(/(?<![A-Za-z??-??])Upsilon/g, "??");
  replace(/(?<![A-Za-z??-??])upsilon/g, "??");
  replace(/(?<![A-Za-z??-??])Phi/g, "??");
  replace(/(?<![A-Za-z??-??])phi/g, "??");
  replace(/(?<![A-Za-z??-??])chi/g, "??");
  replace(/(?<![A-Za-z??-??])Psi/g, "??");
  replace(/(?<![A-Za-z??-??])psi/g, "??");
  replace(/(?<![A-Za-z??-??])Omega/g, "??");
  replace(/(?<![A-Za-z??-??])omega/g, "??");
  replace(/(?<![A-Za-z??-??])constant/g, "C");

  // MISSING BRACKETS
  // this will ensure brackets AFTER each operator
  while (findFinal(/[\/\^\_\??????%](?!\()/g) != -1) {
    i = findFinal(/[\/\^\_\??????%](?!\()/g) + 1;
    insert(i, "(");
    temp = input.slice(i - 2, i);
    temp = temp.search(functionSymbols) != -1;
    bracket = -1;
    selection = input.slice(i + 1, input.length);
    if (selection[0] == "+" || selection[0] == "-" || selection[0] == "??") {
      i += 1;
    }
    if (selection.search(functionSymbols) == 0 && selection[1] == "(") {
      i += 1;
    } else if (selection.search(/([0-9]*[.])?[0-9]+/) == 0) {
      i += selection.match(/([0-9]*[.])?[0-9]+/)?.[0]?.length ?? 0;
      if (input[i + 1] == "(") {
        insert(i + 1, ")");
        continue;
      }
    }
    while (true) {
      i++;
      bracketEval();
      if (bracket == 0) {
        insert(i, ")");
        break;
      }
      if (temp) {
        if ((isOperator1(i) || isOperator2(i)) && bracket == -1) {
          insert(i, ")");
          break;
        }
        if (input[i] == "(" && bracket == -2) {
          insert(i, ")");
          break;
        }
      }
      if (bracket == -1) {
        if (isOperator1(i)) {
          insert(i, ")");
          break;
        }
        if (isOperator2(i)) {
          i++;
          bracket -= 1;
          continue;
        }
        if (input[i] == " " || input[i] == "," || input[i] == ":") {
          // eg: "a/(a 2" ??? "a/(a) (2)"
          insert(i, ")");
          break;
        }
        if (i == input.length) {
          insert(i, ")");
          break;
        }
      }
    }
  }

  // this will ensure brackets BEFORE each DIVISION | MODULO
  while (find(/\/|%/) != -1) {
    startingIndex = find(/\/|%/);
    i = startingIndex - 1;
    temp = false;
    if (input[startingIndex] == "/") {
      replace(/\//, "???");
    } else {
      replace(/%/, "???");
    }

    // preceded by a ")" scenario
    if (input[i] == ")") {
      bracket = 1;
      while (i > 1) {
        i -= 1;
        bracketEval();
        if (bracket == 0) {
          temp = input[i - 1] + "(";
          if (
            temp.search(functionSymbols) == 0 ||
            temp == "^(" ||
            temp == "_	("
          ) {
            temp = true;
            break;
          }
        }
      }
    }

    // preceded WITHOUT a ")" scenario
    if (input[i] != ")" || temp) {
      insert(startingIndex, ")");
      i = startingIndex;
      bracket = 1;
      while (i > 0) {
        i -= 1;
        bracketEval();
        if ((isOperator0(i) && bracket == 1) || bracket == 0) {
          insert(i + 1, "(");
          break;
        }
      }
    }
  }
  replace(/???/g, "/");
  replace(/???/g, "%");
  // OFFICIAL BRACKET CHECKPOINT REACHED

  // BEGIN LATEX FORMATTING
  // implement function exponents
  while (find(/(?<=[???-???]\^)\(/) != -1) {
    startingIndex = find(/(?<=[???-???]\^)\(/);
    i = startingIndex;
    overwrite(i, "???");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket == 0) {
        overwrite(i, "???");
        break;
      }
    }
    selection = input.slice(startingIndex, i + 1);
    if (
      selection == "???2???" ||
      (selection == "???-1???" && input[startingIndex - 2] != "???")
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
        if (bracket == -1) {
          insert(i + 1, ")");
          insert(i + 2, "^" + selection);
          break;
        }
      }
    }
  }
  replace(/???/g, "(");
  replace(/???/g, ")");

  // implement fractions
  while (find(/\//) != -1) {
    startingIndex = find(/\//);
    i = startingIndex + 1;
    bracket = -1;
    overwrite(i, "{");
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket == 0) {
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
      if (bracket == 0) {
        overwrite(i, "\\frac{");
        break;
      }
    }
  }

  // implement modulo (BASED ON FRACTION IMPLEMENTATION)
  while (find(/%/) != -1) {
    startingIndex = find(/%/);
    i = startingIndex + 1;
    bracket = -1;
    overwrite(i, ",");
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket == 0) {
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
      if (bracket == 0) {
        overwrite(i, "???(");
        break;
      }
    }
  }

  // implement subscripts and superscripts
  while (find(/[_\^??????]\(/) != -1) {
    i = find(/[_\^??????]\(/) + 1;
    overwrite(i, "{");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket == 0) {
        overwrite(i, "}");
        break;
      }
    }
  }

  // remove excess brackets
  while (find(/\\frac{\(/) != -1) {
    startingIndex = find(/\\frac\{\(/) + 6;
    i = startingIndex; // "("
    bracket = -1;
    temp = false;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (temp) {
        if (input[i] == " ") {
          continue;
        }
        if (input[i] == "}") {
          overwrite(startingIndex, "???");
          overwrite(i - 1, "???");
          break;
        } else {
          overwrite(startingIndex, "???");
          break;
        }
      }
      if (!temp && bracket == 0) {
        temp = true;
      }
    }
    replace(/???/g, "");
  }
  replace(/???/g, "(");

  // implement absolutes
  replace(/(?<=???)\s*/g, "");
  while (find(/???\(/) != -1) {
    i = find(/???\(/);
    replace(/???\(/, "??");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket == 0) {
        overwrite(i, "??");
        break;
      }
    }
  }

  // convert reciprocal exponents to surd
  while (
    controller.configFlags.reciprocalExponents2Surds &&
    findFinal(/\^\{\\frac\{1\}\{[A-z\d\s\.\	+\-\*]*\}\}/g) != -1
  ) {
    startingIndex = findFinal(/\^\{\\frac\{1\}\{[A-z\d\s\.\+\-\*]*\}\}/g);
    i = startingIndex;
    bracket = 0;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket == 0) {
        selection = input.slice(startingIndex, i + 1);
        input =
          input.slice(0, startingIndex) + input.slice(i + 1, input.length);
        break;
      }
    }

    i = startingIndex - 1;
    // proceeding with a ")" scenario
    if (input[i] == ")") {
      bracket = 1;
      while (i > 0) {
        i -= 1;
        bracketEvalFinal();
        if (bracket == 0) {
          overwrite(startingIndex - 1, "}");
          overwrite(i, "{");
          insert(
            i,
            "???[" +
              selection.match(
                /(?<=\^\{\\frac\{1\}\{)[A-z\d\s\.\	+\-\*]*(?=\}\})/
              )?.[0] +
              "]"
          );
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
        if ((isOperator0(i) && bracket == 1) || bracket == 0) {
          insert(i + 1, "{");
          insert(
            i,
            "???[" +
              selection?.match(
                /(?<=\^\{\\frac\{1\}\{)[A-z\d\s\.\	+\-\*]*(?=\}\})/
              )?.[0] +
              "]"
          );
          break;
        }
      }
    }
  }

  // implement double-argument logarithm
  replace(/(?<=???)\s*/g, "");
  while (find(/(?<=???)\(/) != -1) {
    startingIndex = find(/(?<=???)\(/);
    i = startingIndex;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (input[i] == "," && bracket == -1) {
        overwrite(i, "");
        selection = input.slice(startingIndex + 1, i);
        input =
          input.slice(0, startingIndex + 1) + input.slice(i, input.length);
        insert(startingIndex, "_{" + selection + "}");
        break;
      }
      if (bracket == 0) {
        overwrite(startingIndex, "???");
        break;
      }
    }
  }
  replace(/???/g, "(");

  // FINAL REPLACEMENTS
  // implement proper brackets when all the operator brackets are gone
  replace(/\(/g, "\\left(");
  replace(/\)/g, "\\right)");
  replace(/\??/g, "\\left|");
  replace(/\??/g, "\\right|");
  replace(/???/g, "\\left\\{");
  replace(/???/g, "\\right\\}");
  replace(/\[/g, "\\left[");
  replace(/\]/g, "\\right]");

  // symbol replacements
  replace(/???/g, "\\sqrt");
  replace(/???/g, "\\sqrt[3]");
  replace(/\*/g, "\\cdot ");
  replace(/(?<=\d) (?=\d)/g, " \\cdot ");

  // function replacements
  // ??????????????????????????????????????????????????????????????????????????????
  replace(/???/g, "arcsinh");
  replace(/???/g, "arccosh");
  replace(/???/g, "arctanh");
  replace(/???/g, "arccsch");
  replace(/???/g, "arcsech");
  replace(/???/g, "arccoth");
  replace(/???/g, "sinh");
  replace(/???/g, "cosh");
  replace(/???/g, "tanh");
  replace(/???/g, "csch");
  replace(/???/g, "sech");
  replace(/???/g, "coth");
  replace(/???/g, "arcsin");
  replace(/???/g, "arccos");
  replace(/???/g, "arctan");
  replace(/???/g, "arccsc");
  replace(/???/g, "arcsec");
  replace(/???/g, "arccot");
  replace(/???/g, "sin");
  replace(/???/g, "cos");
  replace(/???/g, "tan");
  replace(/???/g, "csc");
  replace(/???/g, "sec");
  replace(/???/g, "cot");
  replace(/???(?!_)/g, "ln");
  replace(/???/g, "log");

  // ??????????????????????????????????????????????????????????????????????????????
  replace(/???/g, "\\int_{0}^{t}");
  replace(/???/g, "\\int");
  replace(/???/g, "\\sum");
  replace(/???/g, "\\prod");
  replace(/???/g, "\\operatorname{mod}");
  replace(/???/g, "\\operatorname{nCr}");
  replace(/???/g, "\\operatorname{floor}");
  replace(/???/g, "\\operatorname{ceil}");
  replace(/???/g, "\\operatorname{round}");
  replace(/???/g, "\\operatorname{gcf}");
  replace(/???/g, "\\operatorname{lcm}");
  replace(/???(?!\^\{)/g, "\\frac{d}{dx}");
  while (find(/???/) != -1) {
    startingIndex = find(/???/);
    i = startingIndex + 2;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket == 0) {
        selection = input.slice(startingIndex + 3, i);
        input =
          input.slice(0, startingIndex + 1) + input.slice(i + 1, input.length);
        break;
      }
    }
    if (selection.search(/[^\d]*/g) != -1) {
      const selectionNum = parseInt(selection);
      if (selectionNum <= 10 && controller.configFlags.derivativeLoopLimit) {
        replace(/???/, "");
        for (i = 0; i < selectionNum; i++) {
          insert(startingIndex, "\\frac{d}{dx}");
        }
        break;
      }
    }
    replace(/???/, "\\frac{d^{" + selection + "}}{dx^{" + selection + "}}");
  }

  // unused: ??????????????????????????????????????????????????????????????????????????????

  // latin replacements
  replace(/??/g, "\\alpha");
  replace(/??/g, "\\beta");
  replace(/??/g, "\\Gamma");
  replace(/??/g, "\\gamma");
  replace(/??/g, "\\Delta");
  replace(/??/g, "\\delta");
  replace(/??/g, "\\epsilon");
  replace(/??/g, "\\zeta");
  replace(/??/g, "\\eta");
  replace(/??/g, "\\Theta");
  replace(/??/g, "\\theta");
  replace(/??/g, "\\iota");
  replace(/??/g, "\\kappa");
  replace(/??/g, "\\Lambda");
  replace(/??/g, "\\lambda");
  replace(/??/g, "\\mu");
  replace(/??/g, "\\nu");
  replace(/??/g, "\\Xi");
  replace(/??/g, "\\xi");
  replace(/??/g, "\\Pi");
  replace(/??/g, "\\pi");
  replace(/??/g, "\\rho");
  replace(/??/g, "\\Sigma");
  replace(/??/g, "\\sigma");
  replace(/??/g, "\\tau");
  replace(/??/g, "\\Upsilon");
  replace(/??/g, "\\upsilon");
  replace(/??/g, "\\Phi");
  replace(/??/g, "\\phi");
  replace(/??/g, "\\chi");
  replace(/??/g, "\\Psi");
  replace(/??/g, "\\psi");
  replace(/??/g, "\\Omega");
  replace(/??/g, "\\omega");
  replace(/polygamma/g, "\\psi_{poly}");

  replace(/(^(\s*))|(\s*$)/g, "");
  return input;
}
