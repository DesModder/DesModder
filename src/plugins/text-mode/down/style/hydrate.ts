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
}

export type StyleProp = TextAST.Expression | StyleValue | undefined;

export function hydrate<T>(
  styleMapping: TextAST.StyleMapping,
  defaults: T,
  schema: Schema,
  itemType: string,
  path = ""
): [Diagnostic[], T | null] {
  const smEntries = styleMapping?.entries ?? [];
  // const styleValue = evalStyle(styleMapping);
  // const style = styleValue.props;
  const allErrors: Diagnostic[] = [];
  for (const entry of smEntries) {
    if (!(entry.property.value in schema)) {
      allErrors.push(
        warning(
          `Property ${entry.property.value} unexpected on ${itemType}${path}`,
          entry.property.pos
        )
      );
    }
  }
  // now we know style's keys are a subset of schema's keys
  // ensure `res` gets an entry for each of schema's keys
  const res: {
    [Key in keyof T]?: TextAST.Expression | number | string | boolean;
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
          allErrors.push(
            warning(
              `Duplicate property ${entry.property.value} on ${itemType}${path}`,
              entry.property.pos
            )
          )
        );
    const chosenEntry: TextAST.MappingEntry | undefined = matchingEntries[0];
    if (chosenEntry?.expr === null) throw "Null expression in style mapping";
    function pushError(msg: string) {
      allErrors.push(error(msg, chosenEntry?.expr?.pos));
      hasNull = true;
    }
    const givenValue = matchingEntries[0]?.expr ?? undefined;
    const errPath = itemType + path + "." + key;
    if (typeof schemaType === "object" && schemaType.type === "schema") {
      if (givenValue === undefined) {
        res[key] = undefined;
      } else if (givenValue.type !== "StyleMapping") {
        pushError(`Expected ${errPath} to be style mapping, but got primitive`);
      } else {
        const [errors, style] = hydrate(
          givenValue,
          (defaults as any)[key],
          schemaType.schema,
          itemType,
          path + "." + key
        );
        allErrors.push(...errors);
        if (style === null) hasNull = true;
        res[key] = style;
      }
    } else if (givenValue === undefined) {
      res[key] = defaults[key] as any;
    } else {
      if (givenValue.type === "StyleMapping") {
        pushError(`Expected ${errPath} to be primitive, but got style mapping`);
      } else if (schemaType === "expr") {
        res[key] = givenValue;
      } else if (schemaType === "color" && givenValue.type === "Identifier") {
        res[key] = givenValue;
      } else {
        const [errors, evaluated] = evalExpr(givenValue);
        allErrors.push(...errors);
        if (evaluated === null) {
          hasNull = true;
        } else if (typeof schemaType !== "string") {
          // enum type
          if (typeof evaluated !== "string")
            pushError(
              `Expected ${errPath} to evaluate to string, but got ${typeof evaluated}`
            );
          else if (!schemaType.enum.includes(evaluated))
            pushError(
              `Expected ${errPath} to be one of ` +
                `${JSON.stringify(schemaType.enum)}, but got ` +
                `${JSON.stringify(evaluated)} instead`
            );
        } else if (schemaType === "color") {
          if (typeof evaluated !== "string")
            pushError(
              `Expected ${errPath} to evaluate to string or identifier, but got ${typeof evaluated}`
            );
        } else {
          if (typeof evaluated !== schemaType)
            pushError(
              `Expected ${errPath} to evaluate to ${schemaType}, but got ${typeof evaluated}`
            );
        }
        if (evaluated !== null) res[key] = evaluated;
      }
    }
  }
  return [allErrors, hasNull ? null : (res as T)];
}
