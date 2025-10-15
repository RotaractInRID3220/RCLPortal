import NavBar from './components/NavBar'
import Script from 'next/script'

export const metadata = {
  title: 'RCL E-Arena - Join Rotaract Champions League Esports Tournaments | RCL Portal',
  description: "Join Rotaract in RID 3220's electrifying E-Arena! Compete in Rotaract Champions League esports tournaments, online gaming competitions, and Rotaract sports events. Experience the thrill of Rotaract3220's premier e-sports arena where Rotaractors clash for glory in championship leagues and gaming tournaments.",
  applicationName: 'RCL Portal',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'Rotaract',
    'Rotaract3220',
    'Rotaract in RID 3220',
    'RCL',
    'Rotaract Champions League',
    'Rotaract sport',
    'esports',
    'e-sports',
    'gaming tournament',
    'online gaming',
    'Rotaract esports',
    'youth esports',
    'Rotaract competition',
    'gaming league',
    'RID 3220 esports',
    'Rotaract International',
    'youth leadership',
    'community service',
    'sports league',
    'championship games',
    'Rotaract events',
    'gaming arena',
    'tournament competition',
    'Rotaract gaming',
    'esports championship'
  ],
  authors: [{ name: 'Rotaract in RID 3220' }],
  creator: 'Rotaract in RID 3220',
  publisher: 'Rotaract in RID 3220',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://rcl.rotaract3220.org/'),
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ], // Update with your actual domain
  alternates: {
    canonical: '/e-arena',
  },
  openGraph: {
    title: 'E-Arena | Rotaract Champions League - Ultimate Esports Tournament',
    description: "Experience Rotaract in RID 3220's premier E-Arena! Join Rotaract Champions League esports tournaments, gaming competitions, and Rotaract sports events. Where Rotaractors compete for glory in championship leagues.",
    url: 'https://rcl.rotaract3220.org/e-arena',
    siteName: 'RCL Portal',
    images: [
      {
        url: '/images/e-arena-meta.png',
        width: 1200,
        height: 630,
        alt: 'Rotaract Champions League E-Arena - Esports Tournament Preview',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
    countryName: 'Sri Lanka',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'E-Arena | Rotaract Champions League - Ultimate Esports Tournament',
    description: "Join Rotaract in RID 3220's E-Arena! Compete in Rotaract Champions League esports tournaments and gaming competitions. Experience the thrill of Rotaract sports events.",
    images: ['/images/e-arena-meta.png'],
    creator: '@RotaractRID3220',
    site: '@RotaractRID3220',
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: '1x_eXkqCOccFDjaIkTUjJtALrIqEj1YweysK-T82BfU',
  },
}

export default function EArenaLayout({ children }) {
  // JSON-LD Structured Data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://rcl.rotaract3220.org/#organization',
        name: 'Rotaract in RID 3220',
        url: 'https://rcl.rotaract3220.org',
        logo: {
          '@type': 'ImageObject',
          url: 'https://rcl.rotaract3220.org/LogoWhite.png',
        },
        sameAs: [
          'https://twitter.com/RotaractRID3220',
        ],
      },
      {
        '@type': 'WebPage',
        '@id': 'https://rcl.rotaract3220.org/e-arena/#webpage',
        url: 'https://rcl.rotaract3220.org/e-arena',
        name: 'RCL E-Arena - Join Rotaract Champions League Esports Tournaments',
        description: "Join Rotaract in RID 3220's electrifying E-Arena! Compete in Rotaract Champions League esports tournaments, online gaming competitions, and Rotaract sports events.",
        isPartOf: {
          '@id': 'https://rcl.rotaract3220.org/#website',
        },
        about: {
          '@id': 'https://rcl.rotaract3220.org/#organization',
        },
        inLanguage: 'en-US',
      },
      {
        '@type': 'SportsEvent',
        '@id': 'https://rcl.rotaract3220.org/e-arena/#event',
        name: 'Rotaract Champions League E-Arena',
        description: 'Esports tournament featuring FIFA, Call of Duty Mobile, and Mortal Kombat competitions for Rotaract clubs in RID 3220',
        image: 'https://rcl.rotaract3220.org/images/e-arena-meta.png',
        location: {
          '@type': 'VirtualLocation',
          url: 'https://rcl.rotaract3220.org/e-arena',
        },
        organizer: {
          '@id': 'https://rcl.rotaract3220.org/#organization',
        },
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
      },
    ],
  }

  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script async src="https://www.googletagmanager.com/gtag/js?id=G-9BRFC5JVKB" />
      <Script>
        {`window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-9BRFC5JVKB');`}
      </Script>
      <Script
        id="json-ld-e-arena"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar />
      {children}
    </>
  )
}

