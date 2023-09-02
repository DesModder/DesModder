import TextMode from "..";
import { format } from "#i18n";
import { jsx } from "#DCGView";
import { Tooltip } from "#components";

export function TextModeToggle(tm: TextMode) {
  return (
    <Tooltip
      tooltip={() => format("text-mode-toggle")}
      gravity={() => (tm.calc.controller.isNarrow() ? "n" : "s")}
    >
      <span
        class="dcg-icon-btn dsm-text-mode-toggle"
        handleEvent="true"
        role="button"
        tabindex="0"
        onTap={() => tm.toggleTextMode()}
      >
        <i class="dcg-icon-title" />
      </span>
    </Tooltip>
  );
}
