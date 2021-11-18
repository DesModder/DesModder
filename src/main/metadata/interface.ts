export default interface Metadata {
  version: 2;
  expressions: {
    [key: string]: Expression;
  };
}

export interface Expression {
  pinned?: boolean;
  errorHidden?: boolean;
  glesmos?: boolean;
}
