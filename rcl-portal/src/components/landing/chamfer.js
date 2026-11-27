// Angular "broadcast" shapes shared by the hero status and the standings crawl.
// Top-left and bottom-right corners are cut at 45 degrees; no curves.

export const chamfer = (cut) =>
  `polygon(${cut} 0, 100% 0, 100% calc(100% - ${cut}), calc(100% - ${cut}) 100%, 0 100%, 0 ${cut})`

/** Same shape inset by `b` on every side, for the fill that sits inside a hairline outline. */
export const chamferInset = (cut, b) =>
  `polygon(calc(${cut} + ${b} * 0.414) ${b}, calc(100% - ${b}) ${b}, calc(100% - ${b}) calc(100% - ${cut} - ${b} * 0.414), calc(100% - ${cut} - ${b} * 0.414) calc(100% - ${b}), ${b} calc(100% - ${b}), ${b} calc(${cut} + ${b} * 0.414))`
