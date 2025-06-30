export function generateBracketPairColorizationCSS(
  colors: [number, number, number][],
  colorInText: boolean,
  thickenBrackets: number
) {
  if (!colors[0]) return [];

  const colorMaker = `rgb(${colors[0]
    .map(
      (_, i) =>
        `calc(${colors
          .map((col, colindex) => {
            const channel = col[i];
            // Uses the periodic nature of cosine to only color every Nth bracket a given color

            // All colors are multiplied by this "cosine factor" and then added together
            // to only "pick" the correct color.

            // The "max(0, 10000 * cos(whatever) - 9999)" thing is done to *only* pick
            // values where cosine is 1 (i.e. where bracketdepth - index = 0)

            // I'm not using better options like abs() or mod() due to browser compatibility
            return `${channel} * max(0, 10000 * cos(
            2 * 3.14159265358979323 * (var(--bracket-depth2) - ${colindex}) / ${colors.length}
            ) - 9999)`;
          })
          .join(" + ")})`
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
