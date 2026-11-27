import Image from 'next/image'
import LandingBackground from './LandingBackground'
import { EdgeRails, RailSparkles, Sparkle, StageSparkle } from './Decor'
import { box, px } from './stage'

/** Frosted glass lens that smears the title edges (Ellipse 1 / 2 in Figma). */
function GlassLens({ x, y }) {
  return (
    <div aria-hidden className="absolute flex items-center justify-center" style={box(x, y, 227.217, 139.45)}>
      <div
        className="flex-none rotate-[-23.85deg] rounded-[50%] border border-white/40"
        style={{
          width: px(225),
          height: px(53),
          backdropFilter: `blur(${px(5)})`,
          WebkitBackdropFilter: `blur(${px(5)})`,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.55)',
        }}
      />
    </div>
  )
}

function DashedRule({ className = '', style }) {
  return (
    <svg aria-hidden viewBox="0 0 797.003 15" preserveAspectRatio="none" className={className} style={style} fill="none">
      <path
        d="M7.5 7.5H25.2728M789.503 7.5H771.73M60.8184 7.5H96.3639M131.909 7.5H167.455M203.001 7.5H238.546M274.092 7.5H309.637M345.183 7.5H380.728M416.274 7.5H451.82M487.365 7.5H522.911M558.456 7.5H594.002M629.548 7.5H665.093M700.639 7.5H736.184"
        strokeWidth="15"
        strokeLinecap="square"
        stroke="white"
      />
    </svg>
  )
}

export default function HeroSection() {
  return (
    <section
      id="home"
      aria-labelledby="hero-title"
      className="@container relative flex min-h-svh w-full items-center overflow-hidden bg-[#0a1d2e] lg:min-h-0"
    >
      <LandingBackground priority topShade seamBottom />

      {/* ---------- Desktop: 1:1 Figma stage ---------- */}
      <div className="relative hidden aspect-[1920/1080] w-full lg:block">
        <EdgeRails />
        <RailSparkles />

        <div className="absolute" style={box(831, 214, 257, 329.057)}>
          <Image unoptimized
            src="/landing/rcl-logo-white.webp"
            alt="Rotaract Champions League 2026-27"
            fill
            priority
            sizes="14vw"
            className="object-contain"
          />
        </div>

        <h1 id="hero-title" className="font-sakana font-normal leading-[1.6] text-white">
          <span
            className="absolute whitespace-nowrap"
            style={{ left: px(335.81), top: px(559.78), fontSize: px(102.835) }}
          >
            ROTARACT CHAMPIONS
          </span>
          <span
            className="absolute whitespace-nowrap"
            style={{ left: px(141), top: px(613.82), fontSize: px(190.649) }}
          >
            LEAGUE 2026-27
          </span>
        </h1>

        <GlassLens x={119} y={761} />
        <GlassLens x={1454} y={595} />

        <DashedRule className="absolute" style={{ ...box(562, 942.5, 797, 15), transform: 'rotate(0.15deg)' }} />
        {/* centred on the dashed rule (y = 950) */}
        <StageSparkle cx={519} cy={950} />
        <StageSparkle cx={1402} cy={950} />
      </div>

      {/* ---------- Mobile / tablet: big logo + four stacked title lines ---------- */}
      <div className="relative flex w-full flex-col items-center px-4 pt-28 pb-12 text-center sm:px-8 sm:pt-24 lg:hidden">
        <Sparkle className="absolute left-[5vw] top-[32svh] h-7 w-6 sm:h-9 sm:w-8" />
        <Sparkle className="absolute right-[5vw] top-[32svh] h-7 w-6 sm:h-9 sm:w-8" />

        <div className="relative aspect-[257/329] w-[58vw] max-w-[280px]">
          <Image
            unoptimized
            src="/landing/rcl-logo-white.webp"
            alt="Rotaract Champions League 2026-27"
            fill
            priority
            sizes="(max-width: 1023px) 58vw, 340px"
            className="object-contain"
          />
        </div>

        {/* Each line's font-size = block width / its width in em, so all four lines are exactly as wide */}
        <h1
          className="mt-8 font-sakana font-normal leading-[0.8] text-white sm:mt-10"
          style={{ '--w': 'min(88vw, 40rem)', width: 'var(--w)' }}
        >
          {[
            ['ROTARACT', 5.4, ''],
            ['CHAMPIONS', 6.487, 'mt-[0.9vw]'],
            ['LEAGUE', 4.047, 'mt-[1.4vw]'],
            ['2026-27', 4.285, 'mt-[1.4vw]'],
          ].map(([word, em, gap]) => (
            <span key={word} className={`block whitespace-nowrap ${gap}`} style={{ fontSize: `calc(var(--w) / ${em})` }}>
              {word}
            </span>
          ))}
        </h1>

        <div className="mt-9 flex w-full max-w-xl items-center justify-center gap-3 sm:mt-12">
          <Sparkle className="h-6 w-5 flex-none" />
          <DashedRule className="h-2 w-full" />
          <Sparkle className="h-6 w-5 flex-none" />
        </div>
      </div>
    </section>
  )
}
