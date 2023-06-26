import { getGraphState } from "./library-search-controller";
import { LibrarySearchView } from "./library-search-view";
import { ExpressionState, GraphState, ItemState } from "@desmodder/graph-state";
import { Component, DCGView, MountedComponent, jsx } from "DCGView";
import { MathQuillField, MathQuillView } from "components";
import { Calc } from "globals/window";
import { PluginController } from "plugins/PluginController";
import { mapAugAST } from "plugins/intellisense/latex-parsing";
import { textModeExprToLatex } from "plugins/intellisense/view";
import { getMetadata } from "plugins/manage-metadata/manage";
import Aug from "plugins/text-mode/aug/AugState";
import { rawNonFolderToAug } from "plugins/text-mode/aug/rawToAug";

export interface ExpressionLibraryExpression {
  aug: Aug.ItemAug;
  latex: string;
  // so importing wackscopes works
  dependsOn: Set<string>;
  uniqueID: number;
  graph: ExpressionLibraryGraph;
  raw: ItemState;
}

export interface ExpressionLibraryGraph {
  // maps expression IDs to expressions
  expressions: Map<string, ExpressionLibraryExpression>;
}

export interface ExpressionsLibraryGraphs {
  graphs: ExpressionLibraryGraph[];
}

type Exhaustive<T, Obj> = keyof Obj extends T ? T[] : never;

type X = Exhaustive<"a" | "b" | "c", { a: 1; b: 2; c: 3 }>;

type LatexKeysOnly<O> = {
  [K in keyof O as Aug.Latex.AnyRoot extends O[K]
    ? K
    : Aug.Latex.AnyChild extends O[K]
    ? K
    : never]: undefined;
};

function allLatexKeys<Obj>() {
  return function <T>(x: readonly T[]): Exhaustive<T, LatexKeysOnly<Obj>> {
    return x as Exhaustive<T, LatexKeysOnly<Obj>>;
  };
}

type Y = LatexKeysOnly<Aug.ExpressionAug>;

function forAllLatexSources(
  item: Aug.ItemAug,
  handler: (ltx: Aug.Latex.AnyRootOrChild) => void
) {
  function runHandler(ltx: string | Aug.Latex.AnyRootOrChild | undefined) {
    if (ltx && typeof ltx === "object") handler(ltx);
  }

  switch (item.type) {
    case "expression":
      for (const key of allLatexKeys<Aug.ExpressionAug>()([
        "latex",
        "color",
        "fillOpacity",
      ] as const)) {
        runHandler(item[key]);
      }
      runHandler(item?.points?.opacity);
      runHandler(item?.points?.size);
      runHandler(item?.lines?.opacity);
      runHandler(item?.lines?.width);
      runHandler(item?.label?.size);
      runHandler(item?.label?.angle);
      runHandler(item?.regression?.residualVariable);
      for (const [k, v] of item.regression?.regressionParameters ?? new Map()) {
        runHandler(k);
      }
      runHandler(item?.cdf?.min);
      runHandler(item?.cdf?.max);
      runHandler(item?.vizProps?.boxplot?.breadth);
      runHandler(item?.vizProps?.boxplot?.axisOffset);

      runHandler(item?.clickableInfo?.latex);
      break;
    case "image":
      for (const key of allLatexKeys<Aug.ImageAug>()([
        "width",
        "height",
        "center",
        "angle",
        "opacity",
      ] as const)) {
        runHandler(item[key]);
      }
      runHandler(item?.clickableInfo?.latex);
      break;
    case "table":
      for (const col of item.columns) {
        for (const key of allLatexKeys<Aug.TableColumnAug>()([
          "color",
          "latex",
        ] as const)) {
          runHandler(col[key]);
        }
        for (const v of col.values) {
          runHandler(v);
        }
      }
  }
}

function getExprWithDependencies(state: Aug.State, expr: Aug.ExpressionAug) {
  if (!expr.latex) return expr;
}

class MyExpressionsLibraryButton extends Component<{
  plugin: () => MyExpressionsLibrary;
}> {
  template() {
    return (
      <div class="dcg-keypad-btn-container">
        <span
          onClick={(e: MouseEvent) => {
            if (e.target instanceof HTMLElement) {
              const rect = e.target?.getBoundingClientRect();
              this.props
                .plugin()
                .openSearch((rect.left + rect.right) / 2, rect.top);
            }
          }}
          class="dcg-keypad-btn dcg-btn-dark-on-gray"
        >
          <span class="dcg-keypad-btn-content">my expressions library</span>
        </span>
      </div>
    );
  }
}

