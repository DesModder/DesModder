import { clean, testWithPage } from "../../tests/puppeteer-utils";

describe("Intellisense", () => {
  // These two tests could really be combined.
  //  I'm just trying two simple tests to make sure the browser remains.
  testWithPage(
    "Intellisense Autocomplete",
    async (driver) => {
      await driver.enablePlugin("intellisense");
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
        let typedIdentifierSample = `${varname}`;

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
          for (let j = 0; j < i - 1; j++) {
            // generate partial identifier string
            let str = varname;
            if (i > 1 && subscriptname !== undefined) {
              str += `_${subscriptname.slice(0, i - 2)}`;
            }

            // type out str and go left
            await driver.keyboard.type(typedPrefix + str);
            await driver.keyboard.press("ArrowRight");
            await driver.keyboard.type(typedSuffix);
            for (let k = 0; k < j + suffixLeft; k++) {
              await driver.keyboard.press("ArrowLeft");
            }

            // try autocomplete
            await driver.keyboard.press("Enter");
            await driver.assertSelectedItemLatex(
              latexPrefix + expectedLatex + latexSuffix,
              `Testing Identifier '${typedIdentifierSample}', autocompleting from '${str}', going left ${j} characters.`
            );

            // go to next expr
            await driver.keyboard.press("Enter");
          }
        }
      };

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

      await driver.clean();
      return clean;
    },
    20000
  );
});
