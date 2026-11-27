import ThemeScope from '@/components/ThemeScope'
import NavBar from './e-arena/components/NavBar'
import Footer from './e-arena/components/Footer'
import HeroSection from '@/components/landing/HeroSection'
import GlimpseSection from '@/components/landing/GlimpseSection'

export const metadata = {
  metadataBase: new URL('https://rcl.rotaract3220.org/'),
  title: 'Rotaract Champions League 2026-27 | RCL Portal',
  description:
    "Rotaract Champions League 2026-27 — Rotaract in RID 3220's district-wide sports championship. Records. Champions. Legends.",
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Rotaract Champions League 2026-27',
    description: 'Records. Champions. Legends. The official home of the Rotaract Champions League by Rotaract in RID 3220.',
    url: 'https://rcl.rotaract3220.org/',
    siteName: 'RCL Portal',
    type: 'website',
    images: [{ url: '/images/e-arena-meta.png', width: 1200, height: 630, alt: 'Rotaract Champions League 2026-27', type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rotaract Champions League 2026-27',
    description: 'Records. Champions. Legends.',
    images: ['/images/e-arena-meta.png'],
  },
}

export default function Home() {
  return (
    <ThemeScope>
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-black">
      <NavBar />
      <main className="flex-1">
        <HeroSection />
        <GlimpseSection />
      </main>
      <Footer />
    </div>
    </ThemeScope>
  )
}
