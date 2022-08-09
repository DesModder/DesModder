export const configList = [
    {
      key: "showExpressionsHeatmap",
      name: "Show Updated Expressions Heatmap",
      description:
        "Displays a heatmap in the sidebar of the most frequently re-evaluated expressions.",
      type: "boolean",
      default: false,
    },
    // `as const` ensures that the key values can be used as types
    // instead of the type 'string'
  ] as const;
  
  export interface Config {
    showExpressionsHeatmap: boolean;
  }
  