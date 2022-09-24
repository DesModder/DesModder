import { getFunctionName, getBuiltin } from "./builtins";
import { IRChunk, IRInstruction } from "parsing/IR";
import { compileObject, getGLScalarType, getGLType } from "./outputHelpers";
import { countReferences, opcodes, printOp, Types } from "./opcodeDeps";
import { desmosRequire } from "globals/workerSelf";
import { evalMaybeRational, MaybeRational } from "parsing/parsenode";

export const ListLength = desmosRequire(
  "core/math/ir/features/list-length"
) as {
  getConstantListLength(chunk: IRChunk, index: number): number;
};

function getIdentifier(index: number) {
  return `_${index}`;
}

function maybeInlined(index: number, inlined: string[]) {
  const inlinedString = inlined[index];
  return inlinedString !== undefined ? inlinedString : getIdentifier(index);
}

function getSourceBinOp(
  ci: IRInstruction & { args: [number, number] },
  inlined: string[],
  chunk: IRChunk
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
      return `dsm_rpow(${a},${b})`;
    case opcodes.RawExponent:
      return `dsm_rpow(${a},${b})`;
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
        const componentInst = chunk.getInstruction(ci.args[1]);
        if (componentInst.type != opcodes.Constant) {
          throw Error(
            `Programming Error: OrderedPairAccess index must be a constant`
          );
        }
        const componentValue = compileObject(componentInst.value);
        if (componentValue !== "1.0" && componentValue !== "2.0") {
          throw Error(
            `Programming Error: OrderedPairAccess index must be 1.0 or 2.0`
          );
        }
        return componentValue === "1.0" ? `${a}.x` : `${a}.y`;
      }
      return b === "(1.0)" ? `${a}.x` : `${a}.y`;
    default:
      const op = printOp(ci.type);
      throw Error(`Programming error: ${op} is not a binary operator`);
  }
}

