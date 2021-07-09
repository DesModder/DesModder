import { onEnable } from "./backend";

import "./pinExpressions.less";

export default {
  id: "pin-expressions",
  name: "Pin Expressions",
  description: "Pin expressions from Edit List mode",
  onEnable: onEnable,
  enabledByDefault: true,
  enableRequiresReload: true,
} as const;
