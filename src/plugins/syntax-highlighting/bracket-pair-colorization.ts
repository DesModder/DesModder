import { Config } from "./config";

// assumes valid input;
function hex2rgb(hex: string) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ] as const;
}

export function generateBracketPairColorizationCSS(settings: Config) {
  const {
    bracketPairColorizationColors: bpcColors,
    bpcColorInText: colorInText,
    thickenBrackets,
  } = settings;

  const colors = bpcColors.map(hex2rgb);

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

  /*
    Colorization exceptions:

    - Children of a \textcolor{} or base case in label or expression
    - Standalone commas like in `(0,0),(1,2)`
      Otherwise they would get the color of the first color in the list.
  */
  return `
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
    `;
}
