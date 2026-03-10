import { Inserter, PluginController, Replacer } from "../PluginController";
import { ErrorTriangle } from "./components/ErrorTriangle";
import { HideButton } from "./components/HideButton";
import "./hide-errors.less";

export default class HideErrors extends PluginController {
  static id = "hide-errors" as const;
  static enabledByDefault = true;

  hideError(id: string) {
    this.cc.dispatch({
      type: "dsm-manage-metadata-update-for-expr",
      id,
      obj: { errorHidden: true },
    });
  }

  toggleErrorHidden(id: string) {
    this.cc.dispatch({
      type: "dsm-manage-metadata-update-for-expr",
      id,
      obj: { errorHidden: !this.isErrorHidden(id) },
    });
  }

  isErrorHidden(id: string) {
    return this.dsm.metadata?.getDsmItemModel(id)?.errorHidden;
  }

  hideButton(getModel: () => any): Inserter {
    return () => HideButton(this, getModel);
  }

  /** This is called on all error triangles, but a string ID is only passed for exprs. */
  errorTriangle(id: string | undefined): Replacer {
    if (id === undefined) return undefined;
    return (inner: any) => ErrorTriangle(this, id, inner);
  }
}
