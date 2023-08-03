import { toggleRules } from ".";

export function generateBracketPairColorizationCSS(
  colors: [number, number, number][],
  colorInText: boolean
) {
  //   const colors = [
  //     [192, 96, 0],
  //     [0, 192, 96],
  //     [96, 0, 192],
  //   ];

  const colorMaker = `rgb(${colors[0]
    .map((e, i) => {
      return `calc(${colors
        .map((col, colindex) => {
          const channel = col[i];
          return `${channel} * max(0, cos(
            2 * 3.14159265358979323 * (var(--test2) - ${colindex}) / ${colors.length}
            ))`;
        })
        .join(" + ")})`;
    })
    .join(", ")})`;

  return [
    `
    .dcg-mq-root-block {
        --test1: 0;
        --test2: 0;
    }
    `,
    `
    .dcg-mq-bracket-container {
        --test2: var(--test1);
        color: ${colorMaker}
    }
    `,
    `
    .dcg-mq-bracket-middle {
        --test1: calc(var(--test2) + 1);
        ${colorInText ? "" : "color: black;"}
    }
    `,
  ];
}