function swap<T>(arr: T[], i: number, j: number) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

// const searchContainer = document.createElement("div");
// document.body.appendChild(searchContainer);

export default class MyExpressionsLibrary extends PluginController<{
  libraryGraphHashes: string; // probably a temporary fix
}> {
  static id = "my-expressions-library";
  static enabledByDefault = true;
  static config = [
    {
      type: "string",
      variant: "text",
      default: "",
      key: "libraryGraphHashes",
    },
  ] as const;

  graphs: ExpressionsLibraryGraphs | undefined;

  keypadRow: HTMLElement | undefined;

  focusedmq: MathQuillField | undefined;

  afterEnable(): void {
    // add pillbox menu
    this.controller.pillboxMenus?.addPillboxButton({
      id: "dsm-library-menu",
      tooltip: "my-expressions-library-pillbox-menu",
      iconClass: "dsm-icon-bookmark",
      popup: () => {
        return (
          <LibrarySearchView
            plugin={() => {
              return this;
            }}
          ></LibrarySearchView>
        );
      },
    });

    // inject library search into functions keypad
    Calc.controller.dispatcher.register((evt) => {
      if (evt.type === "keypad/set-minimized") {
        if (!evt.minimized && !this.keypadRow) {
          const keypad = document.querySelector(".dcg-keys .dcg-basic-keypad");
          this.keypadRow = document.createElement("div");
          this.keypadRow.className = "dcg-keypad-row";
          keypad?.insertBefore(this.keypadRow, keypad.firstElementChild);
          DCGView.mountToNode(MyExpressionsLibraryButton, this.keypadRow, {
            plugin: () => this,
          });
        }
      }

      // const dcgKeysContainer = document.querySelector(".dcg-keys-container");

      // if (dcgKeysContainer?.ariaHidden === "true") {
      //   this.keypadRow?.parentElement?.removeChild(this.keypadRow);
      //   this.keypadRow = undefined;
      //   if (searchContainer.children.length > 0)
      //     DCGView.unmountFromNode(searchContainer);
      //   console.log("got here");
      // }
    });

    void this.loadGraphs();
  }

  searchStr: string = "";

  refineSearch(searchStr: string) {
    this.searchStr = searchStr;
    this.controller.pillboxMenus?.updateExtraComponents();
  }

  view: MountedComponent | undefined;

  updateFocusedMathquill() {
    this.focusedmq = MathQuillView.getFocusedMathquill();
  }

  openSearch(x: number, y: number) {
    this.updateFocusedMathquill();
    // searchContainer.style.position = "absolute";
    // searchContainer.style.left = x.toString() + "px";
    // searchContainer.style.top = y.toString() + "px";
    // searchContainer.style.zIndex = "99";
    // this.view = DCGView.mountToNode(LibrarySearchView, searchContainer, {
    //   plugin: () => this,
    // });
  }

  async loadExpression(expr: ExpressionLibraryExpression) {
    this.focusedmq?.focus();
    const loaded = new Set<ExpressionLibraryExpression>();

    const loadExpressionInner = (expr: ExpressionLibraryExpression) => {
      if (loaded.has(expr)) return;
      loaded.add(expr);

      for (const childexprID of expr.dependsOn) {
        const childExpr = expr.graph.expressions.get(childexprID);
        if (childExpr) loadExpressionInner(childExpr);
      }
    };

    loadExpressionInner(expr);

    let startIndex =
      Calc.controller.listModel.__itemModelArray.findIndex(
        (e) =>
          e.id ===
          (Object.keys(Calc.controller.listModel.selectedItemMap)[0] ?? "0")
      ) + 1;

    const startItem =
      Calc.controller.listModel.__itemModelArray[startIndex - 1];

    const startFolder: string | undefined =
      startItem?.type === "folder" ? startItem?.id : startItem?.folderId;

    const idsBefore = new Set(
      Calc.controller.listModel.__itemModelArray.map((e) => e.id)
    );

    Calc.setExpressions(
      // @ts-expect-error todo: fix type safety later
      Array.from(loaded).map((e) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const copy: Partial<ExpressionState> = {
          ...e.raw,
        } as ExpressionState;
        delete copy.id;
        return copy;
      })
    );

    const idsAfter = Calc.controller.listModel.__itemModelArray.map(
      (e) => e.id
    );

    const idsNew: string[] = [];

    for (const id of idsAfter) {
      if (!idsBefore.has(id)) {
        idsNew.push(id);
      }
    }

    const loadedArray = Array.from(loaded);

    let i = 0;
    for (const id of idsNew) {
      const idIndex = Calc.controller.listModel.__itemModelArray.findIndex(
        (e) => e.id === id
      );
      const itemToMove = Calc.controller.listModel.__itemModelArray[idIndex];

      const expr = loadedArray[i];

      itemToMove.folderId = startFolder ?? "";
      if (expr && expr.raw.type === "expression" && expr.raw.colorLatex) {
        itemToMove.colorLatex = expr.raw.colorLatex;
      }

      Calc.controller.listModel.__itemModelArray.splice(idIndex, 1);

      if (startIndex > idIndex) startIndex--;

      Calc.controller.listModel.__itemModelArray.splice(
        startIndex,
        0,
        itemToMove
      );
      i++;
    }

    Calc.controller.updateTheComputedWorld();

    // setTimeout(() => {
    //   let i = 0;
    //   for (const expr of loaded) {
    //     const myid = idsNew[i];

    //     if (
    //       myid !== undefined &&
    //       expr.raw.type === "expression" &&
    //       expr.raw.colorLatex
    //     ) {
    //       Calc.controller.dispatch({
    //         type: "set-item-colorLatex",
    //         id: myid,
    //         colorLatex: expr.raw.colorLatex,
    //       });
    //     }

    //     i++;
    //   }
    // }, 1000);
  }

  async loadGraphs() {
    const graphs = (
      await Promise.all(
        this.settings.libraryGraphHashes
          .split(",")
          .map(async (s) => await getGraphState(s))
      )
    ).filter((e) => e) as { state: GraphState }[];

    this.graphs = {
      graphs: [],
    };

    let uniqueID = 0;

    for (const g of graphs) {
      // maps ident names to expression ids
      const dependencymap = new Map<string, string>();

      const augs = new Map<string, Aug.NonFolderAug>();

      for (const expr of g.state.expressions.list) {
        if (expr.type !== "folder") {
          augs.set(expr.id, rawNonFolderToAug(expr, getMetadata()));
        }
      }

      for (const [id, aug] of augs) {
        if (aug.type === "expression" && aug.latex) {
          const root = aug.latex;
          if (root.type === "Assignment") {
            dependencymap.set(root.left.symbol, id);
          } else if (root.type === "FunctionDefinition") {
            dependencymap.set(root.symbol.symbol, id);
          }
        }
      }

      const newGraph: Partial<ExpressionLibraryGraph> = {};

      newGraph.expressions = new Map(
        (
          g.state.expressions.list as (ItemState & {
            latex: string | undefined;
          })[]
        )
          .filter((e) => e.latex !== undefined)
          .map((e) => {
            const aug = augs.get(e.id);
            if (!aug) return undefined;

            const dependsOn = new Set<string>();

            forAllLatexSources(aug, (ltx) => {
              mapAugAST(ltx, (node) => {
                if (node && node.type === "Identifier") {
                  const dep = dependencymap.get(node.symbol);
                  if (dep) {
                    dependsOn.add(dep);
                  }
                }
              });
            });

            return [
              e.id,
              {
                aug,
                latex: e.latex,
                dependsOn,
                uniqueID: uniqueID++,
                graph: newGraph,
                raw: e,
              },
            ];
          })
          .filter((e) => e) as [string, ExpressionLibraryExpression][]
      );

      this.graphs.graphs.push(newGraph as ExpressionLibraryGraph);
    }
  }

  getLibraryExpressions() {
    console.log("got here!!!");
    const exprs: ExpressionLibraryExpression[] = [];
    for (const graph of this.graphs?.graphs ?? []) {
      for (const [id, expr] of graph.expressions) {
        if (
          expr.raw.type === "expression" &&
          (expr.raw.latex?.startsWith(
            (() => {
              let ltx = textModeExprToLatex(this.searchStr) ?? "";
              if (ltx[ltx.length - 1] === "}") ltx = ltx?.slice(0, -1);
              return ltx;
            })() ?? ""
          ) ??
            true)
        )
          exprs.push(expr);
      }
    }
    return exprs;
  }

  afterDisable(): void {}
}
