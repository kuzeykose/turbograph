import {
  backingStoreSize,
  cssPixelSize,
  syncCanvasBackingStore,
} from "@/components/graph/canvas-backing-store";

describe("cssPixelSize", () => {
  it("uses integer clientWidth/clientHeight rather than subpixel rects", () => {
    const el = {
      clientWidth: 901,
      clientHeight: 550,
    } as unknown as Element;
    expect(cssPixelSize(el)).toEqual({ width: 901, height: 550 });
  });
});

describe("backingStoreSize", () => {
  it("rounds CSS pixels through the device pixel ratio", () => {
    expect(backingStoreSize(900, 550, 2)).toEqual({ width: 1800, height: 1100 });
  });

  it("stays stable under a fractional DPR instead of oscillating", () => {
    // 125% Windows scaling: 901 * 1.25 = 1126.25, which must pick one integer
    // and keep it, otherwise canvas.width flips between 1126 and 1127 and
    // clears the WebGL buffer every frame.
    expect(backingStoreSize(901, 550, 1.25)).toEqual({
      width: 1126,
      height: 688,
    });
    expect(backingStoreSize(901, 550, 1.25)).toEqual({
      width: 1126,
      height: 688,
    });
  });

  it("never reports a zero backing store", () => {
    expect(backingStoreSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});

describe("syncCanvasBackingStore", () => {
  it("assigns the drawing buffer on the first size and is a no-op after", () => {
    const canvas = document.createElement("canvas");
    const writes: Array<[number, number]> = [];
    Object.defineProperty(canvas, "width", {
      configurable: true,
      get() {
        return this._w ?? 300;
      },
      set(value: number) {
        writes.push([value, this._h ?? 150]);
        this._w = value;
      },
    });
    Object.defineProperty(canvas, "height", {
      configurable: true,
      get() {
        return this._h ?? 150;
      },
      set(value: number) {
        writes.push([this._w ?? 300, value]);
        this._h = value;
      },
    });

    expect(syncCanvasBackingStore(canvas, 900, 550, 2)).toBe(true);
    const afterFirst = writes.length;
    expect(afterFirst).toBeGreaterThan(0);

    expect(syncCanvasBackingStore(canvas, 900, 550, 2)).toBe(false);
    expect(writes.length).toBe(afterFirst);
  });

  it("does not touch a zero-sized box, so layout-not-ready frames stay blank once", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    expect(syncCanvasBackingStore(canvas, 0, 0, 2)).toBe(false);
    expect(canvas.width).toBe(16);
    expect(canvas.height).toBe(16);
  });
});
