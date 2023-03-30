import TextAST from "../TextAST";
import { DownState } from "../astToAug";
import { evalExpr } from "../staticEval";
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
  // const styleValue = evalStyle(styleMapping);
  // const style = styleValue.props;
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
      } else if (givenValue.type !== "StyleMapping") {
        pushError(`Expected ${errPath} to be style mapping, but got primitive`);
      } else {
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
        const evaluated = evalExpr(ds.diagnostics, givenValue);
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
          // eslint-disable-next-line valid-typeof
          if (typeof evaluated !== schemaType)
            pushError(
              `Expected ${errPath} to evaluate to ${schemaType}, but got ${typeof evaluated}`
            );
        }
        if (
          key === "id" &&
          typeof evaluated === "string" &&
          evaluated.startsWith("__")
        ) {
          // We don't want conflicts with auto-generated IDs
          pushError("ID may not start with '__'");
        }
        if (evaluated !== null) res[key] = evaluated;
      }
    }
  }
  return hasNull ? null : (res as T);
}
