/**
 * Reading Desmos's own answers back into the constants that produced them.
 *
 * Every decimal here is what Desmos actually prints for the constant named
 * beside it, so these are the real strings somebody would copy off the screen.
 */
import { recognizeDecimal, significantDigits } from "./recognize";
import { toLatex } from "./exact";
import { buildConfig } from "../../../../text-mode-core";
import { toLatex as emit } from "../../../symbolic";

const recognised = (text: string) => {
  const found = recognizeDecimal(text);
  return found === undefined ? undefined : toLatex(found.value);
};

describe("recognising what Desmos printed", () => {
  test("pi and its powers", () => {
    // The case Rafael asked for: Desmos shows pi squared as 9.86960440109.
    expect(recognised("9.86960440109")).toBe("\\pi^{2}");
    expect(recognised("3.14159265359")).toBe("\\pi");
    expect(recognised("31.0062766803")).toBe("\\pi^{3}");
    expect(recognised("0.318309886184")).toBe("\\frac{1}{\\pi}");
  });

  test("a rational multiple of pi, which is most angles", () => {
    expect(recognised("1.57079632679")).toBe("\\frac{\\pi}{2}");
    expect(recognised("1.0471975512")).toBe("\\frac{\\pi}{3}");
    expect(recognised("4.71238898038")).toBe("\\frac{3\\pi}{2}");
  });

  test("roots", () => {
    expect(recognised("1.41421356237")).toBe("\\sqrt{2}");
    expect(recognised("2.82842712475")).toBe("2\\sqrt{2}");
    expect(recognised("1.73205080757")).toBe("\\sqrt{3}");
    expect(recognised("0.707106781187")).toBe("\\frac{\\sqrt{2}}{2}");
  });

  test("e", () => {
    expect(recognised("2.71828182846")).toBe("e");
    expect(recognised("7.38905609893")).toBe("e^{2}");
  });

  test("a plain fraction is reported as a fraction, not as something exotic", () => {
    expect(recognised("0.25")).toBe("\\frac{1}{4}");
    expect(recognised("0.333333333333")).toBe("\\frac{1}{3}");
    expect(recognised("1.5")).toBe("\\frac{3}{2}");
  });
});

describe("what it will not claim", () => {
  test("too few digits to name an irrational", () => {
    // 3.14 is pi to the digits given, and it is also 157/50. With three digits
    // there is no evidence for the first, so the fraction is what comes back.
    expect(recognised("3.14")).toBe("\\frac{157}{50}");
  });

  test("a number that is nothing in particular", () => {
    expect(recognised("4.83726194857")).toBeUndefined();
  });

  test("a candidate has to match every digit given, not merely be close", () => {
    // pi squared with the last digit wrong.
    expect(recognised("9.86960440509")).toBeUndefined();
  });

  test("zero and nonsense", () => {
    expect(recognised("0")).toBeUndefined();
    expect(recognised("")).toBeUndefined();
    expect(recognised("abc")).toBeUndefined();
  });
});

describe("with more digits, more shapes", () => {
  // Written as the formula was found; the tests' parser spells π by name.
  const cfg = buildConfig({ commandNames: "sin cos tan ln log exp sqrt" });
  const shown = (text: string) => {
    const found = recognizeDecimal(text);
    return found === undefined
      ? undefined
      : emit(cfg, found.node).replace(/\\operatorname\{pi\}/g, "\\pi");
  };

  test("a sum: the golden ratio, from what Desmos prints and from more", () => {
    expect(shown("1.61803398875")).toBe(String.raw`\frac{1+\sqrt{5}}{2}`);
    expect(shown("-1.6180339887498948482")).toBe(
      String.raw`-\frac{1+\sqrt{5}}{2}`
    );
    expect(shown("2.6449340668482264365")).toBe(
      String.raw`1+\frac{\pi^{2}}{6}`
    );
  });

  test("a product of powers", () => {
    expect(shown("18.970519737161744759052")).toBe(
      String.raw`\frac{\pi^{2}e}{\sqrt{2}}`
    );
    expect(shown("1.3956124250860895286")).toBe(String.raw`e^{\frac{1}{3}}`);
    expect(shown("1.2599210498948731648")).toBe(String.raw`2^{\frac{1}{3}}`);
  });

  test("a tower", () => {
    expect(shown("81.500254752812172662559552037")).toBe(
      String.raw`\pi^{e\sqrt{2}}`
    );
    expect(shown("2.6651441426902251886502972498731")).toBe(
      String.raw`2^{\sqrt{2}}`
    );
    // e^π from the twelve digits Desmos prints.
    expect(shown("23.1406926328")).toBe(String.raw`e^{\pi}`);
  });

  test("random digits stay random, however many there are", () => {
    expect(shown("1.2903847561029384756")).toBeUndefined();
    expect(shown("4.83726194857302918475602918374")).toBeUndefined();
    expect(
      shown("7.1234987612309876123498761230987612349876123098761")
    ).toBeUndefined();
  });

  test("the strength of a match grows with the digits behind it", () => {
    const short = recognizeDecimal("1.61803398875");
    const long = recognizeDecimal("1.6180339887498948482045868343656");
    expect(short?.spare).toBeLessThan(long?.spare ?? 0);
  });
});

describe("constants Desmos has no name for", () => {
  const cfg = buildConfig({
    commandNames: "sin cos tan ln log exp sqrt gamma zeta",
  });
  const shown = (text: string) => {
    const found = recognizeDecimal(text);
    return found === undefined
      ? undefined
      : emit(cfg, found.node).replace(/\\operatorname\{pi\}/g, "\\pi");
  };
  const needs = (text: string) =>
    recognizeDecimal(text)?.definitions.map((c) => c.symbol);

  test("each on its own, from sixteen digits", () => {
    expect(shown("0.5772156649015329")).toBe(String.raw`\gamma`);
    expect(needs("0.5772156649015329")).toEqual(["gamma"]);
    expect(shown("1.202056903159594")).toBe(String.raw`\zeta_{3}`);
    expect(shown("0.9159655941772190151")).toBe(String.raw`G_{c}`);
    expect(shown("1.0369277551433699263")).toBe(String.raw`\zeta_{5}`);
  });

  test("in the shapes the others take", () => {
    expect(shown("0.60102845157979714270")).toBe(
      String.raw`\frac{\zeta_{3}}{2}`
    );
    expect(shown("1.7324547146006334736")).toBe(String.raw`\frac{1}{\gamma}`);
    expect(shown("2.222149731749759297078927")).toBe(
      String.raw`\gamma+\frac{\pi^{2}}{6}`
    );
    expect(shown("2.2020569031595942854")).toBe(String.raw`1+\zeta_{3}`);
    expect(shown("1.7810724179901979852365041")).toBe(String.raw`e^{\gamma}`);
    expect(shown("0.33317792380771867431837613635524")).toBe(
      String.raw`\gamma^{2}`
    );
  });

  test("a bigger search does not make random digits match", () => {
    for (const digits of [
      "3.8471029384756102",
      "1.2903847561029384756",
      "0.5629384710293847561029384",
      "4.83726194857302918475602918374",
      "2.019283746510293847561029384756102938475",
    ])
      expect(shown(digits)).toBeUndefined();
  });
});

describe("counting significant digits, which sets the tolerance", () => {
  test("the cases that decide how hard a match has to work", () => {
    expect(significantDigits("9.86960440109")).toBe(12);
    expect(significantDigits("3.14")).toBe(3);
    expect(significantDigits("0.00123")).toBe(3);
    expect(significantDigits("2.50")).toBe(3);
    expect(significantDigits("100")).toBe(3);
  });
});
