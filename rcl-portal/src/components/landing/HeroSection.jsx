import Image from 'next/image'
import LandingBackground from './LandingBackground'
import HeroStatus from './HeroStatus'
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

export default function HeroSection() {
  return (
    <section
      id="home"
      aria-labelledby="hero-title"
      className="@container relative flex w-full items-center overflow-hidden bg-[#0a1d2e]"
    >
      <LandingBackground priority topShade seamBottom />

      {/* ---------- Desktop: 1:1 Figma stage ---------- */}
      <div className="relative hidden aspect-[1920/1080] w-full lg:block">
        <EdgeRails />
        <RailSparkles />

        <div className="absolute" style={box(831, 214, 257, 329.057)}>
          <Image unoptimized
            src="/rcl-white.png"
            alt="Rotaract Champions League 2026-27"
            fill
            priority
            sizes="14vw"
            className="object-contain"
          />
        </div>

        <h1 id="hero-title" className="font-sakana font-normal leading-[1.6] text-white/85">
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

        {/* season status: registration countdown / open notice / event countdown (replaces the dashed line) */}
        <div className="absolute" style={box(450, 904, 1020, 136)}>
          <HeroStatus unit="calc(100cqw / 1700)" className="h-full" />
        </div>
        <StageSparkle cx={385} cy={970} />
        <StageSparkle cx={1535} cy={970} />
      </div>

      {/* ---------- Mobile / tablet: big logo + four stacked title lines ---------- */}
      <div className="relative flex w-full flex-col items-center px-4 pt-24 pb-4 text-center sm:px-8 sm:pt-24 sm:pb-8 lg:hidden">
        <Sparkle className="absolute left-[5vw] top-[32svh] h-7 w-6 sm:h-9 sm:w-8" />
        <Sparkle className="absolute right-[5vw] top-[32svh] h-7 w-6 sm:h-9 sm:w-8" />

        <div className="relative aspect-[257/329] w-[46vw] max-w-[200px]">
          <Image
            unoptimized
            src="/rcl-white.png"
            alt="Rotaract Champions League 2026-27"
            fill
            priority
            sizes="(max-width: 1023px) 58vw, 340px"
            className="object-contain"
          />
        </div>

        {/* Each line's font-size = block width / its width in em, so all four lines are exactly as wide */}
        <h1
          className="mt-6 font-sakana font-normal leading-[0.8] text-white/85 sm:mt-10"
          style={{ '--w': 'min(88vw, 32rem)', width: 'var(--w)' }}
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

        {/* a container of its own, so the panel is always 700 units wide whatever the screen */}
        <div className="@container mt-8 w-full max-w-xl sm:mt-12">
          <HeroStatus unit="calc(100cqw / 700)" className="h-[calc(var(--u)*152)]" />
        </div>
      </div>
    </section>
  )
}
