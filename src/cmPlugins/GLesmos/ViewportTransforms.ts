export default interface ViewportTransforms {
  viewport: {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
  };
  mathCoordinates: {
    left: number;
    right: number;
    bottom: number;
    top: number;
  };
  pixelCoordinates: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  pixelsToMath: {
    xScale: {
      type: "linear" | "log";
      s: number;
      t: number;
    };
    yScale: {
      type: "linear" | "log";
      s: number;
      t: number;
    };
  };
}
