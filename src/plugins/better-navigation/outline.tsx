import { Calc, FolderModel, TextModel } from "src/globals";
import BetterNavigation from ".";
import { Component, jsx } from "src/DCGView";
import { For, IfElse } from "src/components";

export class Outline extends Component<{
  bn: () => BetterNavigation;
}> {
  rootblock: Element | null | undefined = null;

  dispatcher!: string;

  willUnmount() {
    Calc.controller.dispatcher.unregister(this.dispatcher);
  }

  jumpTo(id: string) {
    Calc.controller.dispatch({
      type: "set-selected-id",
      id,
    });
    Calc.controller.dispatch({
      type: "set-focus-location",
      location: {
        type: "expression",
        id,
      },
    });
  }

  template() {
    this.dispatcher = Calc.controller.dispatcher.register(() => {
      this.update();
    });

    return IfElse(() => this.props.bn().settings.showOutline, {
      true: () => (
        <For
          each={() =>
            Calc.controller.getAllItemModels().filter((m) => {
              return (
                m.type === "folder" ||
                (m.type === "text" &&
                  this.props.bn().settings.showNotesInOutline)
              );
            })
          }
          key={(m) => m.id}
        >
          <ul class="dsm-better-nav-outline">
            {(model: FolderModel | TextModel) => {
              return IfElse(() => model.type === "folder", {
                true: () => (
                  <li
                    onClick={() => {
                      this.jumpTo(model.id);
                    }}
                  >
                    <i class="dcg-icon-folder"></i>{" "}
                    {() => (model as FolderModel).title ?? ""}
                  </li>
                ),
                false: () => (
                  <li
                    onClick={() => {
                      this.jumpTo(model.id);
                    }}
                  >
                    <i class="dcg-icon-text"></i>{" "}
                    {() => (model as TextModel).text ?? ""}
                  </li>
                ),
              });
            }}
          </ul>
        </For>
      ),
      false: () => <div></div>,
    });
  }
}
