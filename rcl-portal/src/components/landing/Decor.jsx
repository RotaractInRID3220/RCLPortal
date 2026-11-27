import { box, px, RAIL_AXIS, RAIL_TOP } from './stage'

/** Six-point sparkle used across the frames (68x70 design box, glyph inset 15.94% / 19.78%). */
export function Sparkle({ className = '', style }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 41.2222 47.6844"
      className={className}
      style={style}
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.8335 1.54616C19.122 -0.515379 22.1002 -0.51539 22.3886 1.54615L24.2123 14.5799C24.3748 15.7407 25.5882 16.4369 26.6723 15.9912L38.731 11.0342C40.6458 10.247 42.1517 12.7912 40.5405 14.0911L30.186 22.4453C29.2956 23.1637 29.2956 24.5207 30.186 25.2391L40.5405 33.5933C42.1517 34.8933 40.6458 37.4374 38.731 36.6503L26.6723 31.6932C25.5882 31.2475 24.3748 31.9437 24.2123 33.1046L22.3886 46.1383C22.1002 48.1998 19.122 48.1998 18.8335 46.1383L17.0098 33.1046C16.8474 31.9437 15.634 31.2475 14.5498 31.6932L2.49116 36.6503C0.576363 37.4374 -0.929555 34.8933 0.681679 33.5933L11.0361 25.2391C11.9266 24.5207 11.9266 23.1637 11.0361 22.4453L0.681686 14.0912C-0.929547 12.7912 0.576354 10.247 2.49115 11.0342L14.5498 15.9912C15.634 16.4369 16.8474 15.7407 17.0098 14.5799L18.8335 1.54616Z" />
    </svg>
  )
}

/** Sparkle centred on (cx, cy) of the 1920x1080 stage. */
export function StageSparkle({ cx, cy }) {
  return (
    <div className="absolute" style={box(cx - 34.1, cy - 35, 68.205, 70)}>
      <Sparkle className="absolute" style={{ inset: '15.94% 19.78%', width: '60.44%', height: '68.12%' }} />
    </div>
  )
}

/** Small four-point star (Star 3 in the glimpse pill). */
export function SmallStar({ className = '', style }) {
  return (
    <svg aria-hidden viewBox="0 0 17.4738 24.8032" className={className} style={style} fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.42235 1.1303C7.65079 -0.376769 9.82299 -0.376764 10.0514 1.1303L10.9635 7.14693C11.0225 7.53671 11.2516 7.88017 11.5887 8.08457L16.8336 11.2647C17.6872 11.7823 17.6872 13.0209 16.8336 13.5385L11.5887 16.7187C11.2516 16.9231 11.0225 17.2665 10.9635 17.6563L10.0514 23.673C9.82299 25.18 7.65079 25.18 7.42235 23.6729L6.51033 17.6563C6.45124 17.2665 6.22223 16.9231 5.88512 16.7187L0.640222 13.5385C-0.213407 13.0209 -0.213408 11.7823 0.640222 11.2647L5.88512 8.08457C6.22223 7.88017 6.45124 7.53671 6.51033 7.14693L7.42235 1.1303Z" />
    </svg>
  )
}

/** "RCL 2026-27 RCL 2026-27" rails running up the left and down the right edge. */
export function EdgeRails() {
  const text = 'RCL 2026-27 RCL 2026-27'
  const cls = 'font-sakana leading-[1.6] whitespace-nowrap text-white/50 select-none'
  return (
    <div aria-hidden>
      <div className="absolute flex items-center justify-center" style={box(30, RAIL_TOP, 73, 608)}>
        <p className={`${cls} -rotate-90 flex-none`} style={{ fontSize: px(45.721) }}>{text}</p>
      </div>
      <div className="absolute flex items-center justify-center" style={box(1816, RAIL_TOP, 73, 608)}>
        <p className={`${cls} rotate-90 flex-none`} style={{ fontSize: px(45.721) }}>{text}</p>
      </div>
    </div>
  )
}

/** The pair of sparkles that crown the rails (same axis as the rail glyphs). */
export function RailSparkles({ cy = 353 }) {
  return (
    <>
      <StageSparkle cx={RAIL_AXIS.left} cy={cy} />
      <StageSparkle cx={RAIL_AXIS.right} cy={cy} />
    </>
  )
}
