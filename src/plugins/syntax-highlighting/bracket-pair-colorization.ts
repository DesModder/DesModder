export function generateBracketPairColorizationCSS(
  colors: [number, number, number][],
  colorInText: boolean,
  thickenBrackets: number
) {
  const colorMaker = `rgb(${[0, 1, 2]
    .map(
      (i) =>
        `calc(${
          colors
            .map((col, colindex) => {
              const channel = col[i];
              // Uses the periodic nature of mod to only color every Nth bracket a given color

              // All colors are multiplied by this "mod factor" and then added together
              // to only "pick" the correct color.

              return `${channel} * pow(0, mod(var(--bracket-depth2) - ${colindex}, ${colors.length}))`;
            })
            .join(" + ") ?? 0
        })`
    )
    .join(", ")})`;

  return [
    /*
      Colorization exceptions:

      - Children of a \textcolor{} or base case in label or expression
      - Standalone commas like in `(0,0),(1,2)`
        Otherwise they would get the color of the first color in the list.
    */
    `
    .dcg-mq-root-block {
      --bracket-depth1: 0;
      --bracket-depth2: 0;

      .dcg-mq-bracket-container {
        --bracket-depth2: var(--bracket-depth1);

        &:not(.dcg-mq-textcolor *, .dcg-base-case-btn *) {
          .dcg-mq-paren,
          .dsm-mq-syntax-comma,
          *${colorInText ? "" : ":not(.dcg-mq-bracket-middle, .dcg-mq-bracket-middle *)"} {
            color: ${colorMaker};
          }
        }

        .dcg-mq-paren path {
          stroke-width: ${thickenBrackets}%;
          stroke: currentColor;
        }

        .dcg-mq-bracket-middle {
          --bracket-depth1: calc(var(--bracket-depth2) + 1);
        }
      }
    }
    `,
  ];
}
