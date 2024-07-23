import { PluginController } from "../../plugins/PluginController";
import GraphMetadata, {
  Expression as MetadataExpression,
} from "#metadata/interface.ts";
import { getBlankMetadata, changeExprInMetadata } from "#metadata/manage.ts";
import { getMetadata, setMetadata } from "./sync";
import { AllActions, DispatchedEvent } from "../../globals/extra-actions";

declare module "src/globals/extra-actions" {
  interface AllActions {
    "manage-metadata": {
      type: "dsm-manage-metadata-update-for-expr";
      id: string;
      obj: Partial<MetadataExpression>;
    };
  }
}

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
    this.dsm.handleDispatches!.registerDispatchHandler(
      ManageMetadata.id,
      this.manageMetadataDispatchHandler.bind(this)
    );
  }

  beforeDisable() {
    throw new Error(
      "Programming Error: core plugin Manage Metadata should not be disableable"
    );
  }

  checkForMetadataChange() {
    if (!this.dsm.initDone) {
      return;
    }
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

  private _updateExprMetadata(id: string, obj: Partial<MetadataExpression>) {
    changeExprInMetadata(this.graphMetadata, id, obj);
    setMetadata(this.calc, this.graphMetadata);
  }

  /** Called from inside a couple dispatched functions. */
  duplicateMetadata(toID: string, fromID: string) {
    const model = this.getDsmItemModel(fromID);
    if (model) this._updateExprMetadata(toID, model);
  }

  manageMetadataDispatchHandler(action: DispatchedEvent) {
    switch (action.type) {
      case "dsm-manage-metadata-update-for-expr":
        this._updateExprMetadata(action.id, action.obj);
        this.dsm.pinExpressions?.applyPinnedStyle();
        break;
      default:
        action satisfies Exclude<
          DispatchedEvent,
          AllActions["manage-metadata"]
        >;
    }
    return undefined;
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
