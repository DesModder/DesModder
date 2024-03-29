import { PluginController } from "../PluginController";
import GraphMetadata, {
  Expression as MetadataExpression,
} from "#metadata/interface.ts";
import { getBlankMetadata, changeExprInMetadata } from "#metadata/manage.ts";
import { getMetadata, setMetadata } from "./sync";

export default class ManageMetadata extends PluginController {
  static id = "manage-metadata" as const;
  static enabledByDefault = true;
  static isCore = true;

  graphMetadata: GraphMetadata = getBlankMetadata();

  afterEnable() {
    this.calc.observeEvent("change.dsm-main-controller", () => {
      this.checkForMetadataChange();
    });
    this.checkForMetadataChange();
  }

  beforeDisable() {
    throw new Error(
      "Programming Error: core plugin Manage Metadata should not be disableable"
    );
  }

  checkForMetadataChange() {
    const newMetadata = getMetadata(this.calc);
    if (!this.dsm.glesmos) {
      if (
        Object.entries(newMetadata.expressions).some(
          ([id, e]) =>
            e?.glesmos && !this.graphMetadata.expressions[id]?.glesmos
        )
      ) {
        // list of glesmos expressions changed
        this.cc._showToast({
          message:
            "Enable the GLesmos plugin to improve the performance of some implicits in this graph",
        });
      }
    }
    this.graphMetadata = newMetadata;
    this.dsm.pinExpressions?.applyPinnedStyle();
  }

  _updateExprMetadata(id: string, obj: Partial<MetadataExpression>) {
    changeExprInMetadata(this.graphMetadata, id, obj);
    setMetadata(this.calc, this.graphMetadata);
  }

  duplicateMetadata(toID: string, fromID: string) {
    const model = this.getDsmItemModel(fromID);
    if (model) this._updateExprMetadata(toID, model);
  }

  updateExprMetadata(id: string, obj: Partial<MetadataExpression>) {
    this._updateExprMetadata(id, obj);
    this.finishUpdateMetadata();
  }

  finishUpdateMetadata() {
    this.dsm.pinExpressions?.applyPinnedStyle();
    this.dsm.commitStateChange(false);
  }

  getDsmItemModel(id: string) {
    return this.graphMetadata.expressions[id];
  }

  getDsmItemModels() {
    return Object.entries(this.graphMetadata.expressions).map(([id, v]) => ({
      ...v,
      id,
    }));
  }
}
