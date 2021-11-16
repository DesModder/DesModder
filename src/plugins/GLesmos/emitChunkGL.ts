import { getFunctionName } from "./builtins";
import { IRChunk, IRInstruction } from "parsing/IR";
import { compileObject, getGLType } from "./outputHelpers";
import { countReferences, opcodes, printOp, Types } from "./opcodeDeps";

function getIdentifier(index: number) {
  return `_${index}`;
}

function maybeInlined(index: number, inlined: string[]) {
  const inlinedString = inlined[index];
  return inlinedString !== undefined ? inlinedString : getIdentifier(index);
}

function getSourceBinOp(
  ci: IRInstruction & { args: [number, number] },
  inlined: string[]
) {
  const a = maybeInlined(ci.args[0], inlined);
  const b = maybeInlined(ci.args[1], inlined);
  switch (ci.type) {
    case opcodes.Add:
      return `${a}+${b}`;
    case opcodes.Subtract:
      return `${a}-${b}`;
    case opcodes.Multiply:
      return `${a}*${b}`;
    case opcodes.Divide:
      return `${a}/${b}`;
    case opcodes.Exponent:
      return `rpow(${a},${b})`;
    case opcodes.RawExponent:
      return `rpow(${a},${b})`;
    case opcodes.Equal:
      return `${a}==${b}`;
    case opcodes.Less:
      return `${a}<${b}`;
    case opcodes.Greater:
      return `${a}>${b}`;
    case opcodes.LessEqual:
      return `${a}<=${b}`;
    case opcodes.GreaterEqual:
      return `${a}>=${b}`;
    case opcodes.And:
      return `${a}&&${b}`;
    case opcodes.OrderedPair:
      return `vec2(${a},${b})`;
    case opcodes.OrderedPairAccess:
      return `${a}[${b}-1]`;
    default:
      const op = printOp(ci.type);
      throw `Programming error: ${op} is not a binary operator`;
  }
}

function getSourceSimple(
  ci: IRInstruction,
  inlined: string[],
  deps: Set<string>
) {
  switch (ci.type) {
    case opcodes.Constant:
      if (Types.isList(ci.valueType)) {
        throw "Lists not yet implemented";
      } else {
        return compileObject(ci.value);
      }
    case opcodes.Add:
    case opcodes.Subtract:
    case opcodes.Multiply:
    case opcodes.Divide:
    case opcodes.Exponent:
      deps.add("pow"); // now fall through
    case opcodes.RawExponent:
    case opcodes.Equal:
    case opcodes.Less:
    case opcodes.Greater:
    case opcodes.LessEqual:
    case opcodes.GreaterEqual:
    case opcodes.And:
    case opcodes.OrderedPair:
    case opcodes.OrderedPairAccess:
      return getSourceBinOp(ci, inlined);
    case opcodes.Negative:
      return "-" + maybeInlined(ci.args[0], inlined);
    case opcodes.Piecewise:
      return (
        maybeInlined(ci.args[0], inlined) +
        "?" +
        maybeInlined(ci.args[1], inlined) +
        ":" +
        maybeInlined(ci.args[2], inlined)
      );
    case opcodes.List:
      throw "Lists not yet implemented";
    case opcodes.DeferredListAccess:
    case opcodes.Distribution:
    case opcodes.SymbolicVar:
    case opcodes.SymbolicListVar:
      const op = printOp(ci.type);
      throw `Programming Error: expect ${op} to be removed before emitting code.`;
    case opcodes.ListAccess:
    // in-bounds list access assumes that args[1] is an integer
    // between 1 and args[1].length, inclusive
    case opcodes.InboundsListAccess:
      throw "Lists not yet implemented";
    case opcodes.NativeFunction:
      deps.add(ci.symbol);
      const name = getFunctionName(ci.symbol);
      const args = ci.args.map((e) => maybeInlined(e, inlined)).join(",");
      return `${name}(${args})`;
    case opcodes.ExtendSeed:
      throw "ExtendSeed not yet implemented";
    default:
      throw `Unexpected opcode: ${printOp(ci.type)}`;
  }
}

function getSourceAndNextIndex(
  chunk: IRChunk,
  currInstruction: IRInstruction,
  instructionIndex: number,
  referenceCountList: number[],
  inlined: string[],
  deps: Set<string>
) {
  const incrementedIndex = instructionIndex + 1;
  switch (currInstruction.type) {
    case opcodes.Noop:
    case opcodes.BlockVar:
    case opcodes.BroadcastResult:
    case opcodes.EndIntegral:
    case opcodes.Action:
      return {
        source: "",
        nextIndex: incrementedIndex,
      };
    case opcodes.BeginIntegral:
      throw "Integrals not currently handled";
    case opcodes.LoadArg:
      inlined[instructionIndex] = chunk.argNames[instructionIndex];
      return {
        source: "",
        nextIndex: incrementedIndex,
      };
    case opcodes.BeginBroadcast:
    case opcodes.EndBroadcast:
      throw "Broadcasts not currently handled";
    case opcodes.BeginLoop:
    case opcodes.EndLoop:
      throw "Loops not currently handled";
    default:
      let src = getSourceSimple(currInstruction, inlined, deps);
      if (referenceCountList[instructionIndex] <= 1) {
        inlined[instructionIndex] = `(${src})`;
        // referenced at most once, so just inline it
        return {
          source: "",
          nextIndex: incrementedIndex,
        };
      } else {
        // referenced more than once, so it helps to reuse this
        const type = getGLType(currInstruction.valueType);
        const id = getIdentifier(instructionIndex);
        return {
          source: `${type} ${id}=${src};\n`,
          nextIndex: incrementedIndex,
        };
      }
  }
}

export default function emitChunkGL(chunk: IRChunk) {
  const referenceCountList = countReferences(chunk);
  let outputSource = "";
  let inlined: string[] = [];
  let deps = new Set<string>();
  for (
    let instructionIndex = 0;
    instructionIndex < chunk.instructionsLength();

  ) {
    const currInstruction = chunk.getInstruction(instructionIndex);
    const u = getSourceAndNextIndex(
      chunk,
      currInstruction,
      instructionIndex,
      referenceCountList,
      inlined,
      deps
    );
    outputSource += u.source;
    instructionIndex = u.nextIndex;
  }
  outputSource += `return ${maybeInlined(chunk.returnIndex, inlined)};`;
  return {
    source: outputSource,
    deps,
  };
}
