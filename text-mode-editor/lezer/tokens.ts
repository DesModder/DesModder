import { insertSemi, spaces, newline } from "./syntax.grammar";
import { ContextTracker, ExternalTokenizer } from "@lezer/lr";

/**
 * Semicolon insertion similar to JavaScript.
 *
 * Implementation mostly copied from
 * https://github.com/lezer-parser/javascript/blob/8ef45643798fbd6e58218a4434a43106bb5c36a8/src/tokens.js#L15
 */

// curly brace "}"
const closeBrace = 125;
// at symbol "@"
const at = 64;
// number sign "#"
const hash = 35;
// spaces $[ \t\n]
const whitespaces = [9, 10, 32];

// Track newlines with a boolean flag:
//   has a newline been passed since the last non-spaces token?
export const trackNewline = new ContextTracker<boolean>({
  start: false,
  shift(context, term) {
    return term === spaces ? context : term === newline;
  },
  strict: false,
});

export const insertSemicolon = new ExternalTokenizer(
  (input, stack) => {
    const { next } = input;
    if (
      // next character is "}" or EOF,
      // or we've passed a newline (stack.context === true)
      (next === closeBrace || next === -1 || stack.context) &&
      // don't insert semicolon before space; wait for the next non-space char
      !whitespaces.includes(next) &&
      // don't insert semicolon before @ (style mapping)
      next !== at &&
      // don't insert semicolon before # (regression params)
      next !== hash &&
      stack.canShift(insertSemi)
    )
      input.acceptToken(insertSemi);
  },
  { contextual: true, fallback: true }
);
