import TextMode from "..";
import { analysisStateField, doLint } from "../LanguageServer";
// Language extension
import { textMode } from "../lezer/index";
import "./editor.less";
import { checkboxPlugin } from "./plugins/checkboxWidget";
import { collapseStylesAtStart } from "./plugins/collapseStylesAtStart";
import { footerPlugin } from "./plugins/footerWidget";
import { activeStmtGutterHighlighter } from "./plugins/highlightActiveStmtGutter";
import { stmtNumbers } from "./plugins/stmtNumbers";
import { styleCircles } from "./plugins/styleCircles";
import { styleMappingPlugin } from "./plugins/styleMappingWidgets";
import {
  closeBrackets,
  autocompletion,
  completionKeymap,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import {
  indentOnInput,
  foldGutter,
  bracketMatching,
  syntaxHighlighting,
  foldKeymap,
  defaultHighlightStyle,
} from "@codemirror/language";
import { linter } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
// Basic editor extensions
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";

const scrollTheme = EditorView.theme({
  "&": {
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

export function startState(tm: TextMode, text: string) {
  const state = EditorState.create({
    doc: text,
    extensions: [
      analysisStateField,
      EditorView.updateListener.of(tm.onEditorUpdate.bind(tm)),
      // linter, showing errors
      linter(doLint, { delay: 0 }),
      // line numbers and gutter
      stmtNumbers(),
      styleCircles(),
      activeStmtGutterHighlighter,
      // undo/redo history
      history(),
      // fold using arrow in the gutter
      foldGutter(),
      // use custom DOM to support multiple selection ranges
      drawSelection(),
      // allow multiple selection ranges
      EditorState.allowMultipleSelections.of(true),
      // draw cursor at drop position when something is dragged
      // TODO: override vanilla image drop to support dropping images as text
      dropCursor(),
      // reindent (dedent) based on languageData.indentOnInput
      // specifically, it reindents after },),]
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      // show matching brackets
      // TODO: add empty content parse node to support proper matching on (())
      //  It may also help with partial expressions
      bracketMatching(),
      // enable automatic close brackets
      closeBrackets(),
      autocompletion(),
      // highlight the active line
      highlightActiveLine(),
      // highlight text that matches the selection
      highlightSelectionMatches(),
      keymap.of([
        // delete both brackets in the pair if the first gets backspaced on
        ...closeBracketsKeymap,
        // standard keybindings
        // includes comment using Ctrl+/.
        ...defaultKeymap,
        // Ctrl+F to search, and more
        ...searchKeymap,
        // Ctrl+Z to undo, etc.
        ...historyKeymap,
        // fold using keybind Ctrl-Shift-[ and similar
        ...foldKeymap,
        // Ctrl+Space to start completion
        ...completionKeymap,
      ]),
      scrollTheme,
      // syntax highlighting
      textMode(tm),
      // Text mode plugins
      checkboxPlugin,
      styleMappingPlugin,
      footerPlugin(),
    ],
  });
  return state.update(collapseStylesAtStart(state)).state;
}

export function initView(tm: TextMode, text: string) {
  return new EditorView({
    state: startState(tm, text),
    parent: document.body,
  });
}
