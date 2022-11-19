import Controller from "../Controller";
// Language extension
import { TextMode } from "../lezer/index";
import "./editor.css";
import { checkboxPlugin } from "./plugins/checkboxWidget";
import { styleMappingPlugin } from "./plugins/styleMappingWidgets";
import {
  closeBrackets,
  autocompletion,
  completionKeymap,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  history,
  defaultKeymap,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
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
  lineNumbers,
  highlightActiveLineGutter,
} from "@codemirror/view";

const scrollTheme = EditorView.theme({
  "&": {
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

export function initView(controller: Controller, text: string) {
  const startState = EditorState.create({
    doc: text,
    extensions: [
      EditorView.updateListener.of(controller.onEditorUpdate.bind(controller)),
      // linter, showing errors
      // The linter is also the entry point to evaluation
      linter(controller.doLint.bind(controller), { delay: 250 }),
      // line numbers and gutter
      lineNumbers(),
      highlightActiveLineGutter(),
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
        indentWithTab,
      ]),
      scrollTheme,
      // language support
      TextMode(controller),
      // Text mode plugins
      checkboxPlugin,
      styleMappingPlugin,
    ],
  });

  return new EditorView({
    state: startState,
    parent: document.body,
  });
}
