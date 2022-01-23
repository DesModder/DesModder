import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "@codemirror/basic-setup";
import Controller from "../Controller";
import "./editor.css";
import getText from "../up/getText";

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
      basicSetup,
      scrollTheme,
      EditorView.updateListener.of(controller.handleUpdate.bind(controller)),
    ],
  });

  return new EditorView({
    state: startState,
    parent: document.body,
  });
}
