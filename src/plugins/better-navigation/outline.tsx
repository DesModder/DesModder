import { Calc, ItemModel } from "src/globals";
import BetterNavigation from ".";
import { Component, jsx } from "src/DCGView";
import { For, IfElse, Switch } from "src/components";

function cutoffWithEllipsis(str: string, cutoff: number) {
  if (str.length > cutoff) {
    return `${str.slice(0, cutoff)}...`;
  }

  return str;
}

function getSelectedClass(model: ItemModel) {
  return {
    "dsm-better-nav-outline-selected-item":
      model.id === Calc.controller.getSelectedItem()?.id,
  };
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

    const isThickOutline = () =>
      this.props.bn().settings.showFoldersInOutline ||
      this.props.bn().settings.showNotesInOutline;

    return IfElse(
      () => this.props.bn().settings.showOutline && validModels().length > 0,
      {
        true: () => (
          <For each={() => validModels()} key={(m) => m.id}>
            <ul
              class={() => ({
                "dsm-better-nav-outline": true,
                "dsm-better-nav-thick-outline": isThickOutline(),
              })}
            >
              {(model: ItemModel) => {
                const elem = (
                  <Switch
                    key={() =>
                      (model.type ?? "") +
                      (this.props.bn().settings.showFoldersInOutline
                        ? "folders"
                        : "") +
                      (this.props.bn().settings.showNotesInOutline
                        ? "notes"
                        : "") +
                      (
                        model.id === Calc.controller.getSelectedItem()?.id
                      ).toString()
                    }
                  >
                    {() => {
                      setTimeout(() => {
                        const domNode = elem._element._element
                          ._domNode as HTMLElement;

                        if (
                          model.id === Calc.controller.getSelectedItem()?.id
                        ) {
                          domNode.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "center",
                          });
                        }
                      });
                      if (model.type === "folder") {
                        return (
                          <li
                            onClick={() => {
                              this.jumpTo(model.id);
                            }}
                            class={() => getSelectedClass(model)}
                          >
                            <i class="dcg-icon-folder"></i>{" "}
                            {() =>
                              this.props.bn().settings.showFoldersInOutline
                                ? cutoffWithEllipsis(
                                    model.title ?? "",
                                    cutoff()
                                  )
                                : ""
                            }
                          </li>
                        );
                      } else if (
                        model.type === "text" &&
                        this.props.bn().settings.showNotesInOutline
                      ) {
                        return (
                          <li
                            onClick={() => {
                              this.jumpTo(model.id);
                            }}
                            class={() => getSelectedClass(model)}
                          >
                            <i class="dcg-icon-text"></i>{" "}
                            {() =>
                              cutoffWithEllipsis(model.text ?? "", cutoff())
                            }
                          </li>
                        );
                      } else if (model.type === "expression") {
                        const exprModel = model;
                        const li = (
                          <li
                            onClick={() => {
                              this.jumpTo(model.id);
                            }}
                            class={() => ({
                              "dsm-better-nav-outline-default-expression": true,
                              "dsm-better-nav-error": !!model.error,
                              ...getSelectedClass(model),
                            })}
                            style={() => {
                              const shouldBeColored =
                                (exprModel.formula?.is_graphable &&
                                  !exprModel.hidden) ??
                                exprModel?.formula?.rgb_value;

                              const colorLatexProperty =
                                exprModel?.formula?.rgb_value ??
                                exprModel?.formula?.color_latex_value;

                              return {
                                width: colorLatexProperty ? "30px" : undefined,
                                transform: colorLatexProperty
                                  ? `scaleX(calc(10/3))`
                                  : undefined,
                                "transform-origin": "left",
                                background: shouldBeColored
                                  ? colorLatexProperty
                                    ? Calc.getColorSwatchGradient(
                                        (() => {
                                          if (
                                            Array.isArray(colorLatexProperty)
                                          ) {
                                            return {
                                              type: "color-array",
                                              value: colorLatexProperty,
                                            };
                                          } else {
                                            return {
                                              type: "single-color",
                                              value: colorLatexProperty,
                                            };
                                          }
                                        })()
                                      )
                                    : exprModel.color
                                  : undefined,
                              };
                            }}
                          ></li>
                        );

                        return li;
                      }

                      return (
                        <li
                          onClick={() => {
                            this.jumpTo(model.id);
                          }}
                          class={() => ({
                            "dsm-better-nav-outline-default-expression": true,

                            ...getSelectedClass(model),
                          })}
                        ></li>
                      );
                    }}
                  </Switch>
                );

                return elem;
              }}
            </ul>
          </For>
        ),
        false: () => <div></div>,
      }
    );
  }
}
