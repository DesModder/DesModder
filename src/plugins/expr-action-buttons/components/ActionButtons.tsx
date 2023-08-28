import ExprActionButtons, { ActionButton } from "..";
import "./ActionButtons.less";
import { jsx } from "#DCGView";
import { For, If, Tooltip } from "#components";
import { ItemModel } from "#globals";
import { format } from "#i18n";

export function ActionButtons(eab: ExprActionButtons, m: ItemModel) {
  return (
    <For each={() => eab.order()} key={(b) => b.key}>
      <div class="dsm-action-buttons">
        {(b: ActionButton) => (
          <If predicate={() => b.predicate(m)}>
            {() => ActionButtonView(b, m)}
          </If>
        )}
      </div>
    </For>
  );
}

function ActionButtonView(b: ActionButton, m: ItemModel) {
  return (
    <Tooltip tooltip={format(b.tooltip)} gravity="s">
      <span
        class={b.buttonClass + " dsm-stay-edit-list-mode dcg-exp-action-button"}
        handleEvent="true"
        role="button"
        tabindex="0"
        onTap={() => b.onTap(m)}
      >
        <i class={b.iconClass + " dsm-stay-edit-list-mode"}></i>
      </span>
    </Tooltip>
  );
}
