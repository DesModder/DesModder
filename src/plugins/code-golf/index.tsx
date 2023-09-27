import { Component, jsx } from "#DCGView";
import { format } from "localization/i18n-core";
import { Inserter, PluginController } from "../PluginController";
import { Config, configList } from "./config";
import "./index.less";
import DSM from "src/MainController";
import { Calc, ExpressionModel } from "src/globals";

async function getGraphFromHash(hash: string) {
  return await fetch("./" + hash, {
    headers: {
      Accept: "application/json",
    },
  }).then(async (data) => {
    return await data.json();
  });
}

async function getGraphHistory() {
  const hash = window.location.pathname.split("/").slice(-1)[0];
  let graph = await getGraphFromHash(hash);
  const graphs = [graph];
  while (graph.parent_hash) {
    graph = await getGraphFromHash(graph.parent_hash);
    graphs.push(graph);
  }
  return graphs;
}

export class CodeGolfMenu extends Component<{
  cg: () => CodeGolf;
  dsm: () => DSM;
}> {
  template() {
    let num = 0;
    const history = getGraphHistory().then(() => {
      Calc.setState(Calc.getState());
      num += 1;
    });
    return <div class="dcg-popover-interior">{() => num}</div>;
  }
}

export class ExpressionItemCostPanel extends Component<{
  model: () => ExpressionModel;
  el: () => HTMLDivElement;
}> {
  rootblock: Element | null | undefined = null;

  template() {
    return (
      <div class="dsm-code-golf-char-count">
        <div>
          {() =>
            format("code-golf-char-count", {
              chars: this.props.model().latex?.length?.toString() ?? "0",
            })
          }
        </div>
        <div>
          {() => {
            const tempRootblock = this.props
              .model()
              .dcgView?._element._domNode?.querySelector(
                ".dcg-main .dcg-mq-root-block"
              );

            console.log("temprootblock", tempRootblock);
            if (tempRootblock) this.rootblock = tempRootblock;

            if (!this.rootblock) return "0px";

            if (!this.rootblock.lastChild || !this.rootblock.firstChild)
              return "0px";

            const range = document.createRange();
            range.setStartBefore(this.rootblock.firstChild);
            range.setEndAfter(this.rootblock.lastChild);

            const width = range.getBoundingClientRect().width;

            return format("code-golf-width-in-pixels", {
              pixels: Math.round(width).toString(),
            });
          }}
        </div>
        <div>
          {() => {
            const el = this.props.model().dcgView?._element._domNode;

            const selected = el?.classList?.contains?.("dcg-selected");

            const tempRootblock = el?.querySelector(
              ".dcg-main .dcg-mq-root-block"
            );
            if (tempRootblock) this.rootblock = tempRootblock;

            function symbolCount2(el: Element) {
              const svgLen = [".dcg-mq-fraction", "svg", ".dcg-mq-token"]
                .map((s) => el.querySelectorAll(s).length)
                .reduce((a, b) => a + b);
              return svgLen + (el.textContent?.length ?? 0);
            }

            return format("code-golf-symbol-count", {
              elements: this.rootblock
                ? symbolCount2(this.rootblock) - (selected ? 1 : 0)
                : 0,
            });
          }}
        </div>
      </div>
    );
  }
}

function MainPopupFunc(cg: CodeGolf, dsm: DSM) {
  return <CodeGolfMenu cg={() => cg} dsm={() => dsm}></CodeGolfMenu>;
}

// $0.querySelector(".dcg-main .dcg-mq-root-block")

export default class CodeGolf extends PluginController<Config> {
  static id = "code-golf" as const;
  static enabledByDefault = false;
  static config = configList;

  expressionItemCostPanel(
    model: ExpressionModel,
    el: HTMLDivElement
  ): Inserter {
    return () => (
      <ExpressionItemCostPanel
        model={() => model}
        el={() => el}
      ></ExpressionItemCostPanel>
    );
  }

  afterConfigChange(): void {}

  afterEnable() {
    // this.dsm.pillboxMenus?.addPillboxButton({
    //   id: "dsm-pi-menu",
    //   tooltip: "code-golf-name",
    //   iconClass: "dsm-icon-text",
    //   popup: () => MainPopupFunc(this, this.dsm),
    // });
  }

  afterDisable() {}
}
