//let input = "B_n = 2^(1 - n) (-1 + n) n (i/π)^n integral_0^1 (log(1 - t) log^(-2 + n)(t))/t dt for (n/2 element Z and n>0)";
let input = "sin(z) = z product_(k=1)^∞(1 - z^2/(k^2 π^2))";

// FUNCTIONS

// returns the first match's index
function find(expr) {
	return input.search(expr);
}

// replaces all matches with replacement
function replace(expr,replacement) {
	input = input.replace(expr,replacement);
}

// inserts replacement at given index
function insert(index,replacement) {
	if (index >= 0) {
		input = input.slice(0,index) + replacement + input.slice(index,input.length);
	}
}

// overwrites current index with replacement
function overwrite(index,replacement) {
	input = input.slice(0,index) + replacement + input.slice(index + 1,input.length);
}

// returns the number of matches
function count(expr) {
	if (input.match(expr) != null) {
		return input.match(expr).length;
	}
	else {
		return 0;
	}
}

// iterates the bracket parser for ()
function bracketEval1() {
	i++;
	if (input[i] == ")") {
		bracket += 1;
	}
	else if (input[i] == "(") {
		bracket -= 1;
	}
}

// iterates the bracket parser for {} and ()
function bracketEval2() {
	i++;
	if (input[i] == ")" || input[i] == "}") {
		bracket += 1;
	}
	else if (input[i] == "(" || input[i] == "{") {
		bracket -= 1;
	}
}

// returns if the specified index is a "non-variable"
function isOperator(index) {
	return !(/[A-Z|\d|Α-ω|ϕ|∞|א-ת|\_|\\]/gi).test(input[index]);
}


// PREPARATIONS

// checks if there is an equal number of brackets
{
	if (count(/\(/g) > count(/\)/g)) {
		throw new Error("Input has " + (count(/\(/g) - count(/\)/g)) + " more '(' characters than ')' characters");
	}
	if (count(/\(/g) < count(/\)/g)) {
		throw new Error("Input has " + (count(/\)/g) - count(/\(/g)) + " more ')' characters than '(' characters");
	}
	if (count(/\|/g) % 2 == 1) {
		throw new Error("Input has uneven '|' brackets");
	}
}


// predefine some variables.
let i, bracket, startingIndex, isOneArgument;
input = " " + input + " "; // this gives some breathing space

// preform prelimenary replacements
{
	// symbolic replacements
	replace(/sqrt/g, "√");
	replace(/\\infty|infinity|infty/g, "∞");
	replace(/\\pm|pm/g, "±");
	replace(/\\pi|pi/g, "π");
	replace(/\>\=/g, "≥");
	replace(/\<\=/g, "≤");
	replace(/\!\=/g, "≠");
	replace(/(\s*(?=(\/|\^)))|((?<=(\/|\^))\s*)/g, "");
	replace(/\s*(mod|\%)\s*/g, "mod");
	replace(/\|/g, " | ");

	// misc function replacements
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])binomial/g, "א"); // hebrew will be my function placeholders
	replace(/floor/g, "ב");
	replace(/ceiling/g, "ג");
	replace(/round/g, "ד");
	replace(/gcd|gcf/g, "ה");
	replace(/lcm/g, "ו");
	// "ז" is for mod final
	replace(/abs/g, "ח");
	replace(/arcsin/g, "ט");
	replace(/arccos/g, "י");
	replace(/arctan/g, "כ");
	replace(/arccsc/g, "ל");
	replace(/arcsec/g, "מ");
	replace(/arccot/g, "נ");
	replace(/sin/g, "ס");
	replace(/cos/g, "ע");
	replace(/tan/g, "פ");
	replace(/csc/g, "צ");
	replace(/sec/g, "ק");
	replace(/cot/g, "ר");
	replace(/log|ln/g, "ת");

	// latin replacements
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])alpha/g, "α");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])beta/g, "β"); 
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Gamma/g, "Γ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])gamma/g, "γ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Delta/g, "Δ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])delta/g, "δ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])epsilon/g, "ε");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])zeta/g, "ζ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])eta/g, "η");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Theta/g, "Θ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])theta/g, "θ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])iota/g, "ι"); 
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])kappa/g, "κ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Lambda/g, "Λ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])lambda/g, "λ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])mu/g, "μ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])nu/g, "ν");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Xi/g, "Ξ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])xi/g, "ξ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Pi/g, "Π");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])pi/g, "π");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])rho/g, "ρ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Sigma/g, "Σ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])sigma/g, "σ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])tau/g, "τ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Upsilon/g, "Τ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])upsilon/g, "υ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Phi/g, "Φ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])phi/g, "φ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])chi/g, "χ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Psi/g, "Ψ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])psi/g, "ψ");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])Omega/g, "Ω");
	replace(/(?<![A-Z|a-z|Α-ω|ϕ])omega/g, "ω");
	replace(/ϕ/g,"φ");
}


