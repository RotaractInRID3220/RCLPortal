// The Figma frames are 1920x1080. On desktop each section renders a 16:9 "stage"
// whose children are positioned in design pixels converted to container-query
// units, so the composition scales 1:1 with the viewport width.
// The section must set `container-type: inline-size` (Tailwind: `@container`).

export const DESIGN_WIDTH = 1920

/** Design px -> cqw string (relative to the section's width). */
export const px = (n) => `${+(n / (DESIGN_WIDTH / 100)).toFixed(4)}cqw`

/** Absolute box in design coordinates. */
export const box = (left, top, width, height) => ({
  left: px(left),
  top: px(top),
  ...(width != null && { width: px(width) }),
  ...(height != null && { height: px(height) }),
})

/**
 * Visual centre line of the vertical "RCL 2026-27" rails on the 1920 stage
 * (rail box + the glyph offset inside Sakana's line box). Sparkles sit on this axis.
 */
export const RAIL_AXIS = { left: 71.5, right: 1848.5 }
export const RAIL_TOP = 421
export const SPARKLE_Y = 353
