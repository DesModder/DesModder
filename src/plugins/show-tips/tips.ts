import { currentLanguage, getMessageNames } from "i18n/i18n-core";

/*
HOW TO ADD NEW TIPS:
Go to the localization file (e.g. en.ftl for English) and add a new message
beginning with "show-tips-tip". These will automatically be added to the selection of tips.
To add a "learn more" link, simply add it to the table below.
*/

function hashString(str: string) {
  // We just want a simple constant ordering that's not the same as the source
  // Details don't matter. https://stackoverflow.com/a/8831937/7481517
  return Array.from(str).reduce(
    (hash, char) => 0 | (31 * hash + char.charCodeAt(0)),
    0
  );
}

export function getTipData(): {
  tipKeys: string[];
  learnMore: Record<string, string | undefined>;
} {
  return {
    tipKeys: getMessageNames(/^show-tips-tip/g).sort(
      (a, b) => hashString(a) - hashString(b)
    ),
    learnMore: {
      "show-tips-tip-arctan": "https://www.desmos.com/calculator/beqk9rnxbl",
      "show-tips-tip-indefinite-integral": `https://help.desmos.com/hc/${currentLanguage()}/articles/4406810279693-Integrals`,
      "show-tips-tip-random": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405633253389-Statistics`,
      "show-tips-tip-two-argument-round":
        "https://www.desmos.com/calculator/wnm3fwctnf",
      "show-tips-tip-two-argument-sort":
        "https://www.desmos.com/calculator/ul4isx0qiz",
      "show-tips-tip-custom-colors": `https://help.desmos.com/hc/${currentLanguage()}/articles/4406795899533-Custom-Colors`,
      "show-tips-tip-derivatives": `https://help.desmos.com/hc/${currentLanguage()}/articles/4406809433613-Derivatives`,
      "show-tips-tip-unbounded-list-slices":
        "https://www.desmos.com/calculator/4z0wllsipm",
      "show-tips-tip-dataviz-plots": `https://help.desmos.com/hc/${currentLanguage()}/articles/360022405991-Data-Visualizations`,
      "show-tips-tip-statistics": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405633253389-Statistics`,
      "show-tips-tip-polygon": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405488514573-Polygons`,
      "show-tips-tip-action-ticker": `https://help.desmos.com/hc/${currentLanguage()}/articles/4407725009165`,
      "show-tips-tip-time-in-worker":
        "https://www.desmos.com/calculator/n37jppmozc?timeInWorker",
      "show-tips-tip-format-labels": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405487300877-Labels`,
      "show-tips-tip-dynamic-labels": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405487300877-Labels`,
      "show-tips-tip-disable-text-outline":
        "https://www.desmos.com/calculator/l8wm22nwkr",
      "show-tips-tip-regression-power":
        "https://www.desmos.com/calculator/vof10zrr5i",
      "show-tips-tip-spreadsheet-table": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405489674381-Tables`,
      "show-tips-tip-listcomps": `https://help.desmos.com/hc/${currentLanguage()}/articles/4407889068557-Lists`,
      "show-tips-tip-bernard": "https://www.desmos.com/calculator/pbj6pw1kde",
      "show-tips-tip-new-desmos": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405017454477-What-s-New-at-Desmos`,
      "show-tips-tip-simultaneous-actions":
        "https://www.desmos.com/calculator/v4feh9jgc8",
      "show-tips-tip-share-permalink": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405901719309-Saving-and-Managing-Graphs`,
      "show-tips-tip-audiotrace":
        "https://www.desmos.com/accessibility#audio-trace",
      "show-tips-tip-other-calculators": "https://www.desmos.com",
      "show-tips-tip-lock-viewport": `https://help.desmos.com/hc/${currentLanguage()}/articles/4405296853517-Graph-Settings`,
    },
  };
}
