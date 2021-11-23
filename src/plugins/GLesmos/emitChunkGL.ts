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
      // Should only be called with a constant (inlined) index arg
      if (b !== "(1.0)" && b !== "(2.0)") {
        throw `Programming error in OrderedPairAccess`;
      }
      return b === "(1.0)" ? `${a}.x` : `${a}.y`;
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
    case opcodes.Exponent:
    case opcodes.RawExponent:
      deps.add("pow"); // now fall through
    case opcodes.Add:
    case opcodes.Subtract:
    case opcodes.Multiply:
    case opcodes.Divide:
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
      throw "Lists not yet implemented";
    // in-bounds list access assumes that args[1] is an integer
    // between 1 and args[0].length, inclusive
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

function constFloat(s: string) {
  // return "<num>" if s is the form "(<num>)" for some float <num>; otherwise throws
  const inner = s.substring(1, s.length - 1);
  if (/^[-+]?\d*(\.\d*)?$/.test(inner)) {
    return inner;
  } else {
    throw "Sum/product bounds must be constants";
  }
}

function getBeginLoopSource(
  instructionIndex: number,
  ci: IRInstruction & { type: typeof opcodes.BeginLoop },
  chunk: IRChunk,
  inlined: string[]
) {
  const iterationVar = getIdentifier(instructionIndex);
  const lowerBound = constFloat(maybeInlined(ci.args[0], inlined));
  const upperBound = constFloat(maybeInlined(ci.args[1], inlined));
  const its = parseFloat(upperBound) - parseFloat(lowerBound) + 1;
  if (its < 1) {
    throw "Sum/product must have upper bound > lower bound";
  }
  if (its > 10000) {
    // Too many iterations can cause freezing or losing the webgl context
    throw "Sum/product cannot have more than 10000 iterations";
  }
  const outputIndex = ci.endIndex + 1;
  const outputIdentifier = getIdentifier(outputIndex);
  // const resultIsUsed =
  //   outputIndex < chunk.instructionsLength() &&
  //   chunk.getInstruction(outputIndex).type === opcodes.BlockVar;
  const initialValue = maybeInlined(ci.args[2], inlined);
  const accumulatorIndex = instructionIndex + 1;
  const accumulatorIdentifier = getIdentifier(accumulatorIndex);
  let s = `float ${accumulatorIdentifier};\n` + `float ${outputIdentifier};\n`;
  // `if(${lowerBound}>${upperBound}){` +
  // (resultIsUsed ? `${outputIdentifier}=${initialValue};` : "") +
  // `}\nelse if(${upperBound}-${lowerBound} > 10000.0){` +
  // (resultIsUsed ? `${outputIdentifier}=NaN;` : "") +
  // `}\nelse{\n`;
  if (chunk.getInstruction(accumulatorIndex).type === opcodes.BlockVar) {
    s += `${accumulatorIdentifier}=${initialValue};`;
  }
  return `${s}\nfor(float ${iterationVar}=${lowerBound};${iterationVar}<=${upperBound};${iterationVar}++){\n`;
}

function getEndLoopSource(
  instructionIndex: number,
  ci: IRInstruction & { type: typeof opcodes.EndLoop },
  chunk: IRChunk,
  inlined: string[]
) {
  var s = "";
  var accumulatorIndex = ci.args[0] + 1;
  if (chunk.getInstruction(accumulatorIndex).type === opcodes.BlockVar) {
    s += `${getIdentifier(accumulatorIndex)}=${maybeInlined(
      ci.args[1],
      inlined
    )};\n`;
  }
  // end the loop
  s += "}\n";
  var outputIndex = instructionIndex + 1;
  if (outputIndex < chunk.instructionsLength()) {
    if (chunk.getInstruction(outputIndex).type === opcodes.BlockVar) {
      s += `${getIdentifier(outputIndex)}=${maybeInlined(
        accumulatorIndex,
        inlined
      )};\n`;
    }
  }
  return s;
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
      throw "Integrals not yet implemented";
    case opcodes.LoadArg:
      inlined[instructionIndex] = chunk.argNames[instructionIndex];
      return {
        source: "",
        nextIndex: incrementedIndex,
      };
    case opcodes.BeginBroadcast:
    case opcodes.EndBroadcast:
      throw "Broadcasts not yet implemented";
    case opcodes.BeginLoop:
      deps.add("round");
      return {
        source: getBeginLoopSource(
          instructionIndex,
          currInstruction,
          chunk,
          inlined
        ),
        nextIndex: incrementedIndex,
      };
    case opcodes.EndLoop:
      return {
        source: getEndLoopSource(
          instructionIndex,
          currInstruction,
          chunk,
          inlined
        ),
        nextIndex: incrementedIndex,
      };
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
