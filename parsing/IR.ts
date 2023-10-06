export interface IRChunk {
  argNames: string[];
  argTypes: number[];
  blockMask: unknown;
  instructions: IRInstruction[];
  getReturnIndex: () => number;
  instructionsLength: () => number;
  getInstruction: (i: number) => IRInstruction;
}

export interface Opcodes {
  Noop: 0;
  Constant: 1;
  BeginBroadcast: 2;
  LoadArg: 3;
  SymbolicVar: 4;
  SymbolicListVar: 5;
  MAX_LEAF_OPCODE: 5;
  Add: 8;
  Subtract: 9;
  Multiply: 10;
  Divide: 11;
  Exponent: 12;
  RawExponent: 13;
  Negative: 14;
  OrderedPair: 15;
  OrderedPairAccess: 16;
  BeginLoop: 17;
  EndLoop: 18;
  BeginIntegral: 19;
  EndIntegral: 20;
  EndBroadcast: 21;
  Equal: 22;
  Less: 23;
  Greater: 24;
  LessEqual: 25;
  GreaterEqual: 26;
  And: 29;
  Piecewise: 30;
  NativeFunction: 37;
  List: 38;
  ListAccess: 39;
  DeferredListAccess: 40;
  InboundsListAccess: 41;
  Distribution: 42;
  ExtendSeed: 44;
  BlockVar: 47;
  BroadcastResult: 48;
  Action: 49;
}

export interface Types {
  Any: 0;
  Number: 1;
  Bool: 2;
  Point: 3;
  Distribution: 4;
  Action: 5;
  ListOfAny: 6;
  ListOfNumber: 7;
  ListOfBool: 8;
  ListOfPoint: 9;
  ListOfDistribution: 10;
  EmptyList: 11;
  ErrorType: 12;
  SeedType: 13;
  RGBColor: 14;
  ListOfColor: 15;
}

export type ValueType = Types[keyof Types];

export interface HasValueType {
  valueType: ValueType;
}

export interface LoadArg extends HasValueType {
  type: Opcodes["LoadArg"];
}

export interface BlockVar extends HasValueType {
  type: Opcodes["BlockVar"];
}

export interface SymbolicVar extends HasValueType {
  type: Opcodes["SymbolicVar"];
  // valueType must not be a list
}

export interface SymbolicListVar extends HasValueType {
  type: Opcodes["SymbolicListVar"];
  length: number;
  // valueType must be a list
}

export interface Constant extends HasValueType {
  type: Opcodes["Constant"];
  value: unknown;
}

export interface BinaryOp extends HasValueType {
  args: [number, number];
}

export interface Add extends BinaryOp {
  type: Opcodes["Add"];
}

export interface Subtract extends BinaryOp {
  type: Opcodes["Subtract"];
}

export interface Multiply extends BinaryOp {
  type: Opcodes["Multiply"];
}

export interface Divide extends BinaryOp {
  type: Opcodes["Divide"];
}

export interface Exponent extends BinaryOp {
  type: Opcodes["Exponent"];
}

export interface RawExponent extends BinaryOp {
  type: Opcodes["RawExponent"];
}

export interface Negative extends HasValueType {
  type: Opcodes["Negative"];
  args: [number];
}

export interface Equal extends BinaryOp {
  type: Opcodes["Equal"];
}

export interface Less extends BinaryOp {
  type: Opcodes["Less"];
}

export interface Greater extends BinaryOp {
  type: Opcodes["Greater"];
}

export interface LessEqual extends BinaryOp {
  type: Opcodes["LessEqual"];
}

export interface GreaterEqual extends BinaryOp {
  type: Opcodes["GreaterEqual"];
}

export interface And extends BinaryOp {
  type: Opcodes["And"];
}

export interface Piecewise extends HasValueType {
  type: Opcodes["Piecewise"];
  args: number[];
}

export interface OrderedPair extends HasValueType {
  type: Opcodes["OrderedPair"];
  args: [number, number];
}

export interface OrderedPairAccess extends HasValueType {
  type: Opcodes["OrderedPairAccess"];
  args: [number, number];
}

export interface List extends HasValueType {
  type: Opcodes["List"];
  args: number[];
}

export interface ListAccess extends HasValueType {
  type: Opcodes["ListAccess"];
  // args: [list, index]
  args: [number, number];
}

export interface DeferredListAccess extends HasValueType {
  type: Opcodes["DeferredListAccess"];
  args: unknown;
}

export interface InboundsListAccess extends HasValueType {
  type: Opcodes["InboundsListAccess"];
  // args: [list, index]
  args: [number, number];
}

export interface NativeFunction extends HasValueType {
  type: Opcodes["NativeFunction"];
  args: number[];
  symbol: string;
  callData: unknown;
}

export interface Distribution extends HasValueType {
  type: Opcodes["Distribution"];
  args: unknown;
  symbol: string;
}

export interface BeginIntegral extends HasValueType {
  type: Opcodes["BeginIntegral"];
  args: unknown;
  endIndex: number;
  callData: unknown;
}

export interface EndIntegral extends HasValueType {
  type: Opcodes["EndIntegral"];
  args: unknown;
}

export interface BeginBroadcast extends HasValueType {
  type: Opcodes["BeginBroadcast"];
  length: number;
  endIndex: number;
  // args: [index of list length]
  args: [number];
}

export interface EndBroadcast extends HasValueType {
  type: Opcodes["EndBroadcast"];
  // args: [matching StartBroadcast index, return index, ...more return indices]
  args: number[];
}

export interface BroadcastResult extends HasValueType {
  type: Opcodes["BroadcastResult"];
  // args: [matching EndBroadcast index]
  args: [number];
  constantLength?: number;
  isConstantBroadcast: boolean;
}

export interface BeginLoop extends HasValueType {
  type: Opcodes["BeginLoop"];
  // args: lower bound, upper bound, initial value
  args: number[];
  endIndex: number;
  callData: unknown;
}

export interface EndLoop extends HasValueType {
  type: Opcodes["EndLoop"];
  // args: matching BeginLoop index, accumulator new value
  args: [number, number];
}

export interface ExtendSeed extends HasValueType {
  type: Opcodes["ExtendSeed"];
  args: unknown;
  tag: unknown;
}

export interface Noop extends HasValueType {
  type: Opcodes["Noop"];
}

export interface Action extends HasValueType {
  type: Opcodes["Action"];
  args: unknown;
  symbols: unknown;
}

export type IRInstruction =
  | Noop
  | Constant
  | BeginBroadcast
  | LoadArg
  | SymbolicVar
  | SymbolicListVar
  | Add
  | Subtract
  | Multiply
  | Divide
  | Exponent
  | RawExponent
  | Negative
  | OrderedPair
  | OrderedPairAccess
  | BeginLoop
  | EndLoop
  | BeginIntegral
  | EndIntegral
  | EndBroadcast
  | Equal
  | Less
  | Greater
  | LessEqual
  | GreaterEqual
  | And
  | Piecewise
  | NativeFunction
  | List
  | ListAccess
  | DeferredListAccess
  | InboundsListAccess
  | Distribution
  | ExtendSeed
  | BlockVar
  | BroadcastResult
  | Action;
