import { GraphState, ItemState } from "../../../graph-state";
import { MyLibrary } from ".";
import {
  ExpressionLibraryExpression,
  ExpressionLibraryFolder,
  ExpressionLibraryGraph,
} from "./library-statements";
import Aug from "text-mode-core/aug/AugState";
import rawToAug, { parseRootLatex } from "text-mode-core/aug/rawToAug";
import { mapAugAST } from "../intellisense/latex-parsing";
import { Config as TextModeConfig, astToText } from "text-mode-core";
import { rootLatexToAST } from "text-mode-core/up/augToAST";
import { forAllLatexSources } from "./for-all-latex-sources";

interface FetchedGraph {
  state: GraphState;
  hash: string;
  title: string | null;
  link: string;
}

export async function getGraphState(
  link: string,
  ml: MyLibrary
): Promise<FetchedGraph | undefined> {
  try {
    const result = await (
      await fetch(link, {
        headers: { Accept: "application/json" },
      })
    ).json();
    if (result?.title) {
      ml.setNameFromLink(link, result.title ?? "Untitled Graph");
    }
    return { ...result, link };
  } catch {
    return undefined;
  }
}

// convert the data returned from a raw graph fetch request into an ExpressionLibraryGraph
export async function processGraph(
  g: FetchedGraph,
  getUniqueId: () => number,
  config: TextModeConfig
) {
  const newGraph: Partial<ExpressionLibraryGraph> = {};

  // maps ident names to expression ids.
  const dependencymap = new Map<string, string>();

  const augs = new Map<string, Aug.NonFolderAug>();

  const folders = new Map<string, ExpressionLibraryFolder>();

  const aug = rawToAug(config, g.state);

  for (const expr of aug.expressions.list) {
    if (expr.type !== "folder") {
      augs.set(expr.id, expr);
    } else {
      for (const child of expr.children) {
        augs.set(child.id, child);
      }
      folders.set(expr.id, {
        text: expr.title ?? "Untitled Folder",
        expressions: new Set(expr.children.map((a) => a.id)),
        type: "folder",
        uniqueID: getUniqueId(),
        // TODO-ml: are we sure that all entries of the `Partial<>` are filled in?
        graph: newGraph as ExpressionLibraryGraph,
        id: expr.id,
      });
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

  newGraph.expressions = new Map(
    (
      Array.from(folders.entries()) as [string, ExpressionLibraryExpression][]
    ).concat(
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

          let textMode = "";

          try {
            textMode = astToText(
              rootLatexToAST(parseRootLatex(config, e.latex ?? "")),
              {
                noOptionalSpaces: true,
                noNewlines: true,
              }
            );
          } catch {}

          return [
            e.id,
            {
              aug,
              latex: e.latex,
              textMode,
              dependsOn,
              uniqueID: getUniqueId(),
              graph: newGraph,
              raw: e,
              type: "expression",
            },
          ];
        })
        .filter((e) => e) as [string, ExpressionLibraryExpression][]
    )
  );

  for (const [k, v] of folders) {
    newGraph.expressions.set(k, v);
  }

  newGraph.link = g.link;
  newGraph.hash = g.hash;
  newGraph.uniqueID = getUniqueId();
  newGraph.title = g.title ?? "Untitled Graph";
  newGraph.type = "graph";
  // TODO-ml: are we sure that all entries of the `Partial<>` are filled in?
  return newGraph as ExpressionLibraryGraph;
}
