import MainController from "../MainController";
import { EditorView, ViewUpdate } from "@codemirror/view";

export class CMPlugin {
  constructor(public view: EditorView, public dsm: MainController) {}

  update(_update: ViewUpdate) {}
  destroy() {}
}
