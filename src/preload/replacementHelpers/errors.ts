export class ReplacementError extends Error {
  constructor(readonly message: string) {
    super(message);
    this.name = "ReplacementError";
  }
}