function getSourceSimple(
  ci: IRInstruction,
  instructionIndex: number,
  inlined: string[],
  deps: Set<string>,
  lists: string[],
  chunk: IRChunk
) {
  switch (ci.type) {
    case opcodes.Constant:
      if (Types.isList(ci.valueType)) {
        const id = getIdentifier(instructionIndex);
        const val = ci.value as any[];
        const init = val.map(compileObject).join(",");
        const type = getGLScalarType(ci.valueType);
        lists.push(`${type} ${id}[${val.length}] = ${type}[](${init});\n`);
        return id;
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
      return getSourceBinOp(ci, inlined, chunk);
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
      const init = ci.args.map((i) => maybeInlined(i, inlined)).join(",");
      const type = getGLScalarType(ci.valueType);
      return `${type}[${ci.args.length}](${init})`;
    case opcodes.DeferredListAccess:
    case opcodes.Distribution:
    case opcodes.SymbolicVar:
    case opcodes.SymbolicListVar:
      const op = printOp(ci.type);
      throw Error(
        `Programming Error: expect ${op} to be removed before emitting code.`
      );
    case opcodes.ListAccess:
      const length = ListLength.getConstantListLength(chunk, ci.args[0]);
      const list = maybeInlined(ci.args[0], inlined);
      const index = `int(${maybeInlined(ci.args[1], inlined)})`;
      const indexInst = chunk.getInstruction(ci.args[1]);
      if (
        indexInst.type === opcodes.Constant &&
        indexInst.valueType === Types.Number
      ) {
        // Avoid list access like [1,2,3][4], where webGL throws an error during compilation
        const constIndex = evalMaybeRational(indexInst.value as MaybeRational);
        const floorIndex = Math.floor(constIndex);
        if (floorIndex < 1 || floorIndex > length) {
          throw Error(
            `Constant index ${constIndex} out of range on array of length ${length}`
          );
        }
      }
      const nan =
        getGLScalarType(chunk.getInstruction(ci.args[0]).valueType) === "vec2"
          ? "vec2(NaN,NaN)"
          : "NaN";
      return `${index}>=1 && ${index}<=${length} ? ${list}[int(${index})-1] : ${nan}`;
    // in-bounds list access assumes that args[1] is an integer
    // between 1 and args[0].length, inclusive
    case opcodes.InboundsListAccess:
      return (
        maybeInlined(ci.args[0], inlined) +
        "[int(" +
        maybeInlined(ci.args[1], inlined) +
        ")-1]"
      );
    case opcodes.NativeFunction:
      if (getBuiltin(ci.symbol)?.tag === "list") {
        deps.add(
          ci.symbol + "#" + ListLength.getConstantListLength(chunk, ci.args[0])
        );
      } else {
        deps.add(ci.symbol);
      }
      const name = getFunctionName(ci.symbol);
      const args = ci.args.map((e) => maybeInlined(e, inlined)).join(",");
      return `${name}(${args})`;
    case opcodes.ExtendSeed:
      throw Error("ExtendSeed not yet implemented");
    default:
      throw Error(`Unexpected opcode: ${printOp(ci.type)}`);
  }
}

function constFloat(s: string) {
  // return "<num>" if s is the form "(<num>)" for some float <num>; otherwise throws
  const inner = s.substring(1, s.length - 1);
  if (/^[-+]?\d*(\.\d*)?$/.test(inner)) {
    return inner;
  } else {
    throw Error("Sum/product bounds must be constants");
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
    throw Error("Sum/product must have upper bound > lower bound");
  }
  if (its > 10000) {
    // Too many iterations can cause freezing or losing the webgl context
    throw Error("Sum/product cannot have more than 10000 iterations");
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

function getBeginBroadcastSource(
  instructionIndex: number,
  ci: IRInstruction & { type: typeof opcodes.BeginBroadcast },
  chunk: IRChunk
) {
  const endInstruction = chunk.getInstruction(ci.endIndex);
  const varInits = [];
  let broadcastLength = 0;
  if (endInstruction.type === opcodes.EndBroadcast) {
    for (let i = 1; i < endInstruction.args.length; i++) {
      const index = ci.endIndex + i;
      const broadcastRes = chunk.getInstruction(index);
      if (broadcastRes.type === opcodes.BroadcastResult) {
        const len = broadcastRes.constantLength;
        if (typeof len !== "number") {
          throw Error("List with non-constant length not supported");
        }
        broadcastLength = len;
        const type = getGLScalarType(broadcastRes.valueType);
        varInits.push(`${type}[${len}] ${getIdentifier(index)};\n`);
      }
    }
  }
  const broadcastIndexVar = getIdentifier(instructionIndex);
  return (
    varInits.join("") +
    `for(float ${broadcastIndexVar}=1.0;${broadcastIndexVar}<=${broadcastLength}.0;++${broadcastIndexVar}){\n`
  );
}

function getEndBroadcastSource(
  instructionIndex: number,
  ci: IRInstruction & { type: typeof opcodes.EndBroadcast },
  chunk: IRChunk
) {
  const resultAssignments = [];
  const broadcastIndexVar = getIdentifier(ci.args[0]);

  for (let i = 1; i < ci.args.length; i++) {
    const index = instructionIndex + i;
    if (index < chunk.instructionsLength()) {
      if (chunk.getInstruction(index).type === opcodes.BroadcastResult) {
        resultAssignments.push(
          getIdentifier(index) +
            "[int(" +
            broadcastIndexVar +
            ")-1]=" +
            getIdentifier(ci.args[i]) +
            ";\n"
        );
      }
    }
  }
  return resultAssignments.join("") + "}\n";
}

function getSourceAndNextIndex(
  chunk: IRChunk,
  currInstruction: IRInstruction,
  instructionIndex: number,
  referenceCountList: number[],
  inlined: string[],
  deps: Set<string>,
  lists: string[]
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
      throw Error("Integrals not yet implemented");
    case opcodes.LoadArg:
      inlined[instructionIndex] = chunk.argNames[instructionIndex];
      return {
        source: "",
        nextIndex: incrementedIndex,
      };
    case opcodes.BeginBroadcast:
      return {
        source: getBeginBroadcastSource(
          instructionIndex,
          currInstruction,
          chunk
        ),
        nextIndex: incrementedIndex,
      };
    case opcodes.EndBroadcast:
      return {
        source: getEndBroadcastSource(instructionIndex, currInstruction, chunk),
        nextIndex: incrementedIndex,
      };
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
      let src = getSourceSimple(
        currInstruction,
        instructionIndex,
        inlined,
        deps,
        lists,
        chunk
      );
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
          // check id === src to avoid reassignments to self like `float[] _1 = _1`;
          source: id === src ? "" : `${type} ${id}=${src};\n`,
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
  let lists: string[] = [];
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
      deps,
      lists
    );
    outputSource += u.source;
    instructionIndex = u.nextIndex;
  }
  outputSource += `return ${maybeInlined(chunk.returnIndex, inlined)};`;
  return {
    source: lists.join("") + outputSource,
    deps,
  };
}
