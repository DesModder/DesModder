import pluginsEnabledExtensions from "./pluginsEnabled";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function mainEditorView(extraExtensions: Extension[]) {
  const state = EditorState.create({
    doc: "",
    extensions: [pluginsEnabledExtensions, extraExtensions],
  });
  return new EditorView({ state });
}
