import { PluginController } from "../../plugins/PluginController";
import GraphMetadata, {
  Expression as MetadataExpression,
} from "#metadata/interface.ts";
import { getBlankMetadata, changeExprInMetadata } from "#metadata/manage.ts";
import {
  deleteJunkMetadataNotes,
  getMetadataFromListModel,
  setMetadataInListModel,
  transferMetadata,
} from "./sync";
import { AllActions, DispatchedEvent } from "../../globals/extra-actions";
import { ItemState } from "graph-state/state";
import { format } from "#i18n";

declare module "src/globals/extra-actions" {
  interface AllActions {
    "manage-metadata": {
      type: "dsm-manage-metadata-update-for-expr";
      id: string;
      obj: Partial<MetadataExpression>;
    };
  }
}

/**
 * There is no field that we can trust to contain arbitrary values upon
 * which to store metadata, so we store the metadata on a note, so
 * it serializes nicely to JSON.
 *
 * The `dsm-metadata` note in the current `listModel` is the source of truth.
 * Events which affect metadata directly change the string JSON in the note,
 * and in the `graphMetadata` model. If the note changes without the
 * `graphMetadata` model, then `afterUpdateTheComputedWorld` corrects the
 * `graphMetadata` model by filling in the parsed JSON.
 *
 * The only reason besides performance we keep `graphMetadata` as a property
 * is to make it easy to show a toast when new expressions are GLesmos but
 * GLesmos is disabled.
 */
export default class ManageMetadata extends PluginController {
  static id = "manage-metadata" as const;
  static enabledByDefault = true;
  static isCore = true;

  graphMetadata: GraphMetadata = getBlankMetadata();
  recentlyOpenedGLesmos = false;

  beforeDisable() {
    throw new Error(
      "Programming Error: core plugin Manage Metadata should not be disableable"
    );
  }

  private syncFromMetadataNote() {
    const newMetadata = getMetadataFromListModel(this.calc);
    // We could be in the middle of init, so we can't just do `!this.dsm.glesmos`.
    if (!this.dsm.isPluginEnabled("GLesmos")) {
      if (
        Object.entries(newMetadata.expressions).some(
          ([id, e]) =>
            e?.glesmos && !this.graphMetadata.expressions[id]?.glesmos
        )
      ) {
        // list of glesmos expressions changed
        this.showGlesmosNotEnabledToast();
        // Navigating graphs in the shell creates the toast 'Opened "Graph Name"'
        // which is dispatched as a separate event after the event that
        // triggers this code path. So we replace that toast with the
        //  "GLesmos-not-enabled" toast.
        this.recentlyOpenedGLesmos = true;
        setTimeout(() => {
          this.recentlyOpenedGLesmos = false;
        }, 0);
      }
    }
    this.graphMetadata = newMetadata;

    // This should really be in updateViews(), but not critical.
    this.dsm.pinExpressions?.applyPinnedStyle();
  }

  private _updateExprMetadata(id: string, obj: Partial<MetadataExpression>) {
    changeExprInMetadata(this.graphMetadata, id, obj);
    setMetadataInListModel(this.calc, this.graphMetadata);
  }

  private showGlesmosNotEnabledToast() {
    this.cc._showToast({
      // eslint-disable-next-line @desmodder/eslint-rules/no-format-in-ts
      message: format("GLesmos-not-enabled"),
    });
  }

  /** Called from inside a couple dispatched functions. */
  duplicateMetadata(toID: string, fromID: string) {
    const model = this.getDsmItemModel(fromID);
    if (model) this._updateExprMetadata(toID, model);
  }

  handleDispatchedAction(action: DispatchedEvent) {
    switch (action.type) {
      case "dsm-manage-metadata-update-for-expr":
        this._updateExprMetadata(action.id, action.obj);
        this.dsm.pinExpressions?.applyPinnedStyle();
        break;
      case "toast/show":
        if (this.recentlyOpenedGLesmos) {
          this.showGlesmosNotEnabledToast();
          return "abort-later-handlers";
        }
        break;
      default:
        action satisfies Exclude<
          DispatchedEvent,
          AllActions["manage-metadata"]
        >;
    }
    return undefined;
  }

  beforeUpdateTheComputedWorld() {
    deleteJunkMetadataNotes(this.calc);
  }

  afterUpdateTheComputedWorld() {
    this.syncFromMetadataNote();
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

  transferMetadata(
    currentList: ItemState[],
    newList: ItemState[],
    oldIdToNewId: Map<string, string>
  ) {
    transferMetadata(currentList, newList, oldIdToNewId);
  }
}
