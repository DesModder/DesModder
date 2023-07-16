import { clean, testWithPage } from "tests/puppeteer-utils";

const STATE_BASE = {
  version: 10,
  randomSeed: "2526a837de1b19af17098be805151859",
  graph: {
    viewport: {
      xmin: -10,
      ymin: -14.724969097651421,
      xmax: 10,
      ymax: 14.724969097651421,
    },
  },
  expressions: {
    list: [
      {
        type: "expression",
        id: "1",
        color: "#c74440",
      },
    ],
  },
};

const STATE_GREEK = {
  version: 10,
  randomSeed: "2526a837de1b19af17098be805151859",
  graph: {
    viewport: {
      xmin: -10,
      ymin: -14.724969097651421,
      xmax: 10,
      ymax: 14.724969097651421,
    },
  },
  expressions: {
    list: [
      {
        type: "expression",
        id: "1",
        color: "#c74440",
        latex: "\\omega",
      },
    ],
  },
};

const STATE_SUPERSCRIPT = {
  version: 10,
  randomSeed: "2526a837de1b19af17098be805151859",
  graph: {
    viewport: {
      xmin: -10,
      ymin: -14.724969097651421,
      xmax: 10,
      ymax: 14.724969097651421,
    },
  },
  expressions: {
    list: [
      {
        type: "expression",
        id: "1",
        color: "#c74440",
        latex: "e^{2+2}",
      },
    ],
  },
};

testWithPage("More Greek Letters", async (driver) => {
  await driver.enablePlugin("custom-mathquill-config");
  await driver.setState(STATE_BASE as any);
  await driver.focusIndex(0);
  await driver.setPluginSetting(
    "custom-mathquill-config",
    "extendedGreek",
    true
  );
  await driver.keyboard.type("omega");
  await driver.assertExprsList(STATE_GREEK as any);

  await driver.clean();
  return clean;
});

testWithPage("Operators in Exponents", async (driver) => {
  await driver.enablePlugin("custom-mathquill-config");
  await driver.setState(STATE_BASE as any);
  await driver.focusIndex(0);
  await driver.setPluginSetting(
    "custom-mathquill-config",
    "superscriptOperators",
    true
  );
  await driver.keyboard.type("e^2+2");
  await driver.assertExprsList(STATE_SUPERSCRIPT as any);

  await driver.clean();
  return clean;
});
