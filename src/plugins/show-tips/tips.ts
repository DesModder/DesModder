export interface TipData {
  desc: string;
  learnMore?: string;
}

const tips: TipData[] = [
  /* DesModder features */
  {
    desc: "When exporting videos, prefer MP4 or APNG over GIF",
  },
  {
    desc: "Disabling graphpaper in Calculator Settings is useful for writing a sequence of equations",
  },
  {
    desc: "Paste ASCII Math directly into Desmos",
  },
  {
    desc: "Pin (bookmark) commonly-used expressions for easy access",
  },
  {
    desc: "Before starting a long video capture, it's safest to test the beginning of an export",
  },
  {
    desc: "Find and Replace is great for renaming variables",
  },
  {
    desc: "Press Ctrl+Q or Ctrl+Shift+Q to duplicate the current expression",
  },
  {
    desc: "Type Shift+Enter inside notes and folder titles for a newline",
  },
  {
    desc: "Click the yellow triangle (or type shift+enter) to fade a warning and hide sliders",
  },
  /* Desmos tips */
  {
    desc: 'Type " to quickly make a note or "folder" for a folder',
  },
  {
    desc: "Use arctan(y,x) instead of arctan(y/x) to get the angle of a point",
    learnMore: "https://www.desmos.com/calculator/beqk9rnxbl",
  },
  {
    desc: "Integrals can have infinite bounds",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4406810279693-Integrals",
  },
  {
    desc: "The random function can sample from a distribution",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4405633253389-Statistics",
  },
  {
    desc: "Two-argument round is great for rounding labels",
    learnMore: "https://www.desmos.com/calculator/wnm3fwctnf",
  },
  {
    desc: "Sort one list using keys of another list with sort(A,B)",
    learnMore: "https://www.desmos.com/calculator/ul4isx0qiz",
  },
  {
    desc: "Create custom colors and re-use them using variables",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4406795899533-Custom-Colors",
  },
  {
    desc: "Press Ctrl+F to search through expressions",
  },
  {
    desc: "Take derivatives using prime notation or Leibniz notation",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4406809433613-Derivatives",
  },
  {
    desc: "List slices do not have to be bounded",
    learnMore: "https://www.desmos.com/calculator/4z0wllsipm",
  },
  {
    desc: "To visualize data, you can use a histogram, boxplot, and more",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/360022405991-Data-Visualizations",
  },
  {
    desc: "Desmos has many built-in statistics functions",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4405633253389-Statistics",
  },
  {
    desc: "Use a table for a list of draggable points",
  },
  {
    desc: "Use the polygon function for easy polygons",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4405488514573-Polygons",
  },
  {
    desc: "Point (vector) arithmetic works as expected",
  },
  {
    desc: "Shift + mouse drag over an axis to scale only that axis",
  },
  {
    desc: "Use actions and tickers to run simulations",
    learnMore: "https://help.desmos.com/hc/en-us/articles/4407725009165",
  },
  {
    desc: "The math from Desmos can be directly copy-pasted into LaTeX editors",
  },
  {
    desc: "To test how fast your graph runs, use ?timeInWorker",
    learnMore: "https://www.desmos.com/calculator/n37jppmozc?timeInWorker",
  },
  {
    desc: "Use backticks to math-format point labels",
    learnMore: "https://help.desmos.com/hc/en-us/articles/4405487300877-Labels",
  },
  {
    // eslint-disable-next-line no-template-curly-in-string
    desc: "Use ${ } for dynamic point labels based on a variable",
    learnMore: "https://help.desmos.com/hc/en-us/articles/4405487300877-Labels",
  },
  {
    desc: "Disabling text outline can sometimes make labels more readable",
    learnMore: "https://www.desmos.com/calculator/l8wm22nwkr",
  },
  {
    // From SlimRunner
    desc: "Regressions are more powerful than you can imagine",
    learnMore: "https://www.desmos.com/calculator/vof10zrr5i",
  },
  {
    desc: "Paste spreadsheet data to make a table",
    learnMore: "https://help.desmos.com/hc/en-us/articles/4405489674381-Tables",
  },
  {
    desc: "Type Ctrl+/ or Cmd+/ to open the list of keyboard shortcuts",
  },
  {
    desc: "List comprehensions are great for grids of points or lists of polygons",
    learnMore: "https://help.desmos.com/hc/en-us/articles/4407889068557-Lists",
  },
  {
    desc: "List filters can be used to filter for positive elements, even elements, and more",
    learnMore: "https://www.desmos.com/calculator/acmvprhzba",
  },
  {
    desc: "Bernard",
    learnMore: "https://www.desmos.com/calculator/pbj6pw1kde",
  },
  {
    desc: "What's new at Desmos",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4405017454477-What-s-New-at-Desmos",
  },
  {
    desc: "Action assignments are simultaneous, not sequential",
    learnMore: "https://www.desmos.com/calculator/v4feh9jgc8",
  },
  {
    desc: "You can share graphs via permalink without signing in",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4405901719309-Saving-and-Managing-Graphs",
  },
  // From flexabrotnt
  {
    desc: "Extract the x or y coordinate of points by appending .x or .y to your point variable",
  },
  // From Ranny Bergamotte
  {
    desc: "Listen to your graphs using Audio Trace!",
    learnMore: "https://www.desmos.com/accessibility#audio-trace",
  },
  {
    desc: "Note frequencies for audio trace depend on how high or low they are located in the viewport",
  },
  {
    desc: "Audio Trace range starts on an E4 (329.63Hz) and ends on E5 (659.25Hz)",
  },
  {
    desc: "Desmos also has other calculators!",
    learnMore: "https://www.desmos.com",
  },
  {
    desc: "Don't want your viewport to be moved? Lock it in the graph settings!",
    learnMore:
      "https://help.desmos.com/hc/en-us/articles/4405296853517-Graph-Settings",
  },
  {
    desc: "Enable the GLesmos plugin to make some implicits run faster",
  },
  {
    desc: "Tired of seeing me? Disable show tips in the Desmodder settings",
  },
  /* Motivation */
  {
    desc: "You're doing great :)",
  },
  {
    desc: "You're superb <3",
  },
  {
    desc: "Huggy!",
  },
];

function hashString(str: string) {
  // We just want a simple constant ordering that's not the same as the source
  // Details don't matter. https://stackoverflow.com/a/8831937/7481517
  return Array.from(str).reduce(
    (hash, char) => 0 | (31 * hash + char.charCodeAt(0)),
    0
  );
}

tips.sort((a, b) => hashString(a.desc) - hashString(b.desc));

export default tips;
