import PinExpressions from "..";
import { jsx } from "#DCGView";
import { For, If } from "#components";
import { ItemModel } from "#globals";

export interface ListView {
  makeDragCopyViewForModel: (model: ItemModel) => void;
}

export function PinnedPanel(pe: PinExpressions, listView: ListView) {
  return (
    <div
      class="dsm-pinned-expressions dcg-exppanel"
      style={() => ({ background: pe.cc.getBackgroundColor() })}
    >
      <For
        each={() =>
          pe.dsm.textMode?.inTextMode ? [] : (pe.cc?.getAllItemModels?.() ?? [])
        }
        key={(model) => (model as any).guid}
      >
        {(model: () => any) => (
          <If predicate={() => pe?.isExpressionPinned(model().id)}>
            {/** marking as a drag copy causes it not to affect the render shells
             * calculations (all the logic is present already because if the top
             * expression is dragged to the bottom, it shouldn't cause all
             * expressions to render from the top) */}
            {() => listView.makeDragCopyViewForModel(model())}
          </If>
        )}
      </For>
    </div>
  );
}
