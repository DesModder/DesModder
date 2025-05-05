import type { Parser } from "src/globals";

type Parse = Parser["parse"];

export interface PublicConfig {
  /** operatorNames affects subscripting */
  operatorNames?: string;
  /** commandNames affects subscripting *and* gives the difference between \alpha and \\operatorname{total} */
  commandNames?: string;
  colors?: Colors;
  parseDesmosLatex?: Parse;
}

export function buildConfigFromGlobals(Desmos: any, calc: any) {
  const config = calc.controller.getMathquillConfig({});
  return buildConfig({
    operatorNames: config.autoOperatorNames,
    commandNames: config.autoCommands,
    colors: calc?.colors,
    parseDesmosLatex: Desmos.Private.Parser.parse,
  });
}

export function buildConfig(config: PublicConfig): Config {
  const operatorNames = split(config.operatorNames ?? defaultOperatorNames);
  for (const extra of extraOperatorNames) operatorNames.add(extra);
  return {
    operatorNames,
    commandNames: split(config.commandNames ?? defaultCommandNames),
    colors: config.colors ?? defaultColors,
    parseDesmosLatex: function (s: string) {
      if (!config.parseDesmosLatex)
        throw new Error(
          "Test Error: trying to parse LaTeX from Desmos, but the config does not define `parseDesmosLatex`."
        );
      return config.parseDesmosLatex(s, {
        allowDt: true,
        allowIndex: true,
        allowIntervalComprehensions: true,
      });
    },
  };
}

const extraOperatorNames = [
  // fragile
  "polyGamma",
  "argmin",
  "argmax",
  "uniquePerm",
  "rtxsqpone",
  "rtxsqmone",
  "hypot",
  // required for logbase to be good
  "logbase",
  // true and false have many exceptions
  "true",
  "false",
  // index and dt have many exceptions
  "index",
  "dt",
];

function split(s: string) {
  return new Set(s.split(" ").map((e) => e.split("|")[0]));
}

export interface Config {
  operatorNames: Set<string>;
  commandNames: Set<string>;
  colors: Colors;
  parseDesmosLatex: Parse;
}

type Colors = Record<string, string>;

const defaultOperatorNames =
  "exp ln log total length mean median quantile quartile nCr nPr stats stdev stddev stdDev stdevp stddevp stdDevP mad var varp variance cov covp corr spearman lcm mcm gcd mcd gcf mod ceil floor round abs min max sign signum sgn sin cos tan csc sec cot sinh cosh tanh csch sech coth arcsin arccos arctan arccsc arcsec arccot arcsinh arccosh arctanh arccsch arcsech arccoth arsinh arcosh artanh arcsch arsech arcoth polygon distance midpoint sort shuffle join unique erf TTest ttest TScore tscore iTTest ittest IndependentTTest TScore Tscore tscore normaldist tdist poissondist binomialdist uniformdist pdf cdf random inverseCdf inversecdf histogram dotplot boxplot pdf cdf rgb hsv for width height with det inv transpose rref trace";

const defaultCommandNames =
  "alpha beta sqrt theta phi pi tau nthroot cbrt sum prod integral percent infinity infty cross ans frac";

const defaultColors = {
  RED: "#c74440",
  BLUE: "#2d70b3",
  GREEN: "#388c46",
  ORANGE: "#fa7e19",
  PURPLE: "#6042a6",
  BLACK: "#000000",
};
