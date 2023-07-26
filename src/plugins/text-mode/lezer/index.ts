import TextMode from "..";
import { completions } from "./completions";
import parser from "./syntax.grammar";
import { CompletionContext } from "@codemirror/autocomplete";
import {
  LRLanguage,
  LanguageSupport,
  indentNodeProp,
  foldNodeProp,
  foldInside,
  delimitedIndent,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

export const TextModeLanguage = (tm: TextMode) =>
  LRLanguage.define({
    parser: parser.configure({
      props: [
        indentNodeProp.add({
          Application: delimitedIndent({ closing: ")", align: false }),
        }),
        foldNodeProp.add({
          "StyleMapping Piecewise ListComprehension ListExpression": foldInside,
          "BlockInner ParenthesizedExpression RegressionBody": foldInside,
          CallExpression: (node) => ({
            from: node.getChild("(")?.to ?? node.from,
            to: node.lastChild?.from ?? node.to,
          }),
        }),
        styleTags({
          Identifier: t.variableName,
          String: t.string,
          Number: t.number,
          LineComment: t.lineComment,
          Ellipsis: t.separator,
          "( )": t.paren,
          "[ ]": t.squareBracket,
          "{ }": t.brace,
        }),
      ],
    }),
    languageData: {
      commentTokens: { line: "//" },
      indentOnInput: /^\s*[})\]]$/,
      autocomplete: (context: CompletionContext) => completions(tm, context),
    },
  });

export function textMode(tm: TextMode) {
  return new LanguageSupport(TextModeLanguage(tm));
}
