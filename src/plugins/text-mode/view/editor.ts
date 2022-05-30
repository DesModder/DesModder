import { EditorState } from "@codemirror/state";
import Controller from "../Controller";
import "./editor.css";
import getText from "../up/getText";
// Basic editor extensions
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { history, historyKeymap } from "@codemirror/history";
import { foldGutter, foldKeymap } from "@codemirror/fold";
import { indentOnInput } from "@codemirror/language";
import { lineNumbers, highlightActiveLineGutter } from "@codemirror/gutter";
import { defaultKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/matchbrackets";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/closebrackets";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { commentKeymap } from "@codemirror/comment";
import { defaultHighlightStyle } from "@codemirror/highlight";
// Language extension
import { TextMode } from "../lezer/index";

const scrollTheme = EditorView.theme({
  "&": {
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

export function initView(controller: Controller) {
  let startState = EditorState.create({
    doc: getText(),
    extensions: [
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
      defaultHighlightStyle.fallback,
      // show matching brackets
      // TODO: add empty content parse node to support proper matching on (())
      //  It may also help with partial expressions
      bracketMatching(),
      // enable automatic close brackets
      closeBrackets(),
      // TODO: autocompletion setup
      autocompletion(),
      // highlight the active line
      highlightActiveLine(),
      // highlight text that matches the selection
      highlightSelectionMatches(),
      keymap.of([
        // delete both brackets in the pair if the first gets backspaced on
        ...closeBracketsKeymap,
        // standard keybindings
        ...defaultKeymap,
        // Ctrl+F to search, and more
        ...searchKeymap,
        // Ctrl+Z to undo, etc.
        ...historyKeymap,
        // fold using keybind Ctrl-Shift-[ and similar
        ...foldKeymap,
        // comment using Ctrl+/.
        // TODO: avoid collision with keybinding list from vanilla Desmos
        ...commentKeymap,
        // Ctrl+Space to start completion
        // TODO: autocompletion setup
        ...completionKeymap,
      ]),
      scrollTheme,
      EditorView.updateListener.of(controller.handleUpdate.bind(controller)),
      // language support
      TextMode(),
    ],
  });

  return new EditorView({
    state: startState,
    parent: document.body,
  });
}
