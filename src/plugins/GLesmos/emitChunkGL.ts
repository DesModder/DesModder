import { getFunctionName, getBuiltin } from "./builtins";
import {
  compileObject,
  getConstantListLengthRequired,
  getGLScalarType,
  getGLTypeOfLength,
} from "./outputHelpers";
import {
  countReferences,
  getConstantListLength,
  opcodes,
  Types,
} from "./workerDeps";
import {
  BeginBroadcast,
  BeginLoop,
  EndBroadcast,
  EndLoop,
  IRChunk,
  IRInstruction,
  NativeFunction,
} from "parsing/IR";
import { evalMaybeRational, MaybeRational } from "parsing/parsenode";

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
    case opcodes.OrderedPairAccess: {
      // Should only be called with a constant (inlined) index arg
      if (b !== "(1.0)" && b !== "(2.0)") {
        const componentInst = chunk.getInstruction(ci.args[1]);
        if (componentInst.type !== opcodes.Constant) {
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
    }
    default: {
      throw Error(`Programming error: op ${ci.type} is not a binary operator`);
    }
  }
}

function getSourceSimple(
  ci: IRInstruction,
  instructionIndex: number,
  inlined: string[],
  deps: Set<string>,
  chunk: IRChunk
) {
  switch (ci.type) {
    case opcodes.Constant:
      if (Types.isList(ci.valueType)) {
        // initialized in getTypedefsSource
        return getIdentifier(instructionIndex);
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
    case opcodes.Piecewise: {
      const condition = maybeInlined(ci.args[0], inlined);
      const branchIndices = [ci.args[1], ci.args[2]];
      const branches = branchIndices.map((i) => chunk.getInstruction(i));
      const isList = branches.map((b) => Types.isList(b.valueType));
      const args = branchIndices.map((i) => maybeInlined(i, inlined));
      if (isList[0] !== isList[1]) {
        // Desmos should eliminate this case (by expanding the scalar to the
        // length of the list) before reaching here, so this is just in case
        throw new Error(
          "Cannot mix list and scalar value in piecewise expression."
        );
      }
      if (isList[0]) {
        const lengths = branchIndices.map((i) =>
          getConstantListLengthRequired(chunk, i)
        );
        if (lengths[0] !== lengths[1])
          throw new Error(
            "Cannot mix lists of different lengths in piecewise expression."
          );
        deps.add("ternary#" + getGLTypeOfLength(ci.valueType, lengths[0]));
        return `dsm_ternary(${condition},${args.join(",")})`;
      } else {
        return condition + "?" + args.join(":");
      }
    }
    case opcodes.List: {
      const init = ci.args.map((i) => maybeInlined(i, inlined)).join(",");
      const type = getGLScalarType(ci.valueType);
      return `${type}[${ci.args.length}](${init})`;
    }
    case opcodes.DeferredListAccess:
    case opcodes.Distribution:
    case opcodes.SymbolicVar:
    case opcodes.SymbolicListVar: {
      throw Error(
        `Programming Error: expect op ${ci.type} to be removed before emitting code.`
      );
    }
    case opcodes.ListAccess: {
      const length = getConstantListLengthRequired(chunk, ci.args[0]);
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
      return `${index}>=1 && ${index}<=${length} ? ${list}[${index}-1] : ${nan}`;
    }
    // in-bounds list access assumes that args[1] is an integer
    // between 1 and args[0].length, inclusive
    case opcodes.InboundsListAccess:
      return (
        maybeInlined(ci.args[0], inlined) +
        "[int(" +
        maybeInlined(ci.args[1], inlined) +
        ")-1]"
      );
    case opcodes.NativeFunction: {
      deps.add(nativeFunctionDependency(chunk, ci));
      const name = getFunctionName(ci.symbol);
      const args = ci.args.map((e) => maybeInlined(e, inlined)).join(",");
      return `${name}(${args})`;
    }
    case opcodes.ExtendSeed:
      throw Error("ExtendSeed not yet implemented");
    default:
      throw Error(`Unexpected opcode: ${ci.type}`);
  }
}

function nativeFunctionDependency(chunk: IRChunk, ci: NativeFunction): string {
  const builtin = getBuiltin(ci.symbol);
  switch (builtin?.tag) {
    case "list":
      return (
        ci.symbol +
        "#" +
        getConstantListLengthRequired(chunk, ci.args[0]).toString()
      );
    case "list2":
      return (
        ci.symbol +
        "#" +
        getConstantListLengthRequired(chunk, ci.args[0]).toString() +
        "#" +
        getConstantListLengthRequired(chunk, ci.args[1]).toString()
      );
    case "glsl-builtin":
    case "simple":
      return ci.symbol;
    default:
      throw new Error(
        `Programming error: Impossible native function builtin type: ${builtin?.tag}`
      );
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
  ci: BeginLoop,
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
  // Initialize accumulators. There may be more than one; see
  // https://www.desmos.com/calculator/tggl7kcm7w from issue #506, in which a
  // sum's derivative accumulates both the original sum and the derivative's sum
  let s = "";
  for (let i = 2; i < ci.args.length; i++) {
    const initialValue = maybeInlined(ci.args[i], inlined);
    const accumulatorIndex = instructionIndex + i - 1;
    const accumulatorIdentifier = getIdentifier(accumulatorIndex);
    if (chunk.getInstruction(accumulatorIndex).type === opcodes.BlockVar)
      s += `${accumulatorIdentifier}=${initialValue};`;
  }
  return `${s}\nfor(${iterationVar}=${lowerBound};${iterationVar}<=${upperBound};${iterationVar}++){\n`;
}

function getEndLoopSource(
  instructionIndex: number,
  ci: EndLoop,
  chunk: IRChunk,
  inlined: string[]
) {
  let s = "";
  for (let i = 1; i < ci.args.length; i++) {
    const accumulatorIndex = ci.args[0] + i;
    if (chunk.getInstruction(accumulatorIndex).type === opcodes.BlockVar) {
      s += `${getIdentifier(accumulatorIndex)}=${maybeInlined(
        ci.args[i],
        inlined
      )};\n`;
    }
  }
  // end the loop
  s += "}\n";
  for (let i = 1; i < ci.args.length; i++) {
    const outputIndex = instructionIndex + i;
    if (outputIndex >= chunk.instructionsLength()) continue;
    if (chunk.getInstruction(outputIndex).type === opcodes.BlockVar) {
      s += `${getIdentifier(outputIndex)}=${maybeInlined(
        ci.args[i],
        inlined
      )};\n`;
    }
  }
  return s;
}

function getBeginBroadcastSource(
  instructionIndex: number,
  ci: BeginBroadcast,
  chunk: IRChunk
) {
  const endInstruction = chunk.getInstruction(ci.endIndex);
  let broadcastLength = 0;
  if (endInstruction.type === opcodes.EndBroadcast) {
    for (let i = 1; i < endInstruction.args.length; i++) {
      const index = ci.endIndex + i;
      const broadcastRes = chunk.getInstruction(index);
      if (broadcastRes.type === opcodes.BroadcastResult) {
        const len = getConstantListLength(chunk, index);
        if (typeof len !== "number") {
          throw Error("List with non-constant length not supported");
        }
        broadcastLength = len;
      }
    }
  }
  const broadcastIndexVar = getIdentifier(instructionIndex);
  return `for(${broadcastIndexVar}=1.0;${broadcastIndexVar}<=${broadcastLength}.0;++${broadcastIndexVar}){\n`;
}

function getEndBroadcastSource(
  instructionIndex: number,
  ci: EndBroadcast,
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

const neverDeclareOpcodes: number[] = [
  opcodes.Noop,
  opcodes.EndBroadcast,
  opcodes.EndLoop,
];

const alwaysDeclareOpcodes: number[] = [
  opcodes.BeginIntegral,
  opcodes.BeginBroadcast,
  opcodes.BeginLoop,
  opcodes.EndLoop,
  opcodes.EndIntegral,
  opcodes.EndBroadcast,
  opcodes.BlockVar,
  opcodes.BroadcastResult,
];

function getTypedefsSource(chunk: IRChunk, referenceCountList: number[]) {
  let s = "";
  const len = chunk.instructionsLength();
  for (let i = chunk.argNames.length; i < len; i++) {
    const ci = chunk.getInstruction(i);
    if (neverDeclareOpcodes.includes(ci.type)) continue;
    const isListConstant =
      ci.type === opcodes.Constant && Types.isList(ci.valueType);
    if (
      isListConstant ||
      referenceCountList[i] > 1 ||
      alwaysDeclareOpcodes.includes(ci.type)
    ) {
      const type = Types.isList(ci.valueType)
        ? getGLTypeOfLength(
            ci.valueType,
            getConstantListLengthRequired(chunk, i)
          )
        : getGLScalarType(ci.valueType);
      const id = getIdentifier(i);
      if (isListConstant) {
        const init = (ci.value as any[]).map(compileObject).join(",");
        s += `${type} ${id} = ${type}(${init});\n`;
      } else {
        s += `${type} ${id};\n`;
      }
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
    default: {
      const src = getSourceSimple(
        currInstruction,
        instructionIndex,
        inlined,
        deps,
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
        const id = getIdentifier(instructionIndex);
        return {
          // check id === src to avoid reassignments to self like `float[] _1 = _1`;
          source: id === src ? "" : `${id}=${src};\n`,
          nextIndex: incrementedIndex,
        };
      }
    }
  }
}

export default function emitChunkGL(chunk: IRChunk) {
  const referenceCountList = countReferences(chunk);
  const varDeclarations = getTypedefsSource(chunk, referenceCountList);
  let outputSource = "";
  const inlined: string[] = [];
  const deps = new Set<string>();
  const lists: string[] = [];
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
  outputSource += `return ${maybeInlined(chunk.getReturnIndex(), inlined)};`;
  return {
    source: varDeclarations + lists.join("") + outputSource,
    deps,
  };
}
