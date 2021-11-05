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

        O = Parsenodes.List
        O.wrap(a).eachElement(function (t, a) {
          // t = IR for element
          // a = index
        })

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
          q.push({graphMode: "GLesmos", compiledGLesmos: ... })
        }

      For finding fillOpacity and color:
      There's an object `O` assigned via `O.color = P` within the if statement of 
        O.wrap(a).eachElement(function (t, a) {
          if (!(a >= j)) {
            // Somewhere in this block
            O.color = P;
          }
        })
      This object `O` provides both `O.fillOpacity` and `O.color`
    */
    if (path.node.value === "=") {
      const ppp = path.parentPath?.parentPath?.parentPath;
      const containingBlock = path.findParent((path) =>
        path.isBlockStatement()
      );
      // Assume that the first argument of this anonymous function is the IR
      const anonymousFunc = path.findParent((path) =>
        path.isFunctionExpression()
      );
      let ir;
      if (
        containingBlock !== null &&
        anonymousFunc !== null &&
        t.isFunctionExpression(anonymousFunc.node) &&
        t.isIdentifier((ir = anonymousFunc.node.params[0])) &&
        ppp &&
        t.isLogicalExpression(ppp.node) &&
        t.isCallExpression(ppp.node.right) &&
        t.isMemberExpression(ppp.node.right.callee)
      ) {
        // find O documented above
        const objO = findO(anonymousFunc.node);

        if (objO)
          // do we need listIndex?
          containingBlock.replaceWith(
            template.statement(`
            if (%%this%%.userData.glesmos) {
              %%push%%({
                graphMode: "GLesmos",
                compiledGL: self.dsm_compileGLesmos(%%ir%%, %%O%%.color, %%O%%.fillOpacity),
                segments: [],
                poi: {}
              })
            } else %%containingBlock%%
          `)({
              this: findIdentifierThis(path),
              push: ppp.node.right.callee,
              containingBlock: containingBlock.node,
              ir: ir,
              O: objO,
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

function findO(anonymousFunc: t.FunctionExpression) {
  const ifStatement = anonymousFunc.body.body[0];
  if (
    t.isIfStatement(ifStatement) &&
    t.isBlockStatement(ifStatement.consequent)
  ) {
    let lhs;
    for (let statement of ifStatement.consequent.body) {
      if (
        t.isExpressionStatement(statement) &&
        t.isAssignmentExpression(statement.expression) &&
        t.isMemberExpression((lhs = statement.expression.left)) &&
        t.isIdentifier(lhs.property, { name: "color" }) &&
        t.isIdentifier(lhs.object)
      ) {
        return lhs.object;
      }
    }
  }
}
