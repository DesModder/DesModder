import { parseSavedState, serializeSavedState } from "./saved-state-utils";
import { expect, test, describe } from "@jest/globals";
// https://stackoverflow.com/questions/68468203/why-am-i-getting-textencoder-is-not-defined-in-jest
import { TextEncoder, TextDecoder } from "util";

Object.assign(global, { TextDecoder, TextEncoder });

function roundtrip(data: any) {
  test(JSON.stringify(data), () => {
    const data2 = parseSavedState(serializeSavedState(data));
    expect(data).toEqual(data2);
  });
}

describe("Test Saved State Serialization Roundtrip", () => {
  roundtrip(123);
  roundtrip("ASDASDasd");
  roundtrip({ a: 1, b: 2, c: "sdfdsfkfjs" });
  roundtrip({ arr: [1, 2, 3, 4, 5, 6] });
});
