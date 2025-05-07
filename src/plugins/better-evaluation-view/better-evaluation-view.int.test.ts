import { clean, Driver, testWithPage } from "#tests";

const COLOR_SWATCH = ".dcg-color-swatch";

async function enableBevLists(driver: Driver) {
  // This used to be the defaults, so all the tests currently start with this.
  await driver.setPluginSetting("better-evaluation-view", "lists", true);
}

testWithPage("EmptyList and ListOfNumber", async (driver) => {
  const listOfNumberIndex = 0;
  const emptyListIndex = 1;
  await enableBevLists(driver);
  await driver.focusIndex(listOfNumberIndex);
  await driver.setLatexAndSync("[1,2,3]+0");
  await driver.expectEval("\\left[1,2,3\\right]");

  // It updates when you edit the latex
  await driver.setLatexAndSync("[1,2,3,4]+0");
  await driver.expectEval("\\left[1,2,3,4\\right]");

  await driver.dispatch({
    type: "new-expression",
  });
  await driver.focusIndex(emptyListIndex);
  await driver.setLatexAndSync("[]+0");
  await driver.expectEval("\\left[\\right]");

  // It gets reset on disabling lists, and shows the native list view instead.
  await driver.setPluginSetting("better-evaluation-view", "lists", false);
  await driver.focusIndex(listOfNumberIndex);
  await driver.expectEvalPlain("equals\n=\n1\n1\n2\n2\n3\n3\n4\n4");
  await driver.focusIndex(emptyListIndex);
  await driver.expectEvalPlain("empty list");

  // Clean up
  await driver.clean();
  return clean;
});

testWithPage("ListOfComplex", async (driver) => {
  await enableBevLists(driver);
  await driver.dispatch({
    type: "toggle-complex-mode",
  });
  await driver.focusIndex(0);
  await driver.setLatexAndSync("[1,2,3,4]+i");
  await driver.expectEval("\\left[1+i,2+i,3+i,4+i\\right]");

  await driver.setPluginSetting("better-evaluation-view", "lists", false);
  await driver.expectEvalPlain(
    'equals\n=\n1 plus "i"\n1+i\n2 plus "i"\n2+i\n3 plus "i"\n3+i\n4 plus "i"\n4+i'
  );

  await driver.clean();
  return clean;
});

testWithPage("ListOfPoint and ListOfPoint3D", async (driver) => {
  await enableBevLists(driver);
  const listOfPointIndex = 0;
  const listOfPoint3DIndex = 1;
  await driver.focusIndex(listOfPointIndex);
  await driver.setLatexAndSync("([1...3],2)");
  await driver.expectEval(
    "\\left[\\left(1,2\\right),\\left(2,2\\right),\\left(3,2\\right)\\right]"
  );
  await driver.dispatch({
    type: "new-expression",
  });
  await driver.focusIndex(listOfPoint3DIndex);
  await driver.setLatexAndSync("([1...3],2,3)");
  await driver.expectEval(
    "\\left[\\left(1,2,3\\right),\\left(2,2,3\\right),\\left(3,2,3\\right)\\right]"
  );

  await driver.setPluginSetting("better-evaluation-view", "lists", false);
  await driver.focusIndex(listOfPointIndex);
  await driver.expectEvalPlain(
    "equals\n=\nleft parenthesis, 1 , 2 , right parenthesis\n1,2\nleft parenthesis, 2 , 2 , right parenthesis\n2,2\nleft parenthesis, 3 , 2 , right parenthesis\n3,2"
  );
  await driver.focusIndex(listOfPoint3DIndex);
  await driver.expectEvalPlain(
    "equals\n=\nleft parenthesis, 1 , 2 , 3 , right parenthesis\n1,2,3\nleft parenthesis, 2 , 2 , 3 , right parenthesis\n2,2,3\nleft parenthesis, 3 , 2 , 3 , right parenthesis\n3,2,3"
  );

  await driver.clean();
  return clean;
});

testWithPage("Color", async (driver) => {
  await enableBevLists(driver);
  await driver.focusIndex(0);
  await driver.setLatexAndSync("C=\\operatorname{rgb}\\left(1,2,3\\right)");
  const exp = "\\operatorname{rgb}\\left(1,2,3\\right)";
  await driver.expectEval(exp);

  // It doesn't get reset on disabling color lists
  await driver.setPluginSetting("better-evaluation-view", "colorLists", false);
  await driver.assertSelector(COLOR_SWATCH);
  await driver.expectEval(exp);

  // It gets reset on disabling colors
  await driver.setPluginSetting("better-evaluation-view", "colors", false);
  await driver.assertSelector(COLOR_SWATCH);

  // Clean up
  await driver.clean();
  return clean;
});

testWithPage("Color List", async (driver) => {
  await enableBevLists(driver);
  await driver.focusIndex(0);
  await driver.setLatexAndSync("C=\\operatorname{rgb}\\left(1,2,[3,4]\\right)");
  const exp =
    "\\operatorname{rgb}\\left(\\left[\\left(1,2,3\\right),\\left(1,2,4\\right)\\right]\\right)";
  await driver.expectEval(exp);
  await driver.assertSelector(COLOR_SWATCH);

  // It gets reset on disabling color lists
  await driver.setPluginSetting("better-evaluation-view", "colorLists", false);
  await driver.assertSelector(COLOR_SWATCH);

  // It gets reset on disabling colors
  await driver.setPluginSetting("better-evaluation-view", "colorLists", true);
  await driver.setPluginSetting("better-evaluation-view", "colors", false);
  await driver.assertSelector(COLOR_SWATCH);

  // Clean up
  await driver.clean();
  return clean;
});

testWithPage(
  "Floats",
  async (driver) => {
    await enableBevLists(driver);
    await driver.focusIndex(0);

    // List is untouched with floats=false (default)
    await driver.setLatexAndSync("L=[0/0,1/0,-1/0,4]+0");
    await driver.expectEval(
      "\\left[\\mathrm{undefined},\\mathrm{undefined},\\mathrm{undefined},4\\right]"
    );

    // Scalar is untouched with floats=false.
    await driver.setLatexAndSync("L=0/0");
    await driver.expectEvalPlain("undefined");
    await driver.setLatexAndSync("L=1/0");
    await driver.expectEvalPlain("undefined");
    await driver.setLatexAndSync("L=-1/0");
    await driver.expectEvalPlain("undefined");

    // Set floats=true
    await driver.setPluginSetting("better-evaluation-view", "floats", true);

    // List uses advanced floats with floats=true.
    await driver.setLatexAndSync("L=[0/0,1/0,-1/0,4]+0");
    await driver.expectEval(
      "\\left[\\mathrm{NaN},\\infty ,-\\infty ,4\\right]"
    );

    // Scalar uses advanced floats with floats=true.
    await driver.setLatexAndSync("L=0/0");
    await driver.expectEval("\\mathrm{NaN}");
    await driver.setLatexAndSync("L=1/0");
    await driver.expectEval("\\infty");
    await driver.setLatexAndSync("L=-1/0");
    await driver.expectEval("-\\infty");

    // Lists use advanced floats with floats=true even if lists=false.
    await driver.setPluginSetting("better-evaluation-view", "lists", false);
    await driver.setLatexAndSync("L=[0/0,1/0,-1/0,4]+0");
    await driver.expectEval(["\\mathrm{NaN}", "\\infty", "-\\infty", "4"]);

    // Clean up
    await driver.clean();
    return clean;
  },
  150000
);
