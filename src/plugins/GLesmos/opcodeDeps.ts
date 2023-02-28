import { desmosRequire } from "globals/workerSelf";
import { IRChunk, Opcodes, ValueType, Types as ValueTypes } from "parsing/IR";

export let countReferences: (c: IRChunk) => number[];
export let opcodes: Opcodes;
export let Types: {
  isList: (t: ValueType) => boolean;
} & ValueTypes;

// For some reason, this file gets ran in the main frame.
// Rather than fix the root cause, just check if we're in the worker
if ((self as any).WorkerGlobalScope) {
  countReferences = desmosRequire("core/math/ir/features/count-references")
    .countReferences as (c: IRChunk) => number[];
  opcodes = desmosRequire("core/math/ir/opcodes") as Opcodes;
  Types = desmosRequire("core/math/types");
}
