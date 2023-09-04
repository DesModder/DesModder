import { TextModeEditor } from "..";
import { analysisStateField, doLint, tmEditor } from "../LanguageServer";
// Language extension
import { textMode } from "../lezer/index";
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
import { EditorState, StateEffect, StateField } from "@codemirror/state";
// Basic editor extensions
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
  tooltips,
} from "@codemirror/view";

const theme = EditorView.theme({
  "&": {
    height: "100%",
    // used for cqw unit in footerWidget.less: .dsm-tm-footer-wrapper
    "container-type": "size",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-lineNumbers": {
    // This should only come into play with debug mode. Long IDs like `**dcg_geo_folder**`
    "max-width": "80px",
    "overflow-x": "auto",
  },
});

export const setDebugMode = StateEffect.define<boolean>();

export const debugModeStateField = StateField.define<boolean>({
  create: () => false,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setDebugMode)) {
        value = effect.value;
      }
    }
    return value;
  },
});

export function startState(tm: TextModeEditor, text: string) {
  let state = EditorState.create({
    doc: text,
    extensions: [
      analysisStateField,
      debugModeStateField,
      EditorView.updateListener.of(tm.onEditorUpdate.bind(tm)),
      tooltips({
        // Position absolute (instead of fixed) avoids:
        //  - `container: size` (used for sizing footers) resetting the container origin
        //  - There's also something inside Desmos that is a problem
        // Another option would be to set a parent that's outside these problem containers.
        position: "absolute",
      }),
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
      // Desmos styling needs a class .dcg-calculator-api-container to enclose everything.
      // We additionally add .dsm-text-editor to differentiate from any other .cm-editor.
      EditorView.editorAttributes.of({
        class: "dcg-calculator-api-container dsm-text-editor",
      }),
      theme,
      // syntax highlighting
      textMode(tm),
      // Text mode plugins
      checkboxPlugin,
      styleMappingPlugin,
      footerPlugin(),
      // Expose the tm editor to functions that only have a state.
      tmEditor.of(tm),
    ],
  });
  state = state.update(collapseStylesAtStart(state)).state;
  state = state.update(tm.setDebugModeTransaction()).state;
  return state;
}

export function initView(tm: TextModeEditor, text: string) {
  return new EditorView({
    state: startState(tm, text),
    parent: document.body,
  });
}