// PARSING

// implement square roots
while (find(/√\(/g) != -1) {
	i = find(/√\(/g) + 1;
	overwrite(i,"{");
	bracket = 0;
	while (i < input.length) {
		bracketEval1();
		if (bracket == 1) {
			overwrite(i,"}");
			i = input.length;
		}
	}
}

// implement exponents
while (find(/\^/g) != -1) {
	i = find(/\^/g);
	overwrite(i, "@");
	i++;
	if (input[i] == "(") {
		overwrite(i,"{");
		bracket = -1;
		while (i < input.length) {
			bracketEval1();
			if (bracket == 0) {
				overwrite(i,"}");
				i = input.length;
			}
		}
	}
	else {
		insert(i,"{");
		while (i < input.length) {
			i++;
			if (isOperator(i)) {
				insert(i, "}");
				i = input.length;
			}
		}
	}
}
replace(/\@/g,"^");

// implement fractions
while (find(/\//g) != -1) {
	startingIndex = find(/\//g);

	// implement the numerator; prior to the slash
	{
		i = startingIndex;
		
		// preceded by a ")" scenario
		if (input[i - 1] == ")") {
			overwrite(i - 1, "}");
			bracket = 1;
			while (i > 0) {
				i -= 2;
				bracketEval1();
				if (bracket == 0) {
					overwrite(i, "\\frac{");
					startingIndex += 5;
					i = 0;
				}
			}
		}

		// preceded WITHOUT a ")" scenario
		else {
			insert(i, "}");
			startingIndex += 1;
			while (i > 0) {
				i -= 1;
				if (isOperator(i)) {
					insert(i + 1, "\\frac{");
					startingIndex += 6;
					i = 0;
				}
			}
		}
	}

	// implement the denominator; after the slash 
	{
		i = startingIndex + 1;
	
		// reciprocal function scenario
		// this happens when a function begins the denominator
		let isFunction = (startingIndex == find(/\/((\-)|([A-Z|Α-ω|ϕ|א-ת|√|∞|\_])|(\-([A-Z|Α-ω|ϕ|א-ת|√|∞|\_])))(\(|\{)/gi));
		if (isFunction) {
			insert(i, "{(");
			i += 3;
			bracket = -2;
			while (i < input.length) {
				bracketEval2();
				if (bracket == -1) {
					if (input[i + 1] == "^") {
						// in this situation, as pointed by SlimRunner, there is an exponent at the end of the fraction. we need to correct this by including it in the denominator
						bracket = -1;
						i++;
						while (i < input.length) {
							bracketEval2();
							if (bracket == 0) {
								break;
							}
						}
					}
					insert(i + 1, ")}");
					i = input.length;
				}
			}
		}

		// following a "(" scenario
		else if (input[i] == "(") {
			overwrite(i, "{");
			bracket = -1;
			while (i < input.length) {
				bracketEval1();
				if (bracket == 0) {
					if (input[i + 1] == "^") {
						// in this situation, as pointed by SlimRunner, there is an exponent at the end of the fraction. we need to correct this by including it in the denominator
						bracket = -1;
						i++;
						while (i < input.length) {
							bracketEval2();
							if (bracket == 0) {
								insert(startingIndex + 2, "(");
								insert(i + 1, "}");
								i = input.length;
							}
						}
					}
					else {
						overwrite(i, "}");
					}
					i = input.length;
				}
			}
		}

		// following WITHOUT a "(" scenario
		else {
			insert(i, "{");
			while (i < input.length) {
				i++;
				if (input[i] == "^") {
					// in this situation, as pointed by SlimRunner, there is an exponent at the end of the fraction. we need to correct this by including it in the denominator
					bracket = -1;
					i++;
					while (i < input.length) {
						bracketEval2();
						if (bracket == 0) {
							insert(i + 1, "}");
							i = input.length;
						}
					}
				}
				else if (isOperator(i)) {
					insert(i, "}");
					i = input.length;
				}
			}
		}
	}

	overwrite(startingIndex, "");
}

// implement summation and products
while (find(/(sum|prod(uct|))_\([A-Z|a-z|\d|Α-ω|∞|א-ת|\_|\\]+\s*=\s*[A-Z|a-z|\d|Α-ω|∞|א-ת|\_|\\]+\)/g) != -1) {
	i = find(/(sum|prod(uct|))_\([A-Z|a-z|\d|Α-ω|∞|א-ת|\_|\\]+\s*=\s*[A-Z|a-z|\d|Α-ω|∞|א-ת|\_|\\]+\)/g) + 4;
	if (input[i] == "u") {
		i += 4;
	}
	else if (input[i] == "_") {
		i ++;
	}
	overwrite(i, "{");
	bracket = -1;
	while (i < input.length) {
		bracketEval1();
		if (bracket == 0) {
			overwrite(i, "}");
			break;
		}
	}
}

// implement subscripts
while (find(/_\d/g) != -1) {
	i = find(/_\d/g) + 1;
	insert(i, "{");
	while (i < input.length) {
		i++;
		if (isOperator(i)) {
			insert(i,"}");
			i = input.length;
		}
	}
}

// implement modulos
// THIS USES THE SAME CODE AS THE FRACTION PARSER
while (find(/mod/g) != -1) {
	startingIndex = find(/mod/g);
	isOneArgument = true;

	// first check if the modulus is using 2-arguments instead of 1. if this is the case, we don't have to worry any further.
	i = startingIndex + 3;
	if (input[i] == "(") {
		bracket = -1;
		while (i < input.length) {
			bracketEval1();
			if (bracket == -1 && input[i] == ",") {
				isOneArgument = false;
				break;
			}
			if (bracket == 0) {
				overwrite(i, "");
				overwrite(startingIndex + 3, "");
				break;
			}
		}
	}

	if (isOneArgument) {
		// before the modulus
		{
			i = startingIndex;
			// preceded with a ")" scenario
			if (input[i - 1] == ")") {
				overwrite(i - 1, "");
				bracket = 1;
				while (i > 0) {
					i -= 2;
					bracketEval1();
					if (bracket == 0) {
						overwrite(i, "ז(");
						startingIndex += 1;
						break;
					}
				}
			}

			// preceded WITHOUT a ")" scenario
			else {
				while (i > 0) {
					i -= 1;
					if (isOperator(i)) {
						insert(i + 1, "ז(");
						startingIndex += 2;
						break;
					}
				}
			}
		}
	
		// after the modulus 
		{
			i = startingIndex + 3;
	
			// this happens when a function begins the modulus
			let isFunction = (startingIndex == find(/mod((\-)|([A-Z|Α-ω|ϕ|א-ת|√|∞|\_])|(\-([A-Z|Α-ω|ϕ|א-ת|√|∞|\_])))(\(|\{)/gi));
			if (isFunction) {
				insert(i, "(");
				i += 2;
				bracket = -1;
				while (i < input.length) {
					bracketEval2();
					if (bracket == 0) { // bracket == -1
						if (input[i + 1] == "^") {
						// in this situation, as pointed by SlimRunner, there is an exponent at the end of the fraction. we need to correct this by including it in the denominator
							bracket = -1;
							i++;
							while (i < input.length) {
								bracketEval2();
								if (bracket == 0) {
									break;
								}
							}
						}
						insert(i + 1, ")");
						i = input.length;
					}
				}
			}


			// following WITHOUT a "(" scenario
			else {
				insert(i, "(");
				while (i < input.length) {
					i++;
					if (input[i] == "^") {
					// in this situation, as pointed by SlimRunner, there is an exponent at the end of the fraction. we need to correct this by including it in the denominator
						bracket = -1;
						i++;
						while (i < input.length) {
							bracketEval2();
							if (bracket == 0) {
								insert(i + 1, ")");
								i = input.length;
							}
						}
					}
					else if (isOperator(i)) {
						insert(i, ")");
						i = input.length;
					}
				}
			}
		}
		replace(/mod\(/,",");
	}
	else {
		replace(/mod\(/,"ז(");
	}

}

// implement absolutes
while (find(/ח\(/g) != -1) {
	i = find(/ח\(/g);
	replace(/ח\(/, "⟨");
	bracket = -1;
	while (i < input.length) {
		bracketEval2();
		if (bracket == 0) {
			overwrite(i, "⟩");
			i = input.length;
		}
	}
}
while (find(/\|/g) != -1) {
	i = find(/\|/g);
	overwrite(i, "⟨");
	bracket = -1;
	while (i < input.length) {
		bracketEval2();
		if (bracket == -1 && input[i] == "|") {
			overwrite(i, "⟩");
			i = input.length;
		}
	}
}

// correct "use parens" scenario
while(find(/[א-ת]\^\{/g) != -1) {
	startingIndex = find(/[א-ת]\^\{/g);
	i = startingIndex  + 2;
	bracket = -1;
	while (i < input.length) {
		bracketEval2();
		if (bracket == 0) {
			let slicedPortion = input.slice(startingIndex + 2, i + 1);

			// if there is no "(" after the exponent || it's trig^{-1|2}, then drop this.
			if (input[i + 1] != "(" || (input[startingIndex].match(/[ס-ר]/g) != null && (slicedPortion == "{-1}" || slicedPortion == "{2}"))) {
				overwrite(startingIndex + 1, "↑");
				i = input.length;
			}
			else {
				input = input.slice(0, startingIndex + 1) + input.slice(i + 1, input.length);
				i -= slicedPortion.length + 1;
				while (i < input.length) {
					bracketEval2();
					if (bracket == 0) {
						insert(i + 1, "↑" + slicedPortion);
						i = input.length;
					}
				}
			}
		}
	}
}
replace(/↑/g,"^");

// implment proper brackets when all the operator brackets are gone
replace(/\(/g,"\\left\(");
replace(/\)/g,"\\right\)");
replace(/\⟨/g,"\\left\|");
replace(/\⟩/g,"\\right\|");

// perform concluding replacements
{
	// function replacements
	replace(/int(egral|)/g, "\\int_{}");
	replace(/sum_/g, "\\sum_");
	replace(/prod(uct|)_/g, "\\prod_");
	replace(/\\frac\{\}/g, "\\frac{1}");

	// symbolic replacements
	replace(/√/g, "\\sqrt");
	replace(/(\*)|((?<=\d)\s*(?=\d))/g, "\\times ");
	replace(/≠/g, "\\ne");
	replace(/∞[A-Z|a-z]/g, "\\infty");
	replace(/∞/g, "\\infty");
	replace(/±/g, "\\pm");
	replace(/^\s/g, "");
	replace(/\s$/g, "");
	replace(/\s\s/g, "");
	replace(/and/g, "&");
	replace(/element/g, "ε");

	replace(/א/g, "\\operatorname{nCr}");
	replace(/ב/g, "\\operatorname{floor}");
	replace(/ג/g, "\\operatorname{ceil}");
	replace(/ד/g, "\\operatorname{round}");
	replace(/ה/g, "\\operatorname{gcd}");
	replace(/ו/g, "\\operatorname{lcm}");
	replace(/ז/g, "\\operatorname{mod}");
	replace(/ח/g, "\\operatorname{abs}");
	replace(/ט/g, "\\arcsin");
	replace(/י/g, "\\arccos");
	replace(/כ/g, "\\arctan");
	replace(/ל/g, "\\arccsc");
	replace(/מ/g, "\\arcsec");
	replace(/נ/g, "\\arccot");
	replace(/ס/g, "\\sin");
	replace(/ע/g, "\\cos");
	replace(/פ/g, "\\tan");
	replace(/צ/g, "\\csc");
	replace(/ק/g, "\\sec");
	replace(/ר/g, "\\cot");
	replace(/ת(?!_)/g, "\\ln");
	replace(/ת/g, "\\log");
	replace(/(?<!\\)ת/g, "\\ln");

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
	replace(/ϕ/g, "\\phi");
	replace(/χ/g, "\\chi");
	replace(/Ψ/g, "\\Psi");
	replace(/ψ/g, "\\psi");
	replace(/Ω/g, "\\Omega");
	replace(/ω/g, "\\omega");
	replace(/polygamma/g, "\\psi_{poly}");
}

console.log(input);