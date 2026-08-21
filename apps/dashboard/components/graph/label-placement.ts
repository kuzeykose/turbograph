/**
 * How node names are sized and trimmed to the card they belong to.
 *
 * Two things are in tension here. Names drawn in graph space shrink with the
 * cards, so a zoomed-out graph carried names a pixel tall — drawn, but unread.
 * Names drawn at a fixed screen size stay legible but outgrow the card they
 * name, and a name wider than its own card reads as belonging to whatever it
 * overhangs. This settles it by letting the type follow the card down to the
 * smallest size still worth reading, and cutting the name to the width the card
 * actually has: what is shown is always readable, and always inside the node it
 * names. Where the card is too small to hold even a few characters, nothing is
 * drawn — a two-letter stub over a mark says less than the mark alone.
 */

/** Card padding a name stays inside, in graph units. */
const CARD_PAD = 12;

/** Average glyph advance of the UI sans stack at weight 600, over its size. */
const CHAR_RATIO = 0.58;

/** Below this many characters a name is a stub rather than a name. */
const MIN_CHARS = 3;

/** Sublines are card detail, and need more room again than the name does. */
export const SUBLABEL_MIN_SCALE = 0.75;

const LABEL_FONT_PX = 11;
const SUBLABEL_FONT_PX = 9;

/**
 * Floors on how small the type may go, in screen pixels.
 *
 * The name follows the card down so that a small node still says what it is,
 * rather than holding a size the card cannot hold and going blank. It stops
 * here, where the difference between two names stops being visible at all.
 */
const LABEL_MIN_FONT_PX = 7;
const SUBLABEL_MIN_FONT_PX = 6.5;

/** Name size at a given zoom: it follows the card, within both floors. */
export function labelFontPx(scale: number): number {
  return Math.max(LABEL_MIN_FONT_PX, LABEL_FONT_PX * scale);
}

export function sublabelFontPx(scale: number): number {
  return Math.max(SUBLABEL_MIN_FONT_PX, SUBLABEL_FONT_PX * scale);
}

/** Width a name has to live in, in screen pixels. */
export function labelRoom(scale: number, cardWidth: number): number {
  return (cardWidth - CARD_PAD) * scale;
}

/**
 * Baselines for the two lines, as offsets from the centre of the card.
 *
 * A name with a subline under it sits above centre to leave the subline room.
 * A name on its own is centred, which is what a card too small for a subline
 * needs: at that size two pixels of offset is a visible lean.
 */
export function labelBaselines(
  fontPx: number,
  withSubline: boolean,
): { name: number; subline: number } {
  return withSubline
    ? { name: -fontPx * 0.18, subline: fontPx * 0.95 }
    : { name: fontPx * 0.35, subline: 0 };
}

/**
 * The part of a name that fits `room`, or `null` if too little of it would.
 *
 * Estimated rather than measured: this runs per node per frame, and a graph
 * with twenty thousand of them cannot afford `measureText` on each. Callers
 * pass `room` to `fillText` as well, so an estimate that runs a little long is
 * caught there instead of overhanging the card.
 */
export function fitLabel(
  text: string,
  fontPx: number,
  room: number,
): string | null {
  const maxChars = Math.floor(room / (fontPx * CHAR_RATIO));
  if (maxChars < MIN_CHARS) return null;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}
