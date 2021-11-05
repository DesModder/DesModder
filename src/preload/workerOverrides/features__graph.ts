import * as t from "@babel/types";
import template from "@babel/template";
import { findIdentifierThis } from "preload/overrideHelpers/moduleUtils";

export default () => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    /* @plugin glesmos

    @what Replace quadtree implicit tracing with glesmos compilation

    @how    
      This gets executed once for every element in the list of the statement, 
        e.g. three times for `tan(xy) = [1...3]`
      Reached for the following graphmodes:
        case Graphmode.X:
        case Graphmode.Y:
        case Graphmode.IMPLICIT:
        case Graphmode.POLAR:
        case Graphmode.Z_3D:

      There's this big else clause inside exports.Base.prototype._graph
        else {
            var F = void 0 === y.userData.lines || y.userData.lines
              , S = { ... };
            E = n.default.computeGraphData(S);
            if (v && (E.boundingBox = v), E.fillSegments) {
                E.fillSegments;
                var T = o.__rest(E, ["fillSegments"]);
                F || (T.lineWidth = 0),
                q.push(T)
            } else {
                F || (E.lineWidth = 0),
                q.push(E);
            }
            // this is the only StringLiteral "=", so we use that to determine the right clause
            b.graphMode === l.IMPLICIT && "=" !== b.operator && q.push({
                graphMode: l.POLYGONFILL,
                segments: E.fillSegments,
                poi: {},
                listIndex: b.listIndex,
                color: I,
                fillOpacity: O
            })
        }
      Precede it with:
        else if (y.userData.glesmos) {
          // don't compile glesmos here; reference compiled glesmos from statement analysis
          q.push({graphMode: "GLesmos", compiledGLesmos: "..." })
        }
    */
    if (path.node.value === "=") {
      const ppp = path.parentPath?.parentPath?.parentPath;
      const containingBlock = path.findParent((path) =>
        path.isBlockStatement()
      );
      if (
        containingBlock !== null &&
        ppp &&
        t.isLogicalExpression(ppp.node) &&
        t.isCallExpression(ppp.node.right) &&
        t.isMemberExpression(ppp.node.right.callee)
      ) {
        // do we need listIndex, color, fillOpacity?
        containingBlock.replaceWith(
          template.statement(`
            if (%%this%%.userData.glesmos) {
              %%push%%({
                graphMode: "GLesmos",
                compiledGL: "abcdef",
                segments: [],
                poi: {}
              })
            } else %%containingBlock%%
          `)({
            this: findIdentifierThis(path),
            push: ppp.node.right.callee,
            containingBlock: containingBlock.node,
          })
        );
        path.skip();
        containingBlock.skip();
      }
    }
    /*
    Some more notes

      t.Base.prototype._graph = f() {
    var y = this; // use findIdentifierThis; need this.userData.glesmos

    // throughout, avoid getCompiledFunction (two places) if y.userData.glesmos
   */
  },
});
