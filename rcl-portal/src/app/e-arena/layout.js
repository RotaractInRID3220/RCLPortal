import NavBar from './components/NavBar'

export const metadata = {
  title: 'RCL E-Arena | RCL Portal',
  // description: "Join Rotaract in RID 3220's electrifying E-Arena! Compete in Rotaract Champions League esports tournaments, online gaming competitions, and Rotaract sports events. Experience the thrill of Rotaract3220's premier e-sports arena where Rotaractors clash for glory in championship leagues and gaming tournaments.",
  // keywords: [
  //   'Rotaract',
  //   'Rotaract3220',
  //   'Rotaract in RID 3220',
  //   'RCL',
  //   'Rotaract Champions League',
  //   'Rotaract sport',
  //   'esports',
  //   'e-sports',
  //   'gaming tournament',
  //   'online gaming',
  //   'Rotaract esports',
  //   'youth esports',
  //   'Rotaract competition',
  //   'gaming league',
  //   'RID 3220 esports',
  //   'Rotaract International',
  //   'youth leadership',
  //   'community service',
  //   'sports league',
  //   'championship games',
  //   'Rotaract events',
  //   'gaming arena',
  //   'tournament competition',
  //   'Rotaract gaming',
  //   'esports championship'
  // ],
  // authors: [{ name: 'Rotaract in RID 3220' }],
  // creator: 'Rotaract in RID 3220',
  // publisher: 'Rotaract in RID 3220',
  // formatDetection: {
  //   email: false,
  //   address: false,
  //   telephone: false,
  // },
  metadataBase: new URL('https://rcl-portal.vercel.app'), // Update with your actual domain
  alternates: {
    canonical: '/e-arena',
  },
  openGraph: {
    title: 'E-Arena | Rotaract Champions League - Ultimate Esports Tournament',
    description: "Experience Rotaract in RID 3220's premier E-Arena! Join Rotaract Champions League esports tournaments, gaming competitions, and Rotaract sports events. Where Rotaractors compete for glory in championship leagues.",
    url: '/e-arena',
    siteName: 'RCL Portal',
    images: [
      {
        url: '/images/e-arena-meta.png', // Replace with actual image path when provided
        width: 1200,
        height: 630,
        alt: 'Rotaract Champions League E-Arena - Esports Tournament Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'E-Arena | Rotaract Champions League - Ultimate Esports Tournament',
    description: "Join Rotaract in RID 3220's E-Arena! Compete in Rotaract Champions League esports tournaments and gaming competitions. Experience the thrill of Rotaract sports events.",
    images: ['/images/e-arena-meta.png'], // Replace with actual image path when provided
    creator: '@RotaractRID3220', // Update with actual Twitter handle if available
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
    google: 'your-google-site-verification-code', // Add when available
  },
}

export default function EArenaLayout({ children }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  )
}

