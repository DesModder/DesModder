import pluginSettings from "./pluginSettings";
import pluginsEnabled from "./pluginsEnabled";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import metadata from "plugins/manage-metadata/state/metadata";

export function mainEditorView(extraExtensions: Extension[]) {
  const state = EditorState.create({
    doc: "",
    extensions: [pluginsEnabled, pluginSettings, metadata, extraExtensions],
  });
  return new EditorView({ state });
}
