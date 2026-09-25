/**
 * The special constants against their published digits, and against
 * themselves at higher precision, which is what shows the algorithms converge
 * at the rate claimed rather than merely starting right.
 */
import { SPECIAL_CONSTANTS } from "./specialConstants";
import { decimalContext } from "../../../symbolic";

const PUBLISHED: Record<string, string> = {
  gamma: "0.577215664901532860606512090082402431042159335939",
  zeta_3: "1.202056903159594285399738161511449990764986292340",
  zeta_5: "1.036927755143369926331365486457034168057080919501",
  zeta_7: "1.008349277381922826839797549849796759599863560565",
  G_c: "0.915965594177219015054603514932384110774149374281",
};

describe("fifty digits, as published", () => {
  test.each(SPECIAL_CONSTANTS.map((c) => [c.name, c.symbol] as const))(
    "%s",
    (_, symbol) => {
      const constant = SPECIAL_CONSTANTS.find((c) => c.symbol === symbol)!;
      const expected = PUBLISHED[symbol];
      const places = expected.split(".")[1].length;
      const D = decimalContext(80);
      expect(new D(constant.compute(70)).toFixed(places, D.ROUND_DOWN)).toBe(
        expected
      );
    }
  );
});

describe("two hundred digits, agreeing with two hundred and fifty", () => {
  test.each(SPECIAL_CONSTANTS.map((c) => [c.name, c.symbol] as const))(
    "%s",
    (_, symbol) => {
      const constant = SPECIAL_CONSTANTS.find((c) => c.symbol === symbol)!;
      const D = decimalContext(300);
      const low = new D(constant.compute(200));
      const high = new D(constant.compute(250));
      expect(low.minus(high).abs().lte(new D(10).pow(-195))).toBe(true);
    }
  );
});
