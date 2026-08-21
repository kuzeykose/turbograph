import {
  fitLabel,
  labelBaselines,
  labelFontPx,
  labelRoom,
  sublabelFontPx,
} from "@/components/graph/label-placement";
import { GRAPH_NODE_CARD } from "@workspace/graph";

const roomAt = (scale: number) => labelRoom(scale, GRAPH_NODE_CARD.width);

describe("labelFontPx", () => {
  it("follows the card it sits on", () => {
    expect(labelFontPx(2)).toBeCloseTo(22);
    expect(labelFontPx(1)).toBeCloseTo(11);
    expect(labelFontPx(0.75)).toBeLessThan(labelFontPx(1));
  });

  it("shrinks with a small node so the name still fits inside it", () => {
    // The point of following the card down: a smaller card holds more of the
    // name at a smaller size than it would at a size fixed to the screen.
    const room = roomAt(0.25);
    expect(fitLabel("index.ts", labelFontPx(0.25), room)).not.toBeNull();
  });

  it("stops shrinking where one name stops looking like another", () => {
    expect(labelFontPx(0.05)).toBeGreaterThanOrEqual(7);
    expect(labelFontPx(0.2)).toBeGreaterThanOrEqual(7);
  });
});

describe("sublabelFontPx", () => {
  it("follows the card the same way the name does", () => {
    expect(sublabelFontPx(1)).toBeCloseTo(9);
    expect(sublabelFontPx(0.8)).toBeLessThan(sublabelFontPx(1));
  });

  it("stays under the name it sits below", () => {
    expect(sublabelFontPx(1)).toBeLessThan(labelFontPx(1));
    expect(sublabelFontPx(0.8)).toBeLessThan(labelFontPx(0.8));
  });

  it("has a floor of its own", () => {
    expect(sublabelFontPx(0.05)).toBeGreaterThanOrEqual(6);
  });
});

describe("labelBaselines", () => {
  it("lifts the name off centre to leave the subline room", () => {
    const { name, subline } = labelBaselines(11, true);
    expect(name).toBeLessThan(0);
    expect(subline).toBeGreaterThan(0);
  });

  it("centres a name that has no subline under it", () => {
    // At a small size two pixels of offset is a visible lean, so the offset
    // has to follow the type rather than stay fixed.
    const small = labelBaselines(7, false);
    const large = labelBaselines(22, false);
    expect(small.name).toBeLessThan(large.name);
    expect(small.name).toBeGreaterThan(0);
  });
});

describe("labelRoom", () => {
  it("gives a name the card it belongs to, less its padding", () => {
    expect(roomAt(1)).toBeLessThan(GRAPH_NODE_CARD.width);
    expect(roomAt(1)).toBeGreaterThan(GRAPH_NODE_CARD.width - 20);
  });

  it("shrinks with the card", () => {
    expect(roomAt(0.5)).toBeCloseTo(roomAt(1) / 2);
  });
});

describe("fitLabel", () => {
  it("leaves a name alone when the card can take all of it", () => {
    expect(fitLabel("index.ts", 11, roomAt(1))).toBe("index.ts");
  });

  it("cuts a name to the card rather than letting it overhang", () => {
    const fitted = fitLabel("a-very-long-package-name.tsx", 12, roomAt(1));
    expect(fitted).not.toBeNull();
    expect(fitted!.length).toBeLessThan("a-very-long-package-name.tsx".length);
    expect(fitted!.endsWith("…")).toBe(true);
  });

  it("keeps what it shows inside the room it was given", () => {
    const fontPx = 12;
    const room = roomAt(0.7);
    const fitted = fitLabel("a-very-long-package-name.tsx", fontPx, room)!;
    expect(fitted.length * fontPx * 0.58).toBeLessThanOrEqual(room);
  });

  it("says nothing where a card can only hold a stub", () => {
    // A two-letter fragment over a five-pixel mark says less than the mark.
    expect(fitLabel("index.ts", 7, roomAt(0.05))).toBeNull();
  });

  it("shows more of a name the further in the graph is zoomed", () => {
    const name = "a-very-long-package-name.tsx";
    const near = fitLabel(name, 12, roomAt(1))!;
    const far = fitLabel(name, 11, roomAt(0.6))!;
    expect(near.length).toBeGreaterThan(far.length);
  });
});
