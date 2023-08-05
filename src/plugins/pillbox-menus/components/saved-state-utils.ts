import * as base64Arraybuffer from "base64-arraybuffer";
import * as pako from "pako";

export function serializeSavedState(savedState: any) {
  return base64Arraybuffer.encode(
    pako.deflate(new TextEncoder().encode(JSON.stringify(savedState))).buffer
  );
}

export function parseSavedState(savedState: string) {
  try {
    const buffer = base64Arraybuffer.decode(savedState);

    return JSON.parse(new TextDecoder().decode(pako.inflate(buffer)));
  } catch {
    return {};
  }
}
