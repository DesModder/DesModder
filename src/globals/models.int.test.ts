import { clean, testWithPage } from "#tests";
import { ValueType } from "./models";

testWithPage("ValueTypes", async (driver) => {
  // Get Desmos's ValueTypes
  const valueTypes = await driver.page.evaluate(
    () => window.Desmos.Private.__compareBranches.valueTypes
  );

  // Get ValueType enum as a forward map
  const enumMap = Object.fromEntries(
    Object.entries(ValueType).filter(([key]) => isNaN(Number(key)))
  );

  const allKeys = new Set([
    ...Object.keys(enumMap),
    ...Object.keys(valueTypes),
  ]);

  const mismatches: string[] = [];

  for (const key of allKeys) {
    if (!(key in enumMap)) {
      mismatches.push(
        `DesModder is missing ValueType: ${key} = ${valueTypes[key]}`
      );
      continue;
    }

    if (!(key in valueTypes)) {
      mismatches.push(
        `DesModder has nonexistent ValueType: ${key} = ${enumMap[key]}`
      );
      continue;
    }

    if (enumMap[key] !== valueTypes[key]) {
      mismatches.push(
        `ValueType mismatch: ${key}: DesModder=${enumMap[key]}, Desmos=${valueTypes[key]}`
      );
    }
  }

  expect(mismatches).toEqual([]);

  // Clean up
  await driver.clean();
  return clean;
});
