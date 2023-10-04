import {
  Calc,
  ExpressionModel,
  FolderModel,
  ItemModel,
  TextModel,
} from "src/globals";
import BetterNavigation from ".";
import { Component, jsx } from "src/DCGView";
import { For, IfElse, Switch, Tooltip } from "src/components";

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
    const folderId = Calc.controller.getItemModel(id)?.folderId;
    if (folderId) {
      Calc.controller.dispatch({
        type: "set-folder-collapsed",
        id: folderId,
        isCollapsed: false,
      });
    }

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
        if (!Calc.controller.authorFeaturesAvailable()) {
          if (m.secret) return false;
          if (m.folderId && Calc.controller.getItemModel(m.folderId)?.secret)
            return false;
        }
        return true;
      });

    const cutoff = () => this.props.bn().settings.outlineItemCharLimit;

    return IfElse(
      () => this.props.bn().settings.showOutline && validModels().length > 0,
      {
        true: () => (
          <For each={() => validModels()} key={(m) => m.id}>
            <ul class="dsm-better-nav-outline">
              {(model: ItemModel) => {
                return (
                  <Switch key={() => model.type}>
                    {(key: ItemModel["type"]) => {
                      if (key === "folder") {
                        return (
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
                        );
                      } else if (
                        key === "text" &&
                        this.props.bn().settings.showNotesInOutline
                      ) {
                        return (
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
                        );
                      } else if (key === "expression") {
                        const exprModel = model as ExpressionModel;
                        const li = (
                          <li
                            onClick={() => {
                              this.jumpTo(model.id);
                            }}
                            class={() => ({
                              "dsm-better-nav-outline-default-expression": true,
                              "dsm-better-nav-error": !!model.error,
                            })}
                            style={() => ({
                              "background-color":
                                exprModel.formula?.is_graphable &&
                                !exprModel.hidden
                                  ? exprModel.color
                                  : undefined,
                            })}
                          >
                            {/* {IfElse(() => model.error, {
                              true: () => <i class="dcg-icon-error"></i>,
                              false: () => <span></span>,
                            })} */}
                          </li>
                        );

                        return li;
                      }

                      return (
                        <li
                          onClick={() => {
                            this.jumpTo(model.id);
                          }}
                          class="dsm-better-nav-outline-default-expression"
                        ></li>
                      );
                    }}
                  </Switch>
                );
              }}
            </ul>
          </For>
        ),
        false: () => <div></div>,
      }
    );
  }
}
