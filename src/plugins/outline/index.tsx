/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { PluginController } from "../PluginController";

import "./index.less";
import { OutlineElement } from "./outline";
import { jsx } from "src/DCGView";

interface OutlineSettings {
  showNotesInOutline: boolean;
  showFoldersInOutline: boolean;
}

export default class Outline extends PluginController<OutlineSettings> {
  static id = "outline" as const;
  static enabledByDefault = false;
  static config = [
    {
      type: "boolean",
      default: false,
      key: "showNotesInOutline",
    },
    {
      type: "boolean",
      default: true,
      key: "showFoldersInOutline",
    },
  ] as const;

  outline() {
    return () => <OutlineElement o={() => this}></OutlineElement>;
  }

  afterConfigChange(): void {}

  dispatcherID: string | undefined;

  customRemoveHandlers: (() => void)[] = [];

  afterEnable() {
    this.afterConfigChange();
  }

  afterDisable() {}
}
