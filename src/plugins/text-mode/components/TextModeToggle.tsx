import TextMode from "..";
import { format } from "#i18n";
import { jsx } from "#DCGView";
import { Tooltip } from "#components";
import { Calc } from "#globals";

export function TextModeToggle(textMode: TextMode) {
  return (
    <Tooltip
      tooltip={() => format("text-mode-toggle")}
      gravity={() => (Calc.controller.isNarrow() ? "n" : "s")}
    >
      <span
        class="dcg-icon-btn dsm-text-mode-toggle"
        handleEvent="true"
        role="button"
        tabindex="0"
        onTap={() => textMode.toggleTextMode()}
      >
        <i class="dcg-icon-title" />
      </span>
    </Tooltip>
  );
}
