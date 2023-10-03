import { Calc, FolderModel, TextModel } from "src/globals";
import BetterNavigation from ".";
import { Component, jsx } from "src/DCGView";
import { For, IfElse } from "src/components";

function cutoffWithEllipsis(str: string, cutoff: number) {
  if (str.length > cutoff) {
    return `${str.slice(0, cutoff)}...`;
  }

  return str;
}

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

    const validModels = () =>
      Calc.controller.getAllItemModels().filter((m) => {
        return (
          m.type === "folder" ||
          (m.type === "text" && this.props.bn().settings.showNotesInOutline)
        );
      });

    const cutoff = () => this.props.bn().settings.outlineItemCharLimit;

    return IfElse(
      () => this.props.bn().settings.showOutline && validModels().length > 0,
      {
        true: () => (
          <For each={() => validModels()} key={(m) => m.id}>
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
                      {() =>
                        cutoffWithEllipsis(
                          (model as FolderModel).title ?? "",
                          cutoff()
                        )
                      }
                    </li>
                  ),
                  false: () => (
                    <li
                      onClick={() => {
                        this.jumpTo(model.id);
                      }}
                    >
                      <i class="dcg-icon-text"></i>{" "}
                      {() =>
                        cutoffWithEllipsis(
                          (model as TextModel).text ?? "",
                          cutoff()
                        )
                      }
                    </li>
                  ),
                });
              }}
            </ul>
          </For>
        ),
        false: () => <div></div>,
      }
    );
  }
}
