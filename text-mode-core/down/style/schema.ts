/**
 * - number: evaluated value must be number
 * - boolean: evaluated value must be boolean
 * - string: evaluated value must be string
 * - expr: must be some expression
 * - color: must be string or some expression
 * - enum: constrained to that set of strings
 * - Schema: nest!
 */

export interface Schema {
  [key: string]:
    | "number"
    | { type: "number[]"; length: number }
    | "boolean"
    | "string"
    | "expr"
    | "color"
    | { type: "enum"; enum: string[] }
    | {
        type: "schema";
        schema: Schema;
        fillDefaults: boolean;
        orBool: boolean;
      };
}

export const settings: Schema = {
  product: enumL(["graphing", "geometry-calculator", "graphing-3d"]),
  viewport: schemaL(
    {
      xmin: "number",
      ymin: "number",
      zmin: "number",
      xmax: "number",
      ymax: "number",
      zmax: "number",
    },
    { fillDefaults: true }
  ),
  squareAxes: "boolean",
  // empty randomSeed will be filled in later in the process
  randomSeed: "string",
  xAxisLabel: "string",
  yAxisLabel: "string",
  xAxisArrowMode: enumL(["NONE", "POSITIVE", "BOTH"]),
  yAxisArrowMode: enumL(["NONE", "POSITIVE", "BOTH"]),
  xAxisMinorSubdivisions: "number",
  yAxisMinorSubdivisions: "number",
  xAxisStep: "number",
  yAxisStep: "number",
  degreeMode: "boolean",
  complex: "boolean",
  showGrid: "boolean",
  showXAxis: "boolean",
  showYAxis: "boolean",
  xAxisNumbers: "boolean",
  yAxisNumbers: "boolean",
  polarNumbers: "boolean",
  restrictGridToFirstQuadrant: "boolean",
  polarMode: "boolean",
  lockViewport: "boolean",
  axis3D: {
    type: "number[]",
    length: 3,
  },
  speed3D: "number",
  worldRotation3D: { type: "number[]", length: 9 },
};

export const ticker: Schema = {
  minStep: "expr",
  playing: "boolean",
};

const base: Schema = {
  // empty ID will be filled in later in the process
  id: "string",
};

const itemBase: Schema = {
  ...base,
  secret: "boolean",
};

const nonFolderBase: Schema = {
  ...itemBase,
  pinned: "boolean",
};

const columnExpressionCommon: Schema = {
  id: "string",
  // empty color will be filled in later in the process
  color: "color",
  hidden: "boolean",
  points: schemaL(
    {
      opacity: "expr",
      size: "expr",
      style: enumL(["POINT", "OPEN", "CROSS"]),
      drag: enumL(["NONE", "X", "Y", "XY", "AUTO"]),
    },
    { orBool: true }
  ),
  lines: schemaL(
    {
      opacity: "expr",
      width: "expr",
      style: enumL(["SOLID", "DASHED", "DOTTED"]),
    },
    { orBool: true }
  ),
};

const clickable: Schema = {
  onClick: "expr",
  clickDescription: "string",
};

const boundsSchema = schemaL({
  min: "expr",
  max: "expr",
});

export const expression: Schema = {
  ...nonFolderBase,
  ...columnExpressionCommon,
  ...clickable,
  label: schemaL({
    text: "string",
    size: "expr",
    orientation: {
      type: "enum",
      enum: [
        "default",
        "center",
        "center_auto",
        "auto_center",
        "above",
        "above_left",
        "above_right",
        "above_auto",
        "below",
        "below_left",
        "below_right",
        "below_auto",
        "left",
        "auto_left",
        "right",
        "auto_right",
      ],
    },
    angle: "expr",
    outline: "boolean",
    showOnHover: "boolean",
    editableMode: enumL(["MATH", "TEXT", "NONE"]),
  }),
  errorHidden: "boolean",
  glesmos: "boolean",
  fill: "expr",
  displayEvaluationAsFraction: "boolean",
  slider: schemaL({
    playing: "boolean",
    reversed: "boolean",
    loopMode: enumL([
      "LOOP_FORWARD_REVERSE",
      "LOOP_FORWARD",
      "PLAY_ONCE",
      "PLAY_INDEFINITELY",
    ]),
    period: "number",
    min: "expr",
    max: "expr",
    step: "expr",
  }),
  domain: schemaL({
    theta: boundsSchema,
    t: boundsSchema,
    u: boundsSchema,
    v: boundsSchema,
    rho: boundsSchema,
    phi: boundsSchema,
  }),
  cdf: boundsSchema,
  // TODO vizProps
  // vizProps
};

export const regression: Schema = {
  ...nonFolderBase,
  errorHidden: "boolean",
  logMode: "boolean",
};

export const table: Schema = nonFolderBase;

export const column: Schema = {
  ...base,
  ...columnExpressionCommon,
};

export const image: Schema = {
  ...nonFolderBase,
  ...clickable,
  width: "expr",
  height: "expr",
  center: "expr",
  angle: "expr",
  opacity: "expr",
  foreground: "boolean",
  draggable: "boolean",
  url: "string",
  hoveredImage: "string",
  depressedImage: "string",
};

export const text: Schema = nonFolderBase;

export const folder: Schema = {
  ...itemBase,
  hidden: "boolean",
  collapsed: "boolean",
};

function enumL(L: string[]) {
  return { type: "enum" as const, enum: L };
}

function schemaL(
  s: Schema,
  t: { fillDefaults?: boolean; orBool?: boolean } = {}
) {
  return {
    type: "schema" as const,
    schema: s,
    fillDefaults: t.fillDefaults ?? false,
    orBool: t.orBool ?? false,
  };
}
