import { Calc, ItemModel } from "src/globals";
import { Component, jsx } from "src/DCGView";
import { For, IfElse, Switch } from "src/components";
import Outline from ".";

function getSelectedClass(model: ItemModel) {
  return {
    "dsm-outline-outline-selected-item":
      model.id === Calc.controller.getSelectedItem()?.id,
  };
}

export class OutlineIndicator extends Component<{
  model: () => ItemModel;
  o: () => Outline;
}> {
  template() {
    return (
      <div
        class={() => ({
          "dsm-outline-indicator": true,
          "dsm-outline-indicator-error": !!this.props.model().error,
        })}
      ></div>
    );
  }
}

export class OutlineElement extends Component<{
  o: () => Outline;
}> {
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

    const isThickOutline = () =>
      this.props.o().settings.showFoldersInOutline ||
      this.props.o().settings.showNotesInOutline;

    return IfElse(() => validModels().length > 0, {
      true: () => (
        <For each={() => validModels()} key={(m) => m.id}>
          <ul
            class={() => ({
              "dsm-outline-outline": true,
              "dsm-outline-thick-outline": isThickOutline(),
            })}
          >
            {(model: ItemModel) => {
              const elem = (
                <Switch
                  key={() =>
                    (model.type ?? "") +
                    (this.props.o().settings.showFoldersInOutline
                      ? "folders"
                      : "") +
                    (this.props.o().settings.showNotesInOutline
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

                      if (model.id === Calc.controller.getSelectedItem()?.id) {
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
                          {() => model.title ?? ""}
                        </li>
                      );
                    } else if (
                      model.type === "text" &&
                      this.props.o().settings.showNotesInOutline
                    ) {
                      return (
                        <li
                          onClick={() => {
                            this.jumpTo(model.id);
                          }}
                          class={() => getSelectedClass(model)}
                        >
                          <i class="dcg-icon-text"></i> {() => model.text ?? ""}
                        </li>
                      );
                    } else if (model.type === "expression") {
                      const exprModel = model;
                      const colorLatexProperty = () =>
                        exprModel?.formula?.rgb_value ??
                        exprModel?.formula?.color_latex_value;
                      const li = (
                        <li
                          onClick={() => {
                            this.jumpTo(model.id);
                          }}
                          class={() => ({
                            "dsm-outline-outline-default-expression": true,
                            ...getSelectedClass(model),
                            "dsm-outline-color-latex": !!colorLatexProperty(),
                          })}
                          style={() => {
                            const shouldBeColored =
                              (exprModel.formula?.is_graphable &&
                                !exprModel.hidden) ??
                              exprModel?.formula?.rgb_value;

                            return {
                              background: shouldBeColored
                                ? colorLatexProperty()
                                  ? Calc.getColorSwatchGradient?.(
                                      (() => {
                                        if (
                                          Array.isArray(colorLatexProperty())
                                        ) {
                                          return {
                                            type: "color-array",
                                            value:
                                              colorLatexProperty() as string[],
                                          };
                                        } else {
                                          return {
                                            type: "single-color",
                                            value:
                                              colorLatexProperty() as string,
                                          };
                                        }
                                      })()
                                    ).replace(
                                      /[0-9.]+px/g,
                                      (s) =>
                                        `${
                                          (Number(s.slice(0, -2)) *
                                            (isThickOutline() ? 100 : 20)) /
                                          30
                                        }px`
                                    )
                                  : exprModel.color
                                : undefined,
                            };
                          }}
                        >
                          <OutlineIndicator
                            model={() => model}
                            o={this.props.o}
                          ></OutlineIndicator>
                        </li>
                      );

                      return li;
                    }

                    return (
                      <li
                        onClick={() => {
                          this.jumpTo(model.id);
                        }}
                        class={() => ({
                          "dsm-outline-outline-default-expression": true,

                          ...getSelectedClass(model),
                        })}
                      >
                        <OutlineIndicator
                          model={() => model}
                          o={this.props.o}
                        ></OutlineIndicator>
                      </li>
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
    });
  }
}
