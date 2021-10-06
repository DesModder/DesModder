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
		if (input[i] == ")" || input[i] == "}" || input[i] == "〕") {
			bracket += 1;
		} else if (input[i] == "(" || input[i] == "{" || input[i] == "〔") {
			bracket -= 1;
		}
  }

  // checks if its an operator
  function isOperator0(x: number) {
    return ["+", "-", "±", "*", "=", ">", "<", "≥", "≤", "≠", "→", " ", "〔", "〕"].includes(
      input[x]
    );
  }

  function isOperator1(x: number) {
    return ["+", "-", "±", "*", "=", ">", "<", "≥", "≤", "≠", "→", "/", "%", "〔", "〕"].includes(
      input[x]
    );
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
  let functionSymbols = /^[a-wΑ-ωⒶ-ⓏＡ-Ｚ⒜-⒵√%][\(\_\^]/gi;
  input = " " + input + " "; // this gives some breathing space

  // symbol replacements
  replace(/ϕ/g, "φ");
  replace(/\*\*/g, "^");
  replace(/(?<![A-Z|a-z|Α-ω])sqrt/g, "√");
  replace(/(?<![A-Z|a-z|Α-ω])cbrt/g, "∛");
  replace(/(?<![A-Z|a-z|Α-ω])infinity|infty/g, "∞");
  replace(/(?<![A-Z|a-z|Α-ω])mod(ulus|ulo)/g, "mod");
  replace(/(?<![A-Z|a-z|Α-ω])mod(?!\s*\()/g, "%");
  replace(/(?<![A-Z|a-z|Α-ω])pm/g, "±");
  replace(/×|∙/g, "*");
  replace(/==/g, "=");
  replace(/\>\=/g, "≥");
  replace(/\<\=/g, "≤");
  replace(/\!\=/g, "≠");
  replace(/\-\>/g, "→");
  
  // replace piecewise {} brackets with special character
  while (find(/(?<!_|\^|\\\w+|\S]|}){/) != -1) {
		startingIndex = find(/(?<!_|\^|\\\w+|\S]|}){/);
		i = startingIndex;
		bracket = -1;
		while (i < input.length) {
			i++;
			bracketEvalFinal();
			if (bracket == 0) {
				overwrite(startingIndex, "〔");
				overwrite(i, "〕");
				break;
			}
		}
	}

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ
  replace(/(?<![A-Z|a-z|Α-ω])arcsinh/g, "Ⓐ"); // 	https://qaz.wtf/u/convert.cgi?
  replace(/(?<![A-Z|a-z|Α-ω])arccosh/g, "Ⓑ");
  replace(/(?<![A-Z|a-z|Α-ω])arctanh/g, "Ⓒ");
  replace(/(?<![A-Z|a-z|Α-ω])arccsch/g, "Ⓓ");
  replace(/(?<![A-Z|a-z|Α-ω])arcsech/g, "Ⓔ");
  replace(/(?<![A-Z|a-z|Α-ω])arccoth/g, "Ⓕ");
  replace(/(?<![A-Z|a-z|Α-ω])sinh/g, "Ⓖ");
  replace(/(?<![A-Z|a-z|Α-ω])cosh/g, "Ⓗ");
  replace(/(?<![A-Z|a-z|Α-ω])tanh/g, "Ⓘ");
  replace(/(?<![A-Z|a-z|Α-ω])csch/g, "Ⓙ");
  replace(/(?<![A-Z|a-z|Α-ω])sech/g, "Ⓚ");
  replace(/(?<![A-Z|a-z|Α-ω])coth/g, "Ⓛ");
  replace(/(?<![A-Z|a-z|Α-ω])arcsin/g, "Ⓜ");
  replace(/(?<![A-Z|a-z|Α-ω])arccos/g, "Ⓝ");
  replace(/(?<![A-Z|a-z|Α-ω])arctan/g, "Ⓞ");
  replace(/(?<![A-Z|a-z|Α-ω])arccsc/g, "Ⓟ");
  replace(/(?<![A-Z|a-z|Α-ω])arcsec/g, "Ⓠ");
  replace(/(?<![A-Z|a-z|Α-ω])arccot/g, "Ⓡ");
  replace(/(?<![A-Z|a-z|Α-ω])sin/g, "Ⓢ");
  replace(/(?<![A-Z|a-z|Α-ω])cos/g, "Ⓣ");
  replace(/(?<![A-Z|a-z|Α-ω])tan/g, "Ⓤ");
  replace(/(?<![A-Z|a-z|Α-ω])csc/g, "Ⓥ");
  replace(/(?<![A-Z|a-z|Α-ω])sec/g, "Ⓦ");
  replace(/(?<![A-Z|a-z|Α-ω])cot/g, "Ⓧ");
  replace(/(?<![A-Z|a-z|Α-ω])log|ln/g, "Ⓩ");

  // ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  replace(/int(egral|)(?!\S)/g, "Ａ");
  replace(/int(egral|)(?=_)/g, "Ｂ");
  replace(/sum(?=_)/g, "Ｃ");
  replace(/prod(uct|)(?=_)/g, "Ｄ");
  while (find(/(?<![A-Z|a-z|Α-ω])mod(?![A-Z|a-z|Α-ω])/) != -1) {
    i = find(/(?<![A-Z|a-z|Α-ω])mod(?![A-Z|a-z|Α-ω])/) + 3;
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEval();
      if (input[i] == "," && bracket == -1) {
        replace(/(?<![A-Z|a-z|Α-ω])mod(?![A-Z|a-z|Α-ω])/, "Ｅ");
        break;
      }
      if (bracket == 0) {
        replace(/(?<![A-Z|a-z|Α-ω])mod(?![A-Z|a-z|Α-ω])/, "%");
        break;
      }
    }
    continue;
  }
  replace(/(?<![A-Z|a-z|Α-ω])abs(olute|)/g, "Ｆ");
  while (find(/\|/) != -1) {
    i = find(/\|/) + 1;
    overwrite(i - 1, "Ｆ(");
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
  replace(/(?<![A-Z|a-z|Α-ω])binomial(?![A-Z|a-z|Α-ω])/g, "Ｇ");
  replace(/(?<![A-Z|a-z|Α-ω])floor(?![A-Z|a-z|Α-ω])/g, "Ｈ");
  replace(/(?<![A-Z|a-z|Α-ω])ceiling(?![A-Z|a-z|Α-ω])/g, "Ｉ");
  replace(/(?<![A-Z|a-z|Α-ω])round(?![A-Z|a-z|Α-ω])/g, "Ｊ");
  replace(/(?<![A-Z|a-z|Α-ω])(gcd|gcf)(?![A-Z|a-z|Α-ω])/g, "Ｋ");
  replace(/(?<![A-Z|a-z|Α-ω])lcm(?![A-Z|a-z|Α-ω])/g, "Ｌ");
  while (find(/d(\^\d*)*\/dx(\^\d*)*/) != -1) {
    i = find(/d(\^\d*)*\/dx(\^\d*)*/);
    selection = input.match(/(?<=\^)(\d*)/)?.[0] ?? "";
    replace(/d(\^\d*)*\/dx(\^\d*)*/, "");
    insert(i, "Ｍ");
    insert(i + 1, "^(" + selection + ")");
    break;
  }

  // unused: ⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵

  // dead space removal
  replace(/(?<=[\/\^\_\√∛%])\s*/g, "");
  replace(/\s*(?=[\/\^\_%])/g, "");

  // trail removal
  replace(/\sfor(?!.*\sfor).*/g, "");
  replace(/\(Taylor series\)/g, "");

  // latin replacements
  replace(/(?<![A-Z|a-z|Α-ω])alpha/g, "α");
  replace(/(?<![A-Z|a-z|Α-ω])beta/g, "β");
  replace(/(?<![A-Z|a-z|Α-ω])Gamma/g, "Γ");
  replace(/(?<![A-Z|a-z|Α-ω])gamma/g, "γ");
  replace(/(?<![A-Z|a-z|Α-ω])Delta/g, "Δ");
  replace(/(?<![A-Z|a-z|Α-ω])delta/g, "δ");
  replace(/(?<![A-Z|a-z|Α-ω])epsilon/g, "ε");
  replace(/(?<![A-Z|a-z|Α-ω])zeta/g, "ζ");
  replace(/(?<![A-Z|a-z|Α-ω])eta/g, "η");
  replace(/(?<![A-Z|a-z|Α-ω])Theta/g, "Θ");
  replace(/(?<![A-Z|a-z|Α-ω])theta/g, "θ");
  replace(/(?<![A-Z|a-z|Α-ω])iota/g, "ι");
  replace(/(?<![A-Z|a-z|Α-ω])kappa/g, "κ");
  replace(/(?<![A-Z|a-z|Α-ω])Lambda/g, "Λ");
  replace(/(?<![A-Z|a-z|Α-ω])lambda/g, "λ");
  replace(/(?<![A-Z|a-z|Α-ω])mu/g, "μ");
  replace(/(?<![A-Z|a-z|Α-ω])nu/g, "ν");
  replace(/(?<![A-Z|a-z|Α-ω])Xi/g, "Ξ");
  replace(/(?<![A-Z|a-z|Α-ω])xi/g, "ξ");
  replace(/(?<![A-Z|a-z|Α-ω])Pi/g, "Π");
  replace(/(?<![A-Z|a-z|Α-ω])pi/g, "π");
  replace(/(?<![A-Z|a-z|Α-ω])rho/g, "ρ");
  replace(/(?<![A-Z|a-z|Α-ω])Sigma/g, "Σ");
  replace(/(?<![A-Z|a-z|Α-ω])sigma/g, "σ");
  replace(/(?<![A-Z|a-z|Α-ω])tau/g, "τ");
  replace(/(?<![A-Z|a-z|Α-ω])Upsilon/g, "Τ");
  replace(/(?<![A-Z|a-z|Α-ω])upsilon/g, "υ");
  replace(/(?<![A-Z|a-z|Α-ω])Phi/g, "Φ");
  replace(/(?<![A-Z|a-z|Α-ω])phi/g, "φ");
  replace(/(?<![A-Z|a-z|Α-ω])chi/g, "χ");
  replace(/(?<![A-Z|a-z|Α-ω])Psi/g, "Ψ");
  replace(/(?<![A-Z|a-z|Α-ω])psi/g, "ψ");
  replace(/(?<![A-Z|a-z|Α-ω])Omega/g, "Ω");
  replace(/(?<![A-Z|a-z|Α-ω])omega/g, "ω");
  replace(/(?<![A-Z|a-z|Α-ω])constant/g, "C");

  // MISSING BRACKETS
  // this will ensure brackets AFTER each operator
  while (findFinal(/[\/\^\_\√∛%](?!\()/g) != -1) {
    i = findFinal(/[\/\^\_\√∛%](?!\()/g) + 1;
    insert(i, "(");
    temp = input.slice(i - 2, i);
    temp = temp.search(functionSymbols) != -1;
    bracket = -1;
    selection = input.slice(i + 1, input.length);
    if (selection[0] == "+" || selection[0] == "-" || selection[0] == "±") {
      i += 1;
    }
    if (
      selection.search(functionSymbols) == 0 &&
      selection[1] == "("
    ) {
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
        if (input[i] == " " || input[i] == ",") {
          // eg: "a/(a 2" → "a/(a) (2)"
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
      replace(/\//, "╱");
    } else {
      replace(/%/, "⁒");
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
  replace(/╱/g, "/");
  replace(/⁒/g, "%");
  // OFFICIAL BRACKET CHECKPOINT REACHED

  // BEGIN LATEX FORMATTING
  // implement function exponents
  while (find(/(?<=[Ⓐ-Ⓩ]\^)\(/) != -1) {
    startingIndex = find(/(?<=[Ⓐ-Ⓩ]\^)\(/);
    i = startingIndex;
    overwrite(i, "‹");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEval();
      if (bracket == 0) {
        overwrite(i, "›");
        break;
      }
    }
    selection = input.slice(startingIndex, i + 1);
    if (
      selection == "‹2›" ||
      (selection == "‹-1›" && input[startingIndex - 2] != "Ⓩ")
    ) {
      continue;
    } else {
      input =
        input.slice(0, startingIndex - 1) + input.slice(i + 1, input.length);
      i = startingIndex;
      insert(i, "(");
      bracket = -2;
      while (i < input.length) {
        i++;
        bracketEval();
        if (bracket == -1) {
          insert(i, ")");
          insert(i + 1, "^" + selection);
          break;
        }
      }
    }
  }
  replace(/‹/g, "(");
  replace(/›/g, ")");

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
        overwrite(i, "Ｅ(");
        break;
      }
    }
  }

  // implement subscripts and superscripts
  while (find(/[_\^√∛]\(/) != -1) {
    i = find(/[_\^√∛]\(/) + 1;
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
          overwrite(startingIndex, "❌");
          overwrite(i - 1, "❌");
          break;
        } else {
          overwrite(startingIndex, "✅");
          break;
        }
      }
      if (!temp && bracket == 0) {
        temp = true;
      }
    }
    replace(/❌/g, "");
  }
  replace(/✅/g, "(");

  // implement absolutes
  replace(/(?<=Ｆ)\s*/g, "");
  while (find(/Ｆ\(/) != -1) {
    i = find(/Ｆ\(/);
    replace(/Ｆ\(/, "«");
    bracket = -1;
    while (i < input.length) {
      i++;
      bracketEvalFinal();
      if (bracket == 0) {
        overwrite(i, "»");
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
            "√[" +
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
            "√[" +
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
  replace(/(?<=Ⓩ)\s*/g, "");
  while (find(/(?<=Ⓩ)\(/) != -1) {
    startingIndex = find(/(?<=Ⓩ)\(/);
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
        overwrite(startingIndex, "✅");
        break;
      }
    }
  }
  replace(/✅/g, "(");

  // FINAL REPLACEMENTS
  // implment proper brackets when all the operator brackets are gone
  replace(/\(/g, "\\left(");
  replace(/\)/g, "\\right)");
  replace(/\«/g, "\\left|");
  replace(/\»/g, "\\right|");
  replace(/〔/g,"\\left\\{");
	replace(/〕/g,"\\right\\}");

  // symbol replacements
  replace(/√/g, "\\sqrt");
  replace(/∛/g, "\\sqrt[3]");
  replace(/\*/g, "\\cdot ");
  replace(/(?<=\d) (?=\d)/g, " \\cdot ");

  // function replacements
  // ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ
  replace(/Ⓐ/g, "arcsinh");
  replace(/Ⓑ/g, "arccosh");
  replace(/Ⓒ/g, "arctanh");
  replace(/Ⓓ/g, "arccsch");
  replace(/Ⓔ/g, "arcsech");
  replace(/Ⓕ/g, "arccoth");
  replace(/Ⓖ/g, "sinh");
  replace(/Ⓗ/g, "cosh");
  replace(/Ⓘ/g, "tanh");
  replace(/Ⓙ/g, "csch");
  replace(/Ⓚ/g, "sech");
  replace(/Ⓛ/g, "coth");
  replace(/Ⓜ/g, "arcsin");
  replace(/Ⓝ/g, "arccos");
  replace(/Ⓞ/g, "arctan");
  replace(/Ⓟ/g, "arccsc");
  replace(/Ⓠ/g, "arcsec");
  replace(/Ⓡ/g, "arccot");
  replace(/Ⓢ/g, "sin");
  replace(/Ⓣ/g, "cos");
  replace(/Ⓤ/g, "tan");
  replace(/Ⓥ/g, "csc");
  replace(/Ⓦ/g, "sec");
  replace(/Ⓧ/g, "cot");
  replace(/Ⓩ(?!_)/g, "ln");
  replace(/Ⓩ/g, "log");

  // ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ
  replace(/Ａ/g, "\\int_{0}^{t}");
  replace(/Ｂ/g, "\\int");
  replace(/Ｃ/g, "\\sum");
  replace(/Ｄ/g, "\\prod");
  replace(/Ｅ/g, "\\operatorname{mod}");
  replace(/Ｇ/g, "\\operatorname{nCr}");
  replace(/Ｈ/g, "\\operatorname{floor}");
  replace(/Ｉ/g, "\\operatorname{ceil}");
  replace(/Ｊ/g, "\\operatorname{round}");
  replace(/Ｋ/g, "\\operatorname{gcf}");
  replace(/Ｌ/g, "\\operatorname{lcm}");
  replace(/Ｍ(?!\^\{)/g, "\\frac{d}{dx}");
  while (find(/Ｍ/) != -1) {
    startingIndex = find(/Ｍ/);
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

  // latin replacements
  replace(/α/g, "\\alpha");
  replace(/β/g, "\\beta");
  replace(/Γ/g, "\\Gamma");
  replace(/γ/g, "\\gamma");
  replace(/Δ/g, "\\Delta");
  replace(/δ/g, "\\delta");
  replace(/ε/g, "\\epsilon");
  replace(/ζ/g, "\\zeta");
  replace(/η/g, "\\eta");
  replace(/Θ/g, "\\Theta");
  replace(/θ/g, "\\theta");
  replace(/ι/g, "\\iota");
  replace(/κ/g, "\\kappa");
  replace(/Λ/g, "\\Lambda");
  replace(/λ/g, "\\lambda");
  replace(/μ/g, "\\mu");
  replace(/ν/g, "\\nu");
  replace(/Ξ/g, "\\Xi");
  replace(/ξ/g, "\\xi");
  replace(/Π/g, "\\Pi");
  replace(/π/g, "\\pi");
  replace(/ρ/g, "\\rho");
  replace(/Σ/g, "\\Sigma");
  replace(/σ/g, "\\sigma");
  replace(/τ/g, "\\tau");
  replace(/Τ/g, "\\Upsilon");
  replace(/υ/g, "\\upsilon");
  replace(/Φ/g, "\\Phi");
  replace(/φ/g, "\\phi");
  replace(/χ/g, "\\chi");
  replace(/Ψ/g, "\\Psi");
  replace(/ψ/g, "\\psi");
  replace(/Ω/g, "\\Omega");
  replace(/ω/g, "\\omega");
  replace(/polygamma/g, "\\psi_{poly}");

  replace(/(^(\s*))|(\s*$)/g, "");
  return input;
}

// Always love to have my signature :)
console.log(
  "wolfram2desmos loaded properly ✔️\n_   _ _____ ___  _   _ _____ _   _ ___________  ___  \n| | | |  ___/ _ \\| | | |  ___| \\ | |_   _| ___ \\/ _ \\ \n| |_| | |__/ /_\\ | | | | |__ |  \\| | | | | |_/ / /_\\ \\\n|  _  |  __|  _  | | | |  __|| . ` | | | |    /|  _  |\n| | | | |__| | | \\ \\_/ | |___| |\\  |_| |_| |\\ \\| | | |\n\\_| |_\\____\\_| |_/\\___/\\____/\\_| \\_/\\___/\\_| \\_\\_| |_/"
);
