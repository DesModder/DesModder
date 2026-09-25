/**
 * The Greek letters Desmos's MathQuill does not auto-command.
 *
 * Desmos turns typed `alpha`, `beta`, `theta`, `pi`, `phi`, `rho` and `tau`
 * into their letters and leaves the rest as plain text. The Custom MathQuill
 * Config plugin adds these to the auto-commands when "extended Greek" is on;
 * Physics Lab adds them to the names its LaTeX writer knows, so a variable
 * called γ is written `\gamma` rather than `\operatorname{gamma}` whether or
 * not that plugin is enabled. One list, here, rather than a copy in each.
 */
export const EXTENDED_GREEK = [
  "gamma",
  "Gamma",
  "delta",
  "Delta",
  "epsilon",
  "zeta",
  "eta",
  "Theta",
  "iota",
  "kappa",
  "lambda",
  "Lambda",
  "mu",
  "Xi",
  "xi",
  "Pi",
  "sigma",
  "Sigma",
  "upsilon",
  "Upsilon",
  "Phi",
  "chi",
  "psi",
  "Psi",
  "omega",
  "Omega",
] as const;
