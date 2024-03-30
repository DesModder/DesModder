// Warning: enums are nice because they behave as both types and values.
// In particular, const enums are nice for performance since they're inlined.
// However, there are some pitfalls if you _export_ const enums.
// See https://www.typescriptlang.org/docs/handbook/enums.html#const-enum-pitfalls
export const enum DT {
  // String and Array do not follow the pattern of the rest.
  Cursor = "cursor",
  Indent = "indent",
  Align = "align",
  Trim = "trim",
  Group = "group",
  Fill = "fill",
  IfBreak = "if-break",
  IndentIfBreak = "indent-if-break",
  LineSuffix = "line-suffix",
  LineSuffixBoundary = "line-suffix-boundary",
  Line = "line",
  Label = "label",
  BreakParent = "break-parent",
}
