export default interface Metadata {
  version: 2;
  // Record<GraphHash, Record<OldVarName, NewVarName>>
  symbolRemappings?: Record<string, Record<string, string>>;
  expressions: Record<string, Expression | undefined>;
}

export interface Expression {
  pinned?: boolean;
  errorHidden?: boolean;
  glesmos?: boolean;
  glesmosLinesConfirmed?: boolean;
}
