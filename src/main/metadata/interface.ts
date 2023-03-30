export default interface Metadata {
  version: 2;
  expressions: Record<string, Expression>;
}

export interface Expression {
  pinned?: boolean;
  errorHidden?: boolean;
  glesmos?: boolean;
  glesmosLinesConfirmed?: boolean;
}
