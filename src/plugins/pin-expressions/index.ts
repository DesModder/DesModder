import { onEnable, onDisable } from "./backend";

import "./pinExpressions.less";

export default {
  id: "pin-expressions",
  name: "Pin Expressions",
  description: "Pin expressions from Edit List mode",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
  // requiresReload: true // TODO
} as const;
