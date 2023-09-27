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
            const rootblock = this.props
              .el()
              ?.querySelector(".dcg-main .dcg-mq-root-block");

            if (!rootblock) return "0px";

            if (!rootblock.lastChild || !rootblock.firstChild) return "0px";

            const range = document.createRange();
            range.setStartBefore(rootblock.firstChild);
            range.setEndAfter(rootblock.lastChild);

            const width = range.getBoundingClientRect().width;

            return format("code-golf-width-in-pixels", {
              pixels: Math.round(width).toString(),
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
