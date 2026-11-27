import Image from 'next/image'
import Link from 'next/link'
import ThemeScope from '@/components/ThemeScope'
import PageBackground from '@/components/landing/PageBackground'

export const metadata = { title: 'Page not found - RCL' }

export default function NotFound() {
  return (
    <ThemeScope>
      <PageBackground />
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
        <Image src="/rcl-white.png" alt="RCL" width={120} height={152} className="mb-6 h-24 w-auto object-contain" priority />

        <div className="font-sakana leading-none text-white/90 text-[7rem] sm:text-[10rem] lg:text-[13rem]">
          4<span className="text-cranberry">0</span>4
        </div>

        <h1 className="mt-2 font-sakana text-3xl tracking-wide text-white sm:text-5xl">Page not found</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
          This page wandered off the field. Check the address, or head back to the action.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-md bg-cranberry px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Back to home
          </Link>
          <Link
            href="/e-arena/leaderboard"
            className="rounded-md border border-white/30 bg-white/[0.07] px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/15"
          >
            Leaderboard
          </Link>
        </div>

        <p className="mt-16 text-sm text-white/40">© {new Date().getFullYear()} Rotaract in RID 3220</p>
      </main>
    </ThemeScope>
  )
}
