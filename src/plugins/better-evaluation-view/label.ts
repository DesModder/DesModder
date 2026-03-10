import { LabelOptionsBase, Private } from "#globals";

const labelOptions = {
  smallCutoff: 0.00001,
  bigCutoff: 1000000,
  digits: 5,
  displayAsFraction: false,
} satisfies LabelOptionsBase;

const { Label } = Private.Mathtools;

const withUprightUndefined =
  <T, R extends unknown[]>(
    format: (label: T, labelOptions: LabelOptionsBase, ...rest: R) => string,
    opts?: LabelOptionsBase,
    ...rest: R
  ) =>
  (label: T) => {
    const formatted = format(label, opts ?? labelOptions, ...rest);
    return formatted === "undefined" ? "\\mathrm{undefined}" : formatted;
  };

export const complexNumberLabel = withUprightUndefined(
  Label.complexNumberLabel
);
export const pointLabel = withUprightUndefined(Label.pointLabel);
export const point3dLabel = withUprightUndefined(Label.point3dLabel);
export const truncatedLatexLabel = withUprightUndefined(
  Label.truncatedLatexLabel
);
