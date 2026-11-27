import Image from 'next/image'

/**
 * "Shattered glass" poster collage for phone / tablet.
 * Six photo shards radiate from a glass medallion in the middle (think sports key-art: cracked
 * panels around a hero title). Coordinates live on a 100 x 130 stage and scale with the container.
 */
const H = 130
const y = (v) => +(v * 1.04).toFixed(2) // authored on a 100x125 grid

// Inner medallion (where the title sits) and the six shards around it.
const HOLE = [[30, y(45)], [52, y(36)], [72, y(42)], [76, y(60)], [62, y(76)], [40, y(72)], [26, y(62)]]

const SHARDS = [
  { id: 'rugby', src: '/landing/glimpse-13.webp', alt: 'Tag rugby at RCL', focus: [45, 45], poly: [[0, 0], [45, 0], [52, y(36)], [30, y(45)], [0, y(38)]] },
  { id: 'indoor', src: '/landing/glimpse-14.webp', alt: 'Indoor cricket at RCL', focus: [58, 38], poly: [[45, 0], [100, 0], [100, y(40)], [72, y(42)], [52, y(36)]] },
  { id: 'cricket', src: '/landing/glimpse-15.webp', alt: 'Batter playing a shot', focus: [50, 60], poly: [[100, y(40)], [100, y(85)], [62, y(76)], [76, y(60)], [72, y(42)]] },
  { id: 'basketball', src: '/landing/glimpse-16.webp', alt: 'Basketball at RCL', focus: [50, 32], poly: [[100, y(85)], [100, H], [55, H], [40, y(72)], [62, y(76)]] },
  { id: 'tabletennis', src: '/landing/glimpse-17.webp', alt: 'Table tennis at RCL', focus: [50, 34], poly: [[55, H], [0, H], [0, y(88)], [26, y(62)], [40, y(72)]] },
  { id: 'netball', src: '/landing/glimpse-18.webp', alt: 'Netball at RCL', focus: [52, 34], poly: [[0, y(88)], [0, y(38)], [30, y(45)], [26, y(62)]] },
]

const bbox = (poly) => {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return { x0, y0, w: x1 - x0, h: y1 - y0 }
}
const clip = (poly, b) =>
  `polygon(${poly.map(([px, py]) => `${(((px - b.x0) / b.w) * 100).toFixed(2)}% ${(((py - b.y0) / b.h) * 100).toFixed(2)}%`).join(', ')})`
const points = (poly) => poly.map((p) => p.join(',')).join(' ')

const holeBox = bbox(HOLE)

// width of each title line = --w, so the four lines are justified (font-size = width / em-width)
const LINES = [['ROTARACT', 5.4], ['CHAMPIONS', 6.487], ['LEAGUE', 4.047], ['2026-27', 4.285]]

export default function ShardCollage() {
  return (
    <div className="relative mx-auto w-full max-w-xl" style={{ aspectRatio: `100 / ${H}`, containerType: 'inline-size' }}>
      <div aria-hidden className="absolute -inset-3 rounded-[2rem] bg-[#00d9ff]/15 blur-2xl" />

      {/* photo shards */}
      {SHARDS.map(({ id, src, alt, focus: [fx, fy], poly }) => {
        const b = bbox(poly)
        return (
          <div
            key={id}
            className="absolute overflow-hidden"
            style={{
              left: `${b.x0}%`,
              top: `${(b.y0 / H) * 100}%`,
              width: `${b.w}%`,
              height: `${(b.h / H) * 100}%`,
              clipPath: clip(poly, b),
            }}
          >
            <Image
              unoptimized
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 768px) 70vw, 400px"
              className="object-cover"
              style={{ objectPosition: `${fx}% ${fy}%`, transform: 'scale(1.3)', transformOrigin: `${fx}% ${fy}%` }}
            />
            {/* cool blue grade so every shard sits in the RCL palette */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#0a4dd8]/30 via-transparent to-[#001a4d]/60" />
          </div>
        )
      })}

      {/* centre medallion */}
      <div
        aria-hidden
        className="absolute bg-[#04101e]/70 backdrop-blur-md"
        style={{
          left: `${holeBox.x0}%`,
          top: `${(holeBox.y0 / H) * 100}%`,
          width: `${holeBox.w}%`,
          height: `${(holeBox.h / H) * 100}%`,
          clipPath: clip(HOLE, holeBox),
        }}
      />

      {/* crack lines */}
      <svg
        aria-hidden
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ filter: 'drop-shadow(0 0 3px rgba(0,217,255,0.55))' }}
        fill="none"
      >
        {SHARDS.map(({ id, poly }) => (
          <polygon key={id} points={points(poly)} stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ))}
        <polygon points={points(HOLE)} stroke="#00d9ff" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <rect x="0" y="0" width="100" height={H} stroke="rgba(255,255,255,0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* title inside the medallion */}
      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center font-sakana leading-[0.8] text-white"
        style={{ left: '51%', top: `${((y(57)) / H) * 100}%`, '--w': '33cqw' }}
      >
        {LINES.map(([word, em], i) => (
          <span key={word} className={`block whitespace-nowrap ${i ? 'mt-[1cqw]' : ''} ${i > 1 ? 'text-[#00d9ff]' : ''}`} style={{ fontSize: `calc(var(--w) / ${em})` }}>
            {word}
          </span>
        ))}
      </div>
    </div>
  )
}
