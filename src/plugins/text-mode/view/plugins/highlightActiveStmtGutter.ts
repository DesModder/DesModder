import { Statement } from "../../../../../text-mode-core/TextAST";
import { analysisStateField } from "../../LanguageServer";
import { statementsIntersecting } from "../statementIntersection";
import { RangeSet } from "@codemirror/state";
import { GutterMarker, gutterLineClass } from "@codemirror/view";

const activeStmtGutterMarker = new (class extends GutterMarker {
  elementClass = "cm-activeLineGutter";
})();

export const activeStmtGutterHighlighter = gutterLineClass.compute(
  ["selection", analysisStateField],
  (state) => {
    const marks = [];
    for (const range of state.selection.ranges) {
      const int = [
        ...statementsIntersecting(
          state.field(analysisStateField).program,
          range.from,
          state.doc.lineAt(range.to).to
        ),
      ];
      for (const pos of int.flatMap(highlightLineStarts))
        marks.push(state.doc.lineAt(pos).from);
    }
    return RangeSet.of(
      // sort to deal with folder end getting pushed before children
      marks.sort((a, b) => a - b).map((x) => activeStmtGutterMarker.range(x))
    );
  }
);

function highlightLineStarts(stmt: Statement) {
  if (stmt.type === "Folder" || stmt.type === "Table") {
    const children = stmt.type === "Folder" ? stmt.children : stmt.columns;
    if (children.length > 0) return [stmt.pos.from, stmt.pos.to];
  }
  return [stmt.pos.from];
}
