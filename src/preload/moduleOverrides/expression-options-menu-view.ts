import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import withinFunctionAssignment from "../overrideHelpers/withinFunctionAssignment";
import template from "@babel/template";
import * as t from "@babel/types";

export default (dependencyNameMap: DependencyNameMap) =>
  withinFunctionAssignment("getSections", (func: t.FunctionExpression) => {
    /* @plugin glesmos

    @what hide lines option for GLesmos expressions
    */
    func.body.body.unshift(
      template.statement(`
        if (%%Expression%%.isInequality(this.model) && DesModder.controller.isGlesmosMode(this.model.id)) {
          return ['fill'];
        }
      `)({
        Expression: dependencyNameMap["graphing-calc/models/expression"],
      })
    );
  });
