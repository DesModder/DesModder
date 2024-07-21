import Aug from "text-mode-core/aug/AugState";
import { ItemState } from "../../../graph-state";

/** Represents an easily searchable math expression with dependency tracking */
export interface ExpressionLibraryMathExpression {
  type: "expression";
  aug: Aug.ItemAug;
  latex: string;
  textMode: string;
  // so importing wackscopes works
  dependsOn: Set<string>;
  uniqueID: number;
  graph: ExpressionLibraryGraph;
  raw: ItemState;
}

/** Represents a pre-processed folder */
export interface ExpressionLibraryFolder {
  type: "folder";
  expressions: Set<string>;
  text: string;
  uniqueID: number;
  id: string;
  graph: ExpressionLibraryGraph;
}

export type ExpressionLibraryExpression =
  | ExpressionLibraryMathExpression
  | ExpressionLibraryFolder;

/** Internal representation of a loaded graph */
export interface ExpressionLibraryGraph {
  /** maps expression IDs to expressions */
  expressions: Map<string, ExpressionLibraryExpression>;
  hash: string;
  link: string;
  uniqueID: number;
  type: "graph";
  title?: string;
}
