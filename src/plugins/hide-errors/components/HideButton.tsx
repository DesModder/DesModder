import HideErrors from "..";
import { jsx } from "#DCGView";
import { If } from "#components";
import { format } from "#i18n";

export function HideButton(hideErrors: HideErrors, getModel: () => any) {
  return (
    <If predicate={() => getModel().type !== "ticker"}>
      {() => (
        <div class="dcg-slider-btn-container dsm-hide-errors">
          <div
            role="button"
            tabindex="0"
            class="dcg-btn-slider dcg-btn-light-gray"
            onTap={(e: Event) => {
              hideErrors.hideError(getModel().id);
              e.stopPropagation();
            }}
          >
            {() => format("hide-errors-hide")}
          </div>
        </div>
      )}
    </If>
  );
}
