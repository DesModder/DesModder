import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { onStateChange } from "../../state/utils";
import { CMPlugin } from "../CMPlugin";
import GraphMetadata, { Expression as MetadataExpression } from "./interface";
import { setMetadata } from "./manage";
import {
  checkForMetadataChange,
  duplicateMetadata,
  metadata,
  updateExprMetadata,
} from "./state/metadata";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { Calc } from "globals/window";

export default class ManageMetadata extends CMPlugin {
  static id = "manage-metadata" as const;
  static enabledByDefault = true;

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    Calc.observeEvent("change.dsm-main-controller", () => {
      this.checkForMetadataChange();
    });
    setTimeout(() => this.checkForMetadataChange());
  }

  destroy() {
    throw new Error(
      "Programming Error: core plugin Manage Metadata should not be disableable"
    );
  }

  checkForMetadataChange() {
    this.view.dispatch({ effects: [checkForMetadataChange.of(null)] });
  }

  duplicateMetadata(toID: string, fromID: string) {
    this.view.dispatch({
      effects: [duplicateMetadata.of({ fromID, toID })],
    });
  }

  updateExprMetadata(id: string, obj: Partial<MetadataExpression>) {
    this.view.dispatch({ effects: [updateExprMetadata.of({ id, obj })] });
  }

  getMetadata() {
    return this.view.state.field(metadata);
  }

  getDsmItemModel(id: string) {
    return getDsmItemModel(this.getMetadata(), id);
  }

  getDsmItemModels() {
    return getDsmItemModels(this.getMetadata());
  }
}

export function getDsmItemModel(metadata: GraphMetadata, id: string) {
  return metadata.expressions[id];
}

export function getDsmItemModels(metadata: GraphMetadata) {
  return Object.entries(metadata.expressions).map(([id, v]) => ({
    ...v,
    id,
  }));
}

export function manageMetadata(
  dsm: MainController
): CMPluginSpec<ManageMetadata> {
  return {
    id: ManageMetadata.id,
    category: "core-core",
    config: [],
    plugin: ViewPlugin.define((view) => new ManageMetadata(view, dsm), {
      provide: () => [
        onStateChange(metadata, (metadata) => {
          dsm.pinExpressions?.applyPinnedStyle(metadata);
          setMetadata(metadata);
          dsm.commitStateChange(false);
        }),
      ],
    }),
    extensions: [],
  };
}
