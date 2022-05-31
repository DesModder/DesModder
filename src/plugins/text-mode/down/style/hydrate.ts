import * as TextAST from "../TextAST";
import { Schema } from "./schema";

export interface StyleValue {
  type: "StyleValue";
  props: {
    [key: string]: StyleProp;
  };
}

export type StyleProp = TextAST.Expression | StyleValue | undefined;

export function hydrate<T>(
  styleValue: StyleValue,
  defaults: T,
  schema: Schema,
  itemType: string,
  path = ""
): T {
  const style = styleValue.props;
  for (let key in style) {
    if (!(key in schema)) {
      throw `Key ${key} unexpected on ${itemType}${path}`;
    }
  }
  // now we know style's keys are a subset of schema's keys
  // ensure `res` gets an entry for each of schema's keys
  let res: any = {};
  for (let [key, schemaType] of Object.entries(schema)) {
    const givenValue = style[key];
    const errPath = itemType + path + "." + key;

    if (givenValue === undefined) {
      res[key] = (defaults as any)[key];
    } else if (typeof schemaType === "object" && schemaType.type === "schema") {
      if (givenValue.type !== "StyleValue")
        throw `Expected ${errPath} to be style value, but got primitive`;
      res[key] = hydrate(
        givenValue,
        (defaults as any)[key],
        schemaType.schema,
        itemType,
        path + "." + key
      );
    } else {
      if (givenValue.type === "StyleValue")
        throw `Expected ${errPath} to be primitive, but got style value`;
      if (schemaType === "expr") {
        res[key] = givenValue;
      } else if (schemaType === "color" && givenValue.type === "Identifier") {
        res[key] = givenValue;
      } else {
        const evaluated = evalExpr(givenValue);
        if (typeof schemaType !== "string") {
          if (typeof evaluated !== "string")
            throw `Expected ${errPath} to evaluate to string, but got ${typeof evaluated}`;
          if (!schemaType.enum.includes(evaluated))
            throw (
              `Expected ${errPath} to be one of ` +
              `${JSON.stringify(schemaType.enum)}, but got ` +
              `${JSON.stringify(evaluated)} instead`
            );
        } else if (schemaType === "color") {
          if (typeof evaluated !== "string")
            throw `Expected ${errPath} to evaluate to string, but got ${typeof evaluated}`;
        } else {
          if (typeof evaluated !== schemaType)
            throw `Expected ${errPath} to evaluate to ${schemaType}, but got ${typeof evaluated}`;
        }
        res[key] = evaluated;
      }
    }
  }
  return res as T;
}

function evalExpr(expr: TextAST.Expression): number | string | boolean {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "PrefixExpression":
      return -evalExpr(expr.expr);
    case "Identifier":
      // TODO: create proper builtin map
      // Rudimentary variable inlining
      if (expr.name === "false") return false;
      else if (expr.name === "true") return true;
      else {
        throw `Undefined identifier: ${expr.name}`;
      }
    default:
      // TODO: handle more?
      throw `Unhandled expr type: ${expr.type}`;
  }
}

function isExpr(value: StyleProp): value is TextAST.Expression {
  return typeof value === "object" && value.type !== "StyleValue";
}
