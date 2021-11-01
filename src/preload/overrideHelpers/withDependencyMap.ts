import { transform } from "@babel/standalone";
import * as t from "@babel/types";
import { Visitor } from "@babel/traverse";

export default function withDependencyMap(
  visitorFunc: (dependencyNameMap: DependencyNameMap) => Visitor
) {
  return (definition: Function, dependencies: string[]) => {
    const code = nameAnonymousFunction(
      definition.toString(),
      "__rootLevelDefinition"
    );
    const output = transform(code, {
      compact: true,
      plugins: [
        () => ({
          visitor: {
            FunctionDeclaration(path: babel.NodePath<t.FunctionDeclaration>) {
              if (path.node.id?.name !== "__rootLevelDefinition") return;
              const dependencyNameMap: DependencyNameMap = {};
              for (let i = 0; i < path.node.params.length; i++) {
                const param = path.node.params[i];
                if (!t.isIdentifier(param)) {
                  throw "Expected module definition to consist entirely of identifiers";
                }
                dependencyNameMap[dependencies[i]] = param;
              }
              path.traverse(visitorFunc(dependencyNameMap));
            },
          },
        }),
      ],
    });
    // use `Function` instead of `eval` to force treatment as an expression
    return Function("return " + output.code)();
  };
}

export interface DependencyNameMap {
  [key: string]: t.Identifier;
}

function nameAnonymousFunction(funcString: String, newName: string) {
  return `function ${newName}${funcString.slice(8)}`;
}
