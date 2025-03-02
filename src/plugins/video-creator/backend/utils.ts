interface Bounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scales x coordinates by a factor of xr about center, and
 * scales y coordinates by a factor of yr about center.
 */
export function scaleBoundsAboutCenter(b: Bounds, xr: number, yr: number) {
  const dx = (b.right - b.left) * ((xr - 1) / 2);
  const dy = (b.top - b.bottom) * ((yr - 1) / 2);
  // After this, `right - left` becomes `(b.right - b.left) - 2 * dx`
  // which equals `(b.right - b.left) * (xr - 1 + 1)`.
  return {
    left: b.left - dx,
    right: b.right + dx,
    top: b.top + dy,
    bottom: b.bottom - dy,
  };
}
