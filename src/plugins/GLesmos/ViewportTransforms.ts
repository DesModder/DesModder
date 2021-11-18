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
  mathToPixels: {
    tx: number;
    ty: number;
    sx: number;
    sy: number;
  };
  pixelsToMath: {
    tx: number;
    ty: number;
    sx: number;
    sy: number;
  };
}
