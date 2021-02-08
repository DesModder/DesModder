//input = "(3 + 1 )/ (3 + 3) + 767 + 1/(15 + 1/(1 + 1/(292 + 81/(1 + 1/(1 + 1/(1 + 1/(2 + 1/(1 + 1/(3 + 1/(1 + 1/(14 + 1/(2 + 1/(1 + 1/(1 + 1/(2 + 1/(2 + 1/(2 + 1)))))))))))))))))";
//input = "x = -(-1478412 π a^2 f_57 + sqrt((-1478412 π a^2 f_57 - 54)^2 - 2916) - 54)^(1/3)/(702 2^(1/3) a) - 1/(39 2^(2/3) a (-1478412 π a^2 f_57 + sqrt((-1478412 π a^2 f_57 - 54)^2 - 2916) - 54)^(1/3)) + 1/(234 a)";
//input = "a!=0, x = (sqrt((-27 a^2 d + 9 a b c - 2 b^3)^2 + 4 (3 a c - b^2)^3) - 27 a^2 d + 9 a b c - 2 b^3)^(1/3)/(3 2^(1/3) a) - (2^(1/3) (3 a c - b^2))/(3 a (sqrt((-27 a^2 d + 9 a b c - 2 b^3)^2 + 4 (3 a c - b^2)^3) - 27 a^2 d + 9 a b c - 2 b^3)^(1/3)) - b/(3 a)";
//input = "1/19 (5^(1/3) (19 sqrt(361 x^2 - 1642 x + 841) + 361 x - 821)^(1/3) + (42 5^(2/3))/(19 sqrt(361 x^2 - 1642 x + 841) + 361 x - 821)^(1/3) - 1)";
//input = "1/sqrt(23452xcxc+pi+(sqrt(135/1351235123)))^5";
//let input = "integral_1^y(x) (1/sqrt(2 log(x^2 + (3 - 2 ζ) x + (ζ - 3) ζ) + 2 c_1 + 1) - integral_1^x (2 ζ - 2 ξ - 3)/((ξ^2 + (3 - 2 ζ) ξ + (ζ - 3) ζ) (2 log(ξ^2 + (3 - 2 ζ) ξ + (ζ - 3) ζ) + 2 c_1 + 1)^(3/2)) dξ) dζ + integral_1^x (1 - 1/sqrt(2 log(ξ^2 - 2 y(x) ξ + 3 ξ + y(x)^2 - 3 y(x)) + 2 c_1 + 1)) dξ = c_2";
//let input = "1 - gamma (x - 1) + 1/12 (6 gamma ^2 + π^2) (x - 1)^2 + 1/6 (x - 1)^3 (- gamma ^3 - ( gamma π^2)/2 + polygamma(2, 1)) + 1/24 (x - 1)^4 ( gamma ^4 + gamma ^2 π^2 + (3 π^4)/20 - 4 gamma polygamma(2, 1)) + 1/120 (x - 1)^5 (- gamma ^5 - (5 gamma ^3 π^2)/3 - (3 gamma π^4)/4 + 10 gamma ^2 polygamma(2, 1) + (5 π^2 polygamma(2, 1))/3 + polygamma(4, 1)) + O((x - 1)^6)";
//let input = "π = -3 sqrt(3) + 1/2 (sqrt(3) sum_(k=1)^∞ k/binomial(2 k, k)) 9";

let input = "binomial(sum_(n=0)^∞(a_nx^n)/(n!) = (2 e^(x/2) sinh((sqrt(5) x)/2))/sqrt(5),54)";

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
	input = input.slice(0,index) + replacement + input.slice(index,input.length);
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

function bracketEval1() {
	i++;
	if (input[i] == ")") {
		bracket += 1;
	}
	else if (input[i] == "(") {
		bracket -= 1;
	}
}

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
	return !(/[A-Z|a-z|\d|Α-ω|∞|א|\_|\\]/g).test(input[index]);
}
// predefining some variables.
let i;
let bracket;
let startingIndex;
input = " " + input + " ";
// check if there is an equal number of brackets
if (count(/\(/g) != count(/\)/g)) {
	throw new Error('Input has uneven brackets');
}
replace(/sqrt/g, "√");
replace(/\\infty|infinity|infty/g, "∞");
replace(/\\pm|pm/g, "±");
replace(/\\pi|pi/g, "π");
replace(/\!\=/g, "≠");
replace(/\/\s*/g,  "/");
replace(/\s*\//g, "/");
replace(/\^\s*/g, "^");
replace(/\s*\^/g, "^");

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

replace(/(?<![A-Z|a-z|Α-ω])binomial/g, "א");

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
		console.log("hi");
		while (i < input.length) {
			i++;
			if (isOperator(i)) {
				console.log(input[i]);
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
	i = startingIndex - 0;
	
	// prior to the slash
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
	// after the slash
	i = startingIndex + 1;
	
	// inverse root scenario
	// this happens when there is a function in the denominator
	let isDenominatorFunction = (startingIndex == find(/\/((\-)|([A-Z|a-z|Α-ω|א-ת|√|∞|\_])|(\-([A-Z|a-z|Α-ω|א-ת|√|∞|\_])))(\(|\{)/g));
	if (isDenominatorFunction) {
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
						i++;
						if (input[i] == ")" || input[i] == "}") {
							bracket += 1;
						}
						else if (input[i] == "(" || input[i] == "}") {
							bracket -= 1;
						}
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
	overwrite(startingIndex, "");
}
// implement summation and products
while (find(/(sum|prod)_\(\S+=\d+\)/g) != -1) {
	i = find(/(sum|prod)_\(\S+=\d+\)/g) + 4;
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

// implment proper brackets when all the operator brackets are gone
replace(/\(/g,"\\left\(");
replace(/\)/g,"\\right\)");
// replace blank spaces between numbers with cross products
while (find(/\d\s\d/g) != -1) {
	i = find(/\d\s\d/g) + 1;
	overwrite(i, "\\times");
}
replace(/log\(/g, "\\ln\(");
replace(/integral/g, "\\int_{}");
replace(/sum_/g, "\\sum_");
replace(/prod_/g, "\\prod_");
replace(/\\frac\{\}/g, "\\frac{1}");
// rounding up any semi-final replacements
replace(/√/g, "\\sqrt");
replace(/\*/g, "\\times");
replace(/≠/g, "\\ne");
replace(/∞/g,"\\infty");
replace(/±/g,"\\pm");
replace(/א/g, "\\operatorname{nCr}");
replace(/^\s/g, "");
replace(/\s$/g, "");
// throw in the latin letters in for the hell of it

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



console.log(input);