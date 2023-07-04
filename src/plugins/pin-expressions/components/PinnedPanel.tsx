import PinExpressions from "..";
import { jsx } from "DCGView";
import { For, If } from "components";
import { ItemModel } from "globals/models";
import { Calc } from "globals/window";

export interface ListView {
  makeDragCopyViewForModel: (model: ItemModel) => void;
}

export function PinnedPanel(
  pinExpressions: PinExpressions,
  listView: ListView
) {
  return (
    <For
      each={() =>
        pinExpressions.controller.textMode?.inTextMode
          ? []
          : Calc.controller?.getAllItemModels?.() ?? []
      }
      key={(model) => (model as any).guid}
    >
      <div
        class="dsm-pinned-expressions dcg-exppanel"
        style={() => ({ background: Calc.controller.getBackgroundColor() })}
      >
        {(model: any) => (
          <If predicate={() => pinExpressions?.isExpressionPinned(model.id)}>
            {/** marking as a drag copy causes it not to affect the render shells
             * calculations (all the logic is present already because if the top
             * expression is dragged to the bottom, it shouldn't cause all
             * expressions to render from the top) */}
            {() => listView.makeDragCopyViewForModel(model)}
          </If>
        )}
      </div>
    </For>
  );
}
