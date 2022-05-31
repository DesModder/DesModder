import * as TextAST from "../TextAST";
import { Schema } from "./schema";
import { error, warning } from "../diagnostics";
import { Diagnostic } from "@codemirror/lint";
import { evalExpr } from "../staticEval";

export interface StyleValue {
  type: "StyleValue";
  props: {
    [key: string]: StyleProp;
  };
  pos?: TextAST.Pos;
}

export type StyleProp = TextAST.Expression | StyleValue | undefined;

export function hydrate<T>(
  styleValue: StyleValue,
  defaults: T,
  schema: Schema,
  itemType: string,
  path = ""
): [Diagnostic[], T | null] {
  const style = styleValue.props;
  const allErrors: Diagnostic[] = [];
  function earlyReturn(msg: string): [Diagnostic[], T | null] {
    return [[...allErrors, error(msg, styleValue.pos)], null];
  }
  for (let key in style) {
    if (!(key in schema)) {
      allErrors.push(
        warning(`Key ${key} unexpected on ${itemType}${path}`, styleValue.pos)
      );
    }
  }
  // now we know style's keys are a subset of schema's keys
  // ensure `res` gets an entry for each of schema's keys
  const res: {
    [Key in keyof T]?: TextAST.Expression | number | string | boolean;
  } = {};
  for (const _key in schema) {
    const key = _key as keyof Schema & keyof T & string;
    const schemaType = schema[key];
    const givenValue: StyleProp = style[key];
    const errPath = itemType + path + "." + key;

    if (typeof schemaType === "object" && schemaType.type === "schema") {
      if (givenValue === undefined) {
        res[key] = undefined;
      } else if (givenValue.type !== "StyleValue") {
        return earlyReturn(
          `Expected ${errPath} to be style value, but got primitive`
        );
      } else {
        const [errors, style] = hydrate(
          givenValue,
          (defaults as any)[key],
          schemaType.schema,
          itemType,
          path + "." + key
        );
        allErrors.push(...errors);
        res[key] = style;
      }
    } else if (givenValue === undefined) {
      res[key] = defaults[key] as any;
    } else {
      if (givenValue.type === "StyleValue")
        return earlyReturn(
          `Expected ${errPath} to be primitive, but got style value`
        );
      if (schemaType === "expr") {
        res[key] = givenValue;
      } else if (schemaType === "color" && givenValue.type === "Identifier") {
        res[key] = givenValue;
      } else {
        const evaluated = evalExpr(givenValue);
        if (typeof schemaType !== "string") {
          if (typeof evaluated !== "string")
            return earlyReturn(
              `Expected ${errPath} to evaluate to string, but got ${typeof evaluated}`
            );
          if (!schemaType.enum.includes(evaluated))
            return earlyReturn(
              `Expected ${errPath} to be one of ` +
                `${JSON.stringify(schemaType.enum)}, but got ` +
                `${JSON.stringify(evaluated)} instead`
            );
        } else if (schemaType === "color") {
          if (typeof evaluated !== "string")
            return earlyReturn(
              `Expected ${errPath} to evaluate to string or identifier, but got ${typeof evaluated}`
            );
        } else {
          if (typeof evaluated !== schemaType)
            return earlyReturn(
              `Expected ${errPath} to evaluate to ${schemaType}, but got ${typeof evaluated}`
            );
        }
        res[key] = evaluated;
      }
    }
  }
  return [allErrors, res as T];
}
