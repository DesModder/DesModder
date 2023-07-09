import { ParsenodeError as IParsenodeError } from "../../parsing/parsenode";
import { IRChunk, Opcodes, ValueType, Types as ValueTypes } from "parsing/IR";

export let countReferences: (c: IRChunk) => number[];
export let opcodes: Opcodes;
export let Types: {
  isList: (t: ValueType) => boolean;
} & ValueTypes;
export let getConstantListLength: (
  chunk: IRChunk,
  index: number
) => number | undefined;
export let ParsenodeError: new (msg: string) => IParsenodeError;

const _self = self as any;

// For some reason, this file gets ran in the main frame.
// Rather than fix the root cause, just check if we're in the worker
if (_self.WorkerGlobalScope) {
  const Fragile = _self.Fragile;
  countReferences = Fragile?.countReferences;
  opcodes = Fragile?.Opcodes;
  Types = Fragile?.Types;
  getConstantListLength = Fragile?.getConstantListLength;

  // .ErrorNode is after some TS migration.
  ParsenodeError =
    Fragile?.ParsenodeError ?? Fragile?.ParsenodeError?.ErrorNode;
}
