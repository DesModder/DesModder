/**
 * This is a script that takes the contents of raw.css and generates
 * overrides.less, replacing primary-based colors with var(--variable) and
 * keeping only those rules
 *
 * Usage:
 *   cd src/plugins/set-primary-color/
 *   node clean-css.js > overrides.less
 *   npx prettier --write overrides.less
 */

const fs = require("fs");

let css = fs.readFileSync("raw.css").toString();

const colorMapping = {
  // secondary btn depressed, primary link depressed, show more rows in table, braille
  "#17396e": "var(--dsm-primary-dark-5)", // 0.5
  "23,57,110": "var(--dsm-primary-dark-5-rgb)",
  // primary/secondary btn hovered, export image depressed, label orientation hovered, more
  "#2253a1": "var(--dsm-primary-dark-4)", // 0.725
  "34,83,161": "var(--dsm-primary-dark-4-rgb)",
  // primary/secondary btn depressed, braille, more
  "#2457a8": "var(--dsm-primary-dark-3)", // 0.765
  "36,87,168": "var(--dsm-primary-dark-4-rgb)",
  // primary (not dark bg) btn. Group with the next one
  "#2862bd": "var(--dsm-primary-dark-2)", // 0.855
  "40,98,189": "var(--dsm-primary-dark-2-rgb)",
  // primary btn hovered, primary btn (not dark) depressed, export image, braille, more
  "#2964c2": "var(--dsm-primary-dark-1)", // 0.877
  "41,100,194": "var(--dsm-primary-dark-1-rgb)",
  // pretty much everything (70); blue text and stuff
  "#2f72dc": "var(--dsm-primary-color)", // 1
  "47,114,220": "var(--dsm-primary-color-rgb)",
  // primary btn hovered
  "#347ff5": "var(--dsm-primary-light-1)", // 1.11
  "52,127,245": "var(--dsm-primary-light-1-rgb)",
  // primary btn border (on dark bg); for simplicity make same as light-1
  "#4480e0": "var(--dsm-primary-light-1)", // nonlinear, avg 1.2
  "68,128,224": "var(--dsm-primary-light-1-rgb)",
  // Green from Desmos. Will probably be patched
  "#127a3d": "var(--dsm-primary-color)",
  // share failed
  // "#003761": "",
  // secure header
  // "#1d6fbf": "",
  // Blue/art contest buttons should stay same
  // "#28649b": "",
  // "#296ead": "",
  // "#3379ba": "",
  // "#35608a": "",
  // "#36628c": "",
  // "#3f73a6": "",
  // idk what this is, and I don't want to mess with it
  // "#4781b9": "",
  // Retry loading image
  // "#407bb5": "var(--dsm-primary-light-2)",
};

// Ensure close braces are always followed by newlines
css = css.replace(/}/g, "}\n");
// Remove block comments
css = css.replace(/\/\*([^*]|\*[^/])*\*\//gm, "");
// Remove @media blocks, which never have color changes
css = css.replace(
  /@(media|\S*keyframes)[^{}]*{[^{}]*({[^{}]*}[^{}]*)*[^{}]*}/gm,
  ""
);
// Remove lines with "var" already
// Restrict to lines starting with an even number of spaces
// to avoid mangling stuff
css = css.replace(/^( {2})+.*var.*$/gm, "");
// Replace based on the replacements in the colorMapping
for (const [from, to] of Object.entries(colorMapping)) {
  css = css.replaceAll(from, to);
}
// Remove .dcg-invalid rules, which are primary color then overwritten with red
css = css.replace(/,\n.*\.dcg-invalid/g, "");
// Remove lines without "var"
css = css
  .split("\n")
  .filter((e) => e.includes("var") || !e.includes(";"))
  .join("\n");
// Remove empty blocks
css = css.replace(/(?:[^\n]*,\n)*[^\n]*{\s*}/g, "");
// Remove duplicated newlines
css = css.replace(/\n{2,}/g, "\n");
// Remove leading ".dcg-calculator-api-container "
css = css.replaceAll(".dcg-calculator-api-container ", "");

console.log(
  ".dsm-set-primary-color.dcg-calculator-api-container { " + css + "}"
);
