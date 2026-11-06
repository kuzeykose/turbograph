/**
 * Integer CSS box of an element, used to decide whether a canvas actually
 * resized.
 *
 * `getBoundingClientRect` reports subpixels that jitter by fractions of a
 * device pixel. Treating those as a resize assigns `canvas.width`, which
 * clears the drawing buffer and flashes a blank frame — visible as flicker
 * on the WebGL imports graph, where a paint is already expensive.
 */
export function cssPixelSize(el: Element): { width: number; height: number } {
  return { width: el.clientWidth, height: el.clientHeight };
}

/** Backing-store size in device pixels for a CSS box. */
export function backingStoreSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): { width: number; height: number } {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}

/**
 * Match a canvas's drawing buffer to its CSS box. Returns whether the buffer
 * was resized — and therefore cleared by the browser.
 */
export function syncCanvasBackingStore(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): boolean {
  if (cssWidth <= 0 || cssHeight <= 0) return false;
  const { width, height } = backingStoreSize(cssWidth, cssHeight, dpr);
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}
