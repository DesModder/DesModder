import { transform } from "@babel/standalone";
import { Visitor } from "@babel/traverse";
import * as t from "@babel/types";

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
                  throw Error(
                    "Expected module definition to consist entirely of identifiers"
                  );
                }
                dependencyNameMap[dependencies[i]] = param;
              }
              path.traverse(visitorFunc(dependencyNameMap));
            },
          },
        }),
      ],
    });
    if (typeof output.code !== "string")
      throw new Error("Babel did not give a string in output");
    // use `Function` instead of `eval` to force treatment as an expression
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    return Function("return " + output.code)();
  };
}

export interface DependencyNameMap {
  [key: string]: t.Identifier;
}

function nameAnonymousFunction(funcString: String, newName: string) {
  return `function ${newName}${funcString.slice(8)}`;
}
