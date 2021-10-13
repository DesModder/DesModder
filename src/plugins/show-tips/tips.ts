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
    desc: "Pin (bookmark) commonly-used sliders and actions for easy access",
  },
  {
    desc: "Before starting a long capture, it's safest to test the beginning of an export",
  },
  {
    desc: "Find and Replace is great for renaming variables",
  },
  {
    desc: "Press Ctrl+Q to duplicate the current expression",
  },
  {
    desc: "Type Shift+Enter inside notes and folder titles for a newline",
  },
  {
    desc: "Click the yellow triangle (or type shift+enter) to fade a warning and hide sliders",
  },
  /* Desmos tips */
  {
    desc: 'Type `"` to quickly make a note or "folder" for a folder',
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
    desc: "To view a summmary of data, use the `histogram` or `stats` functions",
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
  /* Motivation */
  {
    desc: "You're doing great :)",
  },
];

export default tips;
