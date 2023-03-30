export const autoCommandNames: string =
  "alpha beta sqrt theta phi pi tau nthroot cbrt sum prod int ans percent infinity infty frac";
export const autoOperatorNames: string =
  "exp|exponent ln|natural-log log total length mean median quantile quartile nCr nPr stats stdev|standard-deviation stddev|standard-deviation stdDev|standard-deviation stdevp|standard-deviation-population stddevp|standard-deviation-population stdDevP|standard-deviation-population mad var|variance varp|variance-population variance cov|co-variance covp|co-variance-population corr|correlation spearman lcm mcm gcd mcd gcf mod ceil|ceiling floor round abs|absolute-value min max sign|signum signum sgn sin|sine cos|cosine tan|tangent csc|co-secant sec|secant cot|co-tangent sinh|hyperbolic-sine cosh|hyperbolic-cosine tanh|hyperbolic-tangent csch|hyperbolic-co-secant sech|hyperbolic-secant coth|hyperbolic-co-tangent arcsin|arc-sine arccos|arc-cosine arctan|arc-tangent arccsc|arc-co-secant arcsec|arc-secant arccot|arc-co-tangent arcsinh|hyperbolic-arc-sine arccosh|hyperbolic-arc-cosine arctanh|hyperbolic-arc-co-tangent arccsch|hyperbolic-arc-co-secant arcsech|hyperbolic-arc-secant arccoth|hyperbolic-arc-co-tangent arsinh|hyperbolic-ar-sine arcosh|hyperbolic-ar-cosine artanh|hyperbolic-ar-co-tangent arcsch|hyperbolic-ar-co-secant arsech|hyperbolic-ar-secant arcoth|hyperbolic-ar-co-tangent polygon distance midpoint sort shuffle join unique erf|error-function TTest|t-test ttest|t-test TScore|t-score tscore|t-score iTTest|independent-t-test ittest|independent-t-test IndependentTTest TScore|t-score Tscore|t-score tscore|t-score normaldist|normal-distribution tdist|t-distribution poissondist|poisson-distribution binomialdist|binomial-distribution uniformdist|uniform-distribution pdf cdf random inverseCdf inversecdf histogram dotplot boxplot pdf cdf rgb hsv for width height det|determinant inv|inverse transpose rref|reduced-row-echelon-form trace";

const sectionNames = [
  "colors-only",
  "lines",
  "points",
  "fill",
  "label",
  "drag",
] as const;
export function getSections(model: {
  id: string;
}): (typeof sectionNames)[number][] {
  const given = model.id
    .split(" ")
    .filter((word) =>
      (sectionNames as readonly string[]).includes(word)
    ) as (typeof sectionNames)[number][];
  return given.length === 0 ? ["colors-only" as const] : given;
}
