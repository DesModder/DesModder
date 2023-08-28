import { clean, testWithPage } from "#tests";

const STATE_FOLDER = {
  version: 10,
  randomSeed: "861b75cf1f85459cb1986343091d322d",
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
        type: "folder",
        id: "11",
        title: "A",
      },
      {
        type: "expression",
        id: "13",
        folderId: "11",
        color: "#388c46",
        latex: "B",
      },
      {
        type: "expression",
        id: "14",
        folderId: "11",
        color: "#6042a6",
        latex: "C",
      },
      {
        type: "expression",
        id: "15",
        color: "#000000",
        latex: "D",
      },
      {
        type: "expression",
        id: "16",
        color: "#c74440",
        latex: "E",
      },
    ],
  },
};

const STATE_DUMPED = {
  version: 10,
  randomSeed: "861b75cf1f85459cb1986343091d322d",
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
        type: "text",
        id: "17",
        text: "A",
      },
      {
        type: "expression",
        id: "13",
        color: "#388c46",
        latex: "B",
      },
      {
        type: "expression",
        id: "14",
        color: "#6042a6",
        latex: "C",
      },
      {
        type: "expression",
        id: "15",
        color: "#000000",
        latex: "D",
      },
      {
        type: "expression",
        id: "16",
        color: "#c74440",
        latex: "E",
      },
    ],
  },
};

const STATE_ENCLOSED = {
  version: 10,
  randomSeed: "861b75cf1f85459cb1986343091d322d",
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
        type: "folder",
        id: "18",
        title: "A",
      },
      {
        type: "expression",
        id: "13",
        folderId: "18",
        color: "#388c46",
        latex: "B",
      },
      {
        type: "expression",
        id: "14",
        folderId: "18",
        color: "#6042a6",
        latex: "C",
      },
      {
        type: "expression",
        id: "15",
        folderId: "18",
        color: "#000000",
        latex: "D",
      },
      {
        type: "expression",
        id: "16",
        folderId: "18",
        color: "#c74440",
        latex: "E",
      },
    ],
  },
};

const STATE_MERGED = {
  version: 10,
  randomSeed: "861b75cf1f85459cb1986343091d322d",
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
        type: "folder",
        id: "11",
        title: "A",
      },
      {
        type: "expression",
        id: "13",
        folderId: "11",
        color: "#388c46",
        latex: "B",
      },
      {
        type: "expression",
        id: "14",
        folderId: "11",
        color: "#6042a6",
        latex: "C",
      },
      {
        type: "expression",
        id: "15",
        folderId: "11",
        color: "#000000",
        latex: "D",
      },
      {
        type: "expression",
        id: "16",
        folderId: "11",
        color: "#c74440",
        latex: "E",
      },
    ],
  },
};

testWithPage("Dump", async (driver) => {
  await driver.setState(STATE_FOLDER as any);
  await driver.enterEditListMode();
  await driver.click(".dsm-folder-dump-button");
  await driver.assertExprsList(STATE_DUMPED as any);

  await driver.clean();
  return clean;
});

testWithPage("Enclose", async (driver) => {
  await driver.setState(STATE_DUMPED as any);
  await driver.enterEditListMode();
  await driver.click(".dsm-note-enclose-button");
  await driver.assertExprsList(STATE_ENCLOSED as any);

  await driver.clean();
  return clean;
});

testWithPage("Merge", async (driver) => {
  await driver.setState(STATE_FOLDER as any);
  await driver.enterEditListMode();
  await driver.click(".dsm-folder-merge-button");
  await driver.assertExprsList(STATE_MERGED as any);

  await driver.clean();
  return clean;
});
