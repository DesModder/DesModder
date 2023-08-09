/*
HOW TO ADD NEW TIPS:
Go to the localization file (e.g. en.ftl for English) and add a new message
beginning with "show-tips-tip". Then, to make sure that your tip shows up
in the list, add the message WITHOUT the "show-tips-tip" part as a key of 
the object down below (it will be added automatically). If you want a 
"Learn More" link, simply add it as a value of the object. If you don't
want one, just put an empty string as the value.
*/

function hashString(str: string) {
  // We just want a simple constant ordering that's not the same as the source
  // Details don't matter. https://stackoverflow.com/a/8831937/7481517
  return Array.from(str).reduce(
    (hash, char) => 0 | (31 * hash + char.charCodeAt(0)),
    0
  );
}

export function getTipData() {
  return Object.entries({
    "export-videos": "",
    "disable-graphpaper": "",
    "paste-asciimath": "",
    pin: "",
    "long-video-capture": "",
    "find-replace": "",
    duplicate: "",
    "note-newline": "",
    "hide-errors": "",
    "note-folder": "",
    arctan: "https://www.desmos.com/calculator/beqk9rnxbl",
    "indefinite-integral": `https://help.desmos.com/hc/en-us/articles/4406810279693-Integrals`,
    random: `https://help.desmos.com/hc/en-us/articles/4405633253389-Statistics`,
    "two-argument-round": "https://www.desmos.com/calculator/wnm3fwctnf",
    "two-argument-sort": "https://www.desmos.com/calculator/ul4isx0qiz",
    "custom-colors": `https://help.desmos.com/hc/en-us/articles/4406795899533-Custom-Colors`,
    "ctrl-f": "",
    derivatives: `https://help.desmos.com/hc/en-us/articles/4406809433613-Derivatives`,
    "unbounded-list-slices": "https://www.desmos.com/calculator/4z0wllsipm",
    "dataviz-plots": `https://help.desmos.com/hc/en-us/articles/360022405991-Data-Visualizations`,
    statistics: `https://help.desmos.com/hc/en-us/articles/4405633253389-Statistics`,
    "table-draggable-points": "",
    polygon: `https://help.desmos.com/hc/en-us/articles/4405488514573-Polygons`,
    "point-arithmetic": "",
    "shift-drag": "",
    "action-ticker": `https://help.desmos.com/hc/en-us/articles/4407725009165`,
    "latex-copy-paste": "",
    "time-in-worker":
      "https://www.desmos.com/calculator/n37jppmozc?timeInWorker",
    "format-labels": `https://help.desmos.com/hc/en-us/articles/4405487300877-Labels`,
    "dynamic-labels": `https://help.desmos.com/hc/en-us/articles/4405487300877-Labels`,
    "disable-text-outline": "https://www.desmos.com/calculator/l8wm22nwkr",
    "regression-power": "https://www.desmos.com/calculator/vof10zrr5i",
    "spreadsheet-table": `https://help.desmos.com/hc/en-us/articles/4405489674381-Tables`,
    "keyboard-shortcuts": "",
    listcomps: `https://help.desmos.com/hc/en-us/articles/4407889068557-Lists`,
    "list-filters": "",
    bernard: "https://www.desmos.com/calculator/pbj6pw1kde",
    "new-desmos": `https://help.desmos.com/hc/en-us/articles/4405017454477-What-s-New-at-Desmos`,
    "simultaneous-actions": "https://www.desmos.com/calculator/v4feh9jgc8",
    "share-permalink": `https://help.desmos.com/hc/en-us/articles/4405901719309-Saving-and-Managing-Graphs`,
    "point-coordinate": "",
    audiotrace: "https://www.desmos.com/accessibility#audio-trace",
    "audiotrace-note-frequency": "",
    "audiotrace-range": "",
    "other-calculators": "https://www.desmos.com",
    "lock-viewport": `https://help.desmos.com/hc/en-us/articles/4405296853517-Graph-Settings`,
    glesmos: "",
    "disable-show-tips": "",
    "compact-view-multiline": "",
    intellisense: "",
    "youre-doing-great": "",
    "youre-superb": "",
    huggy: "",
  })
    .sort((a, b) => hashString(a[0]) - hashString(b[0]))
    .map(([ftlKey, learnMore]) => {
      return {
        tip: `show-tips-tip-${ftlKey}`,
        learnMore,
      };
    });
}
