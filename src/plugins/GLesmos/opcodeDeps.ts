import { desmosRequire } from "globals/workerSelf";
import { IRChunk, Opcodes, ValueType, Types as ValueTypes } from "parsing/IR";

export const countReferences = desmosRequire(
  "core/math/ir/features/count-references"
).countReferences as (c: IRChunk) => number[];
export const opcodes = desmosRequire("core/math/ir/opcodes") as Opcodes;
export const printOp = desmosRequire("core/math/ir/features/print").printOp as (
  k: Opcodes[keyof Opcodes]
) => string;
export const Types = desmosRequire("core/math/types") as {
  isList(t: ValueType): boolean;
} & ValueTypes;
