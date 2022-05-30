import { parser } from "./syntax.grammar";
import {
  LRLanguage,
  LanguageSupport,
  indentNodeProp,
  foldNodeProp,
  foldInside,
  delimitedIndent,
} from "@codemirror/language";
import { styleTags, tags as t } from "@codemirror/highlight";
import { completions } from "./completions";

export const TextModeLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Application: delimitedIndent({ closing: ")", align: false }),
      }),
      foldNodeProp.add({
        "Mapping Piecewise ListComprehension ListExpression": foldInside,
        BlockInner: foldInside,
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
    autocomplete: completions,
  },
});

export function TextMode() {
  return new LanguageSupport(TextModeLanguage);
}
