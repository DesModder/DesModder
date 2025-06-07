import { TextAST } from "../..";
import { Aug } from "../../aug";
import { DownState, childExprToAug } from "../astToAug";
import { ComptimeValue, evalExpr } from "../staticEval";
import { Schema } from "./schema";

export interface StyleValue {
  type: "StyleValue";
  props: Record<string, StyleProp>;
}

export type StyleProp = TextAST.Expression | StyleValue | undefined;

export function hydrate<T>(
  ds: DownState,
  styleMapping: TextAST.StyleMapping | null,
  defaults: T,
  schema: Schema,
  itemType: string,
  path = ""
): T | null {
  const smEntries = styleMapping?.entries ?? [];
  for (const entry of smEntries) {
    if (!(entry.property.value in schema)) {
      ds.pushWarning(
        `Property ${entry.property.value} unexpected on ${itemType}${path}`,
        entry.property.pos
      );
    }
  }
  // now we know style's keys are a subset of schema's keys
  // ensure `res` gets an entry for each of schema's keys
  const res: {
    [Key in keyof T]?: Aug.Latex.AnyChild | ComptimeValue;
  } = {};
  let hasNull = false;
  for (const _key in schema) {
    const key = _key as keyof Schema & keyof T & string;
    const schemaType = schema[key];
    const matchingEntries = smEntries.filter(
      (entry) => entry.property.value === key
    );
    if (matchingEntries.length > 1)
      matchingEntries
        .slice(1)
        .forEach((entry) =>
          ds.pushWarning(
            `Duplicate property ${entry.property.value} on ${itemType}${path}`,
            entry.property.pos
          )
        );
    const chosenEntry: TextAST.MappingEntry | undefined = matchingEntries[0];
    if (chosenEntry?.expr === null)
      throw Error("Null expression in style mapping");
    function pushError(msg: string) {
      ds.pushError(msg, chosenEntry?.expr?.pos);
      hasNull = true;
    }
    const givenValue = matchingEntries[0]?.expr ?? undefined;
    const errPath = itemType + path + "." + key;
    if (typeof schemaType === "object" && schemaType.type === "schema") {
      if (givenValue === undefined) {
        if (schemaType.fillDefaults) {
          res[key] = (defaults as any)[key];
        } else {
          res[key] = undefined;
        }
      } else if (givenValue.type === "StyleMapping") {
        const style = hydrate(
          ds,
          givenValue,
          (defaults as any)[key],
          schemaType.schema,
          itemType,
          path + "." + key
        );
        if (style === null) hasNull = true;
        res[key] = style;
      } else {
        const evaluated = evalExpr(ds.diagnostics, givenValue);
        if (schemaType.orBool && typeof evaluated === "boolean")
          res[key] = evaluated;
        else
          pushError(
            `Expected ${errPath} to be style mapping, but got primitive`
          );
      }
    } else if (givenValue === undefined) {
      res[key] = defaults[key] as any;
    } else {
      if (givenValue.type === "StyleMapping") {
        pushError(`Expected ${errPath} to be primitive, but got style mapping`);
      } else if (schemaType === "expr") {
        res[key] = childExprToAug(givenValue);
      } else if (schemaType === "color") {
        if (givenValue.type === "String") {
          res[key] = givenValue.value;
        } else {
          res[key] = childExprToAug(givenValue);
        }
      } else {
        const evaluated = evalExpr(ds.diagnostics, givenValue);
        if (evaluated === null) {
          hasNull = true;
        } else if (typeof schemaType !== "string") {
          switch (schemaType.type) {
            case "number[]":
              if (
                !Array.isArray(evaluated) ||
                evaluated.some((e) => typeof e !== "number") ||
                evaluated.length !== schemaType.length
              ) {
                const j = JSON.stringify(evaluated);
                pushError(
                  `Expected ${errPath} to evaluate to a list of ${schemaType.length} numbers, but got '${j}'`
                );
              }
              break;
            case "enum":
              if (typeof evaluated !== "string")
                pushError(
                  `Expected ${errPath} to evaluate to a string, but got ${typeof evaluated}`
                );
              else if (!schemaType.enum.includes(evaluated))
                pushError(
                  `Expected ${errPath} to be one of ` +
                    `${JSON.stringify(schemaType.enum)}, but got ` +
                    `${JSON.stringify(evaluated)} instead`
                );
              break;
          }
        } else {
          // eslint-disable-next-line valid-typeof
          if (typeof evaluated !== schemaType)
            pushError(
              `Expected ${errPath} to evaluate to ${schemaType}, but got ${typeof evaluated}`
            );
        }
        if (evaluated !== null) res[key] = evaluated;
      }
    }
  }
  return hasNull ? null : (res as T);
}
