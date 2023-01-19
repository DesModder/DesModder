import { promises as fs } from "fs";
import { inspect } from "util";

export async function loadFile(path) {
  return await fs
    .readFile(path, "utf8")
    .catch((err) => printDiagnostics({ file: path, err }));
}

function printDiagnostics(...args) {
  console.log(inspect(args, false, 10, true));
}
