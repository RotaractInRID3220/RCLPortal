import Image from 'next/image'
import { px } from './stage'

/**
 * Shared layered background of the RCL 2026-27 frames:
 * grain texture -> light-streak overlay -> giant "RCL" watermark -> blue grunge photo + shading.
 * Everything is `object-cover`, so it fills sections of any aspect ratio.
 *
 * Seamless stacking: give the lower section `mirror` so its image layers are flipped
 * vertically — its top edge is then pixel-identical to the bottom edge of the section above.
 */
export default function LandingBackground({
  watermarkClassName = 'text-white/20',
  priority = false,
  mirror = false,
  topShade = false,
  bottomFade = false,
  seamTop = false, // dissolve into the section above
  seamBottom = false, // dissolve into the section below
}) {
  const flip = mirror ? '-scale-y-100' : ''
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0a1d2e]">
      {/* image 3 — texture (-185,-79.5  2105x1183) */}
      <div className={`absolute inset-0 ${flip}`}>
        <div className="absolute" style={{ inset: '-7.36% 0 -2.18% -9.64%' }}>
          <Image unoptimized src="/landing/bg-texture.webp" alt="" fill sizes="110vw" priority={priority} className="object-cover" />
        </div>

        {/* image 4 — light streaks, 56% */}
        <div className="absolute opacity-56" style={{ inset: '-10.42% -2.45% -11% 0' }}>
          <Image unoptimized src="/landing/bg-overlay.webp" alt="" fill sizes="103vw" className="object-cover" />
        </div>
      </div>

      {/* RCL watermark */}
      <p
        className={`absolute font-sakana leading-[1.6] whitespace-nowrap select-none ${watermarkClassName}`}
        style={{ left: px(97), top: px(-62), fontSize: px(1019.102) }}
      >
        RCL
      </p>
      <p
        className={`absolute font-sakana leading-[1.6] whitespace-nowrap select-none mix-blend-screen ${watermarkClassName}`}
        style={{ left: px(-250), top: px(-744), fontSize: px(988.636) }}
      >
        RCL
      </p>

      {/* image 2 — blue grunge photo, 57% + shading */}
      <div className="absolute inset-0">
        <div className={`absolute inset-0 ${flip}`}>
          <Image unoptimized src="/landing/bg-photo.webp" alt="" fill sizes="100vw" priority={priority} className="object-cover opacity-57" />
        </div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), linear-gradient(rgba(0,18,79,0.14), rgba(0,18,79,0.14))',
          }}
        />
        {topShade && (
          <div className="absolute inset-x-0 top-0 h-[39%] bg-gradient-to-b from-black/35 to-transparent" />
        )}
        {seamTop && <div className="absolute inset-x-0 top-0 h-[clamp(6rem,20%,14rem)] bg-gradient-to-b from-[#050d18] via-[#0a1d2e]/60 to-transparent" />}
        {seamBottom && <div className="absolute inset-x-0 bottom-0 h-[clamp(6rem,20%,14rem)] bg-gradient-to-t from-[#050d18] via-[#0a1d2e]/60 to-transparent" />}
        {bottomFade && (
          <div className="absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black to-transparent" />
        )}
      </div>
    </div>
  )
}
