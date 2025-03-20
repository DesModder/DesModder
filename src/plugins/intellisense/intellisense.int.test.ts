import { testWithPage } from "#tests";

const delay = async (ms: number) =>
  // eslint-disable-next-line @desmodder/eslint-rules/no-timeouts-in-intellisense
  await new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("Intellisense", () => {
  testWithPage(
    "Intellisense Autocomplete",
    async (driver) => {
      // AUTOCOMPLETE TESTS ========================================================
      await driver.enablePlugin("intellisense");
      await driver.setPluginSetting("intellisense", "subscriptify", false);
      const blankState = await driver.getState();

      const testIdentSample = async (
        typedPrefix: string,
        latexPrefix: string,
        varname: string,
        subscriptname: string | undefined,
        typedSuffix: string,
        latexSuffix: string,
        suffixLeft: number
      ) => {
        let typedIdentifierSample = varname;

        // generate expected latex
        let expectedLatex = varname;
        if (varname.length > 1) {
          expectedLatex = `\\${varname}`;
        }
        if (subscriptname) {
          expectedLatex += `_{${
            subscriptname.length === 0 ? " " : subscriptname
          }}`;
        }
        if (subscriptname !== undefined) {
          typedIdentifierSample += `_${subscriptname}`;
        }

        // create reference expression
        await driver.keyboard.type(`${typedIdentifierSample}=123`);
        await driver.keyboard.press("Enter");

        // calculate how many "segments" it has
        let segmentsLength = 1;
        if (subscriptname?.length === 0) {
          segmentsLength = 2;
        } else if (subscriptname && subscriptname.length > 0) {
          segmentsLength = 2 + subscriptname.length;
        }

        // try autocompleting from the first i "parts" of the identifier sample
        for (let i = 1; i < segmentsLength; i++) {
          // go left j segments to validate it works at any position
          for (let j = 0; j < i; j++) {
            // generate partial identifier string
            let str = varname;
            if (i > 1 && subscriptname !== undefined) {
              str += `_${subscriptname.slice(0, i - 2)}`;
            }

            // type out prefix znd suffix
            await driver.keyboard.type(typedPrefix);
            await driver.keyboard.type(typedSuffix);

            // go between prefix and suffix
            for (let k = 0; k < suffixLeft; k++) {
              await driver.keyboard.press("ArrowLeft");
            }

            // type out identifier to test
            await driver.keyboard.type(str);
            if (j === 0 && i > 1) await driver.keyboard.press("ArrowRight");

            // go back a few spaces to test autocomplete
            // from the middle of an identifier
            for (let k = 0; k < j - 1; k++) {
              await driver.keyboard.press("ArrowLeft");
            }

            await delay(50);

            await driver.keyboard.press("Enter");

            await delay(50);

            await driver.assertSelectedItemLatex(
              latexPrefix + expectedLatex + latexSuffix,
              `Testing Identifier '${typedIdentifierSample}', autocompleting from '${str}', going left ${Math.max(
                j - 1,
                0
              )} characters, ${j === 0 ? "out of subscript" : "in subscript"}.`
            );

            await delay(50);

            // go to next expr
            await driver.keyboard.press("Enter");
          }
        }
      };

      // SUBSCRIPTIFY TESTS =================================================
      await driver.focusIndex(0);
      await testIdentSample("1+", "1+", "B", undefined, "+1", "+1", 2);
      await driver.setState(blankState);
      await driver.focusIndex(0);
      await testIdentSample("1+", "1+", "A", "1a3", "+1", "+1", 2);
      await driver.setState(blankState);
      await driver.focusIndex(0);
      await testIdentSample("1+", "1+", "alpha", "4b6", "+1", "+1", 2);
      await driver.setState(blankState);
      await driver.focusIndex(0);
      await testIdentSample("1+", "1+", "beta", "7c9", "+1", "+1", 2);

      await driver.setState(blankState);
      await driver.setPluginSetting("intellisense", "subscriptify", true);
      await driver.focusIndex(0);

      const wiggle = async () => {
        await driver.keyboard.press("ArrowLeft");
        await driver.keyboard.press("ArrowRight");
      };

      // type out three expressions
      await driver.keyboard.type("f_oo=1");
      await driver.keyboard.press("Enter");
      await driver.keyboard.type("b_ar=2");
      await driver.keyboard.press("Enter");
      await driver.keyboard.type("f_oobar=3");
      await driver.keyboard.press("Enter");
      await driver.keyboard.type("alpha_abc=4");
      await driver.keyboard.press("Enter");

      // see if they get autosubscriptified
      await driver.keyboard.type("foo");
      await wiggle();
      await driver.assertSelectedItemLatex("f_{oo}");
      await driver.keyboard.press("Escape");
      await driver.keyboard.press("Enter");
      await driver.keyboard.type("bar");
      await wiggle();
      await driver.assertSelectedItemLatex("b_{ar}");
      await driver.keyboard.press("Escape");
      await driver.keyboard.press("Enter");
      await driver.keyboard.type("foobar");
      await wiggle();
      await driver.assertSelectedItemLatex("f_{oobar}");
      await driver.keyboard.press("Escape");
      await driver.keyboard.press("Enter");
      await driver.keyboard.type("alphaabc");
      await wiggle();
      await driver.assertSelectedItemLatex("\\alpha_{abc}");
      await driver.keyboard.press("Escape");
      await driver.keyboard.press("Enter");
      await driver.keyboard.type("2foo");
      await wiggle();
      await driver.assertSelectedItemLatex("2f_{oo}");
      await driver.keyboard.press("Escape");
      await driver.keyboard.press("Enter");

      await driver.keyboard.type("c(x)=rgb(x,x,x)");
      await driver.assertSelectedItemLatex(
        "c\\left(x\\right)=\\operatorname{rgb}\\left(x,x,x\\right)"
      );

      await driver.clean();
    },
    40000
  );
});

// please work
