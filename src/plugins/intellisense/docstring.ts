export type DocStringRenderableNoParam =
  | {
      str: string;
      type: "text";
    }
  | {
      latex: string;
      type: "math";
    };

export type DocStringRenderable =
  | {
      type: "param";
      latex: string;
      renderables: DocStringRenderableNoParam[];
    }
  | DocStringRenderableNoParam;

export interface DocStringToken {
  str: string;
  type: "text" | "math" | "param";
}

function lastof<T>(arr: T[]) {
  return arr[arr.length - 1];
}

export function tokenizeDocstring(str: string): DocStringToken[] {
  const tokens: DocStringToken[] = [
    {
      str: "",
      type: "text",
    },
  ];

  let i = 0;

  const match = (rgx: RegExp) => {
    const match = str.slice(i).match(rgx);
    if (match) {
      i += match[0].length - 1;
      return match[0];
    }
    return undefined;
  };

  for (i = 0; i < str.length; i++) {
    const mathStr = match(/^`[^`]+`/g);
    if (mathStr) {
      tokens.push(
        {
          str: mathStr.slice(1, -1),
          type: "math",
        },
        { str: "", type: "text" }
      );
      continue;
    }

    const paramStr = match(/^@param\s*\w+/g);
    if (paramStr) {
      tokens.push(
        {
          str: paramStr.replace(/^@param\s*/g, ""),
          type: "param",
        },
        { str: "", type: "text" }
      );
      continue;
    }

    lastof(tokens).str += str[i];
  }

  return tokens;
}

export function parseDocstring(
  tokens: DocStringToken[]
): DocStringRenderable[] {
  const renderables: DocStringRenderable[] = [];

  function getNoParamRenderable(t: DocStringToken): DocStringRenderableNoParam {
    switch (t.type) {
      case "text":
        return t as { type: "text"; str: string };
      case "math":
        return { type: "math", latex: t.str };
      case "param":
        throw new Error("unreachable");
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t.type) {
      case "text":
      case "math":
        renderables.push(getNoParamRenderable(t));
        break;
      case "param": {
        const paramBody: DocStringRenderableNoParam[] = [];
        while (i < tokens.length - 1) {
          i++;
          const t2 = tokens[i];
          if (t2.type === "param") {
            i--;
            break;
          }
          paramBody.push(getNoParamRenderable(t2));
        }
        renderables.push({
          type: "param",
          latex: t.str,
          renderables: paramBody,
        });
      }
    }
  }

  return renderables;
}
