import Image from 'next/image'
import LandingBackground from './LandingBackground'
import ShardCollage from './ShardCollage'
import StandingsTicker from './StandingsTicker'
import { EdgeRails, RailSparkles, SmallStar } from './Decor'
import { box, px } from './stage'

// Photo tiles of the "A GLIMPSE" collage (Group 3 in Figma).
// `crop` mirrors Figma's image-fill transform: image size + offset as % of the tile.
const TILES = [
  { id: 'r11', src: '/landing/glimpse-11.webp', alt: 'RCL athlete in action', x: 331, y: 191, w: 355, h: 190, crop: [552.06, 687.49, -161.87, -89.94] },
  { id: 'r12', src: '/landing/glimpse-11.webp', alt: '', x: 703, y: 191, w: 211, h: 190, crop: [978.83, 724.5, -469.31, -104.82], dodge: true },
  { id: 'r13', src: '/landing/glimpse-13.webp', alt: 'Tag rugby match at RCL', x: 928, y: 191, w: 433, h: 202, crop: [151.27, 216.11, -3.6, -49.35] },
  { id: 'r14', src: '/landing/glimpse-14.webp', alt: 'Cricket player at RCL', x: 1375, y: 191, w: 323, h: 202, crop: [113.24, 120.68, -6.81, 0], dodge: true },
  { id: 'r15', src: '/landing/glimpse-15.webp', alt: 'Batter playing a shot', x: 1034, y: 406, w: 219, h: 313, crop: [367.07, 171.18, -127.92, -52.6], dodge: true },
  { id: 'r16', src: '/landing/glimpse-16.webp', alt: 'Basketball game at RCL', x: 1269, y: 406, w: 429, h: 313, crop: [150.96, 137.9, -27.56, -12.38] },
  { id: 'r17', src: '/landing/glimpse-17.webp', alt: 'Table tennis player', x: 1153, y: 731, w: 325, h: 258, crop: [192.94, 161.99, -43.16, -35.49], dodge: true },
  { id: 'r18', src: '/landing/glimpse-18.webp', alt: 'Netball match at RCL', x: 1492, y: 731, w: 206, h: 258, crop: [221.11, 117.67, -67.21, -4.72], dodge: true },
  { id: 'main', src: '/landing/glimpse-main.webp', alt: 'Rugby player charging forward', x: 127, y: 392, w: 823, h: 597, crop: [132.08, 176.68, 8.63, -43.95] },
]

/** Tile positioned on the 1920x1080 stage, cropped exactly like the Figma fill. */
function StageTile({ src, alt, x, y, w, h, crop: [cw, ch, cl, ct], dodge, className = '', style }) {
  return (
    <div
      className={`absolute overflow-hidden ${dodge ? 'mix-blend-color-dodge' : ''} ${className}`}
      style={{ ...box(x, y, w, h), ...style }}
    >
      <Image unoptimized
        src={src}
        alt={alt}
        width={1600}
        height={1066}
        sizes={`${Math.ceil((w * cw) / 100 / 19.2)}vw`}
        className="absolute max-w-none"
        style={{ width: `${cw}%`, height: `${ch}%`, left: `${cl}%`, top: `${ct}%` }}
      />
    </div>
  )
}

function Tagline({ className = '', style }) {
  return (
    <p className={`font-sakana leading-[1.6] whitespace-nowrap text-white ${className}`} style={style}>
      <span className="text-[#00d9ff]">R</span>ecords. <span className="text-[#00d9ff]">C</span>hampions.{' '}
      <span className="text-[#00d9ff]">L</span>egends.
    </p>
  )
}


const pillShadow = 'shadow-[0_4px_11.9px_rgba(0,0,0,0.25)]'

export default function GlimpseSection() {
  return (
    <section
      id="glimpse"
      aria-labelledby="glimpse-title"
      className="@container relative flex min-h-svh w-full items-center overflow-hidden bg-[#0a1d2e] lg:min-h-0"
    >
      <LandingBackground watermarkClassName="text-white/50 opacity-35" mirror bottomFade seamTop />

      {/* ---------- Desktop: 1:1 Figma stage ---------- */}
      <div className="relative hidden aspect-[1920/1080] w-full lg:block">
        <EdgeRails />
        <RailSparkles />

        {TILES.map(({ id, ...t }) => (
          <StageTile key={id} {...t} />
        ))}

        <p
          aria-hidden
          className="absolute font-sakana leading-[1.6] text-white mix-blend-overlay select-none"
          style={{ ...box(955.63, 529, 800.735, 571), fontSize: px(369.71) }}
        >
          Rcl
        </p>

        {/* Cut-out player breaking out of the collage */}
        <div
          className="absolute overflow-hidden"
          style={{ ...box(759.73, 298, 359.538, 607), filter: `drop-shadow(${px(-25.105)} ${px(105.799)} ${px(24.119)} rgba(0,0,0,0.59))` }}
        >
          <Image unoptimized
            src="/landing/glimpse-cutout.webp"
            alt="Netball player dribbling the ball"
            width={1011}
            height={1365}
            sizes="34vw"
            className="absolute max-w-none"
            style={{ width: '177.5%', height: '141.95%', left: '-38%', top: '-21.42%' }}
          />
        </div>

        {/* Vertical title */}
        <div className="absolute flex items-center justify-center" style={box(66.63, 191, 228, 798)}>
          <h2
            id="glimpse-title"
            className="flex-none -rotate-90 font-sakana font-normal leading-[1.6] whitespace-nowrap text-white"
            style={{ fontSize: px(142.502) }}
          >
            A GLIMpSE
          </h2>
        </div>
        <div className="absolute flex items-center justify-center" style={box(248.45, 181.35, 58, 637)}>
          <Tagline className="flex-none -rotate-90" style={{ fontSize: px(36.269) }} />
        </div>

        {/* League pill */}
        <div
          className="absolute rounded-full bg-black/45 shadow-[0_4.744px_14.112px_rgba(0,0,0,0.69)] backdrop-blur-sm"
          style={box(1151, 364, 453, 57)}
        />
        <p className="absolute font-sakana leading-[1.6] whitespace-nowrap text-white" style={{ left: px(1174), top: px(371.33), fontSize: px(21.999) }}>
          ROTARACT CHAMPIONS LEAGUE
        </p>
        <SmallStar className="absolute" style={{ ...box(1559.75 + 1.234, 371 + 7.543, 17.474, 24.803) }} />

        {/* Standings crawl (replaces the "mokak hri methana danawad?" pill) */}
        <div className="absolute" style={box(532, 871, 903, 136)}>
          <StandingsTicker unit="calc(100cqw / 1500)" radius={px(47.5)} className="h-full" />
        </div>
        <span aria-hidden className="absolute h-px bg-white" style={box(436, 1007, 75)} />
        <span aria-hidden className="absolute h-px bg-white" style={box(1456, 1007, 75)} />
      </div>

      {/* ---------- Mobile / tablet: same merged collage, re-stacked ---------- */}
      <div className="relative w-full px-4 pt-16 pb-16 sm:px-10 sm:pt-20 lg:hidden">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <h2 className="font-sakana font-normal leading-[1.1] text-white text-[min(14vw,6.5rem)]">A GLIMpSE</h2>
            <Tagline className="mt-2 text-[min(4.8vw,2rem)]" />
          </div>

          {/* Shattered-glass poster collage */}
          <div className="mt-10">
            <ShardCollage />
          </div>

          <div className="mt-10">
            <StandingsTicker unit="min(calc(100cqw / 520), 1.1px)" radius="1.75rem" layout="col" />
          </div>
        </div>
      </div>
    </section>
  )
}
