'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { HiMenu, HiX } from 'react-icons/hi'
import { ArrowRight } from 'lucide-react'
import { FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa'

export default function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const navLinks = [
    { name: 'Council portal', href: '/portal/dashboard' },
    { name: 'Player QR', href: '/player' },
    { name: 'Schedule', href: '/e-arena/schedule' },
    { name: 'Leaderboard', href: '/e-arena/leaderboard' },
    // { name: 'RCL Jersey', href: 'https://go.rotaract3220.org/rcl-tshirt' },
  ]

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      <nav className="fixed top-4 left-0 right-0 lg:z-50 z-20 mx-auto rounded-full">
        <div className="relative max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 py-2 flex items-center justify-between">
          {/* Left Logo - Rotaract 3220 */}
          <div className="flex-shrink-0 z-30">
            <Link href="/" onClick={closeMobileMenu}>
              <Image
                src="/LogoWhite.png"
                alt="Rotaract 3220"
                width={372}
                height={86}
                sizes="240px"
                quality={90}
                className="h-10 md:h-13 w-auto object-contain hover:scale-105 transition-transform duration-300 "
                priority
              />
            </Link>
          </div>

          {/* Center Navigation Links - Hidden on mobile/tablet */}
          <div className="hidden lg:flex lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 items-center gap-8 py-3 px-10 rounded-full border lg:gap-12 backdrop-blur-md border-b border-white/5">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="font-poppins text-white text-lg lg:text-base font-normal hover:text-cranberry transition-colors duration-300 relative group"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Section - RCL Logo and Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* RCL Logo - Hidden on mobile/tablet */}
            <div className="hidden lg:flex flex-shrink-0">
              <Link href="/" onClick={closeMobileMenu}>
                <Image
                  src="/rcl-white.png"
                  alt="RCL"
                  width={62}
                  height={79}
                  className="h-16 md:h-20 w-auto object-contain hover:scale-105 transition-transform duration-300"
                  priority
                />
              </Link>
            </div>

            {/* Mobile Menu Button - Visible on sm and md */}
            <button
              onClick={toggleMobileMenu}
              className="md:flex lg:hidden w-11 h-11 rounded-full border border-white/30 bg-white/10 hover:bg-cranberry flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cranberry/50 focus:outline-none focus:ring-2 focus:ring-cranberry focus:ring-offset-2 focus:ring-offset-black z-30 backdrop-blur-md"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <HiX className="text-white text-xl" />
              ) : (
                <HiMenu className="text-white text-xl" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation - Visible on sm and md when menu is open */}
        {/* {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 px-6 pb-4">
            <div className="flex flex-wrap gap-4 justify-center">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="font-poppins text-white text-sm font-normal hover:text-cranberry transition-colors duration-300 px-3 py-2 rounded-lg hover:bg-white/5"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        )} */}
      </nav>

      {/* Mobile Side Panel - slides in from the right */}
      <div
        className={`fixed inset-0 z-40 md:flex lg:hidden transition-all duration-300 ${
          isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-[#020812]/70 backdrop-blur-sm" onClick={closeMobileMenu} aria-hidden="true" />

        {/* Panel: gradient ring around a deep-navy glass body */}
        <div
          className={`absolute top-0 right-0 h-full w-[min(88vw,22rem)] rounded-l-[2rem] bg-gradient-to-b from-[#00d9ff] via-white/30 to-[#1e7bff] p-[2px] shadow-[0_0_60px_rgba(0,217,255,0.25)] transform transition-transform duration-300 !z-50 ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="relative flex h-full flex-col overflow-hidden rounded-l-[calc(2rem-2px)] bg-gradient-to-b from-[#0a2547] to-[#050f20]">
            {/* texture + ghost watermark */}
            <Image unoptimized src="/landing/bg-texture.webp" alt="" fill sizes="22rem" className="pointer-events-none object-cover opacity-25" />
            <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 select-none font-sakana text-[15rem] leading-none text-white/[0.06]">RCL</span>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#00d9ff]/15 to-transparent" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-6 pt-6 pb-4">
              <Image src="/rcl-white.png" alt="RCL" width={62} height={79} className="h-14 w-auto object-contain" />
              <button
                onClick={closeMobileMenu}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 transition-colors duration-200 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Close menu"
              >
                <HiX className="text-lg text-white" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="relative flex-1 px-6 pt-4">
              <ul className="space-y-3">
                {navLinks.map((link, index) => {
                  const active = pathname === link.href
                  return (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        onClick={closeMobileMenu}
                        aria-current={active ? 'page' : undefined}
                        className="group relative flex items-center justify-between px-5 py-4 transition-transform duration-200 hover:translate-x-1 focus:outline-none"
                        style={{
                          animationDelay: `${index * 90}ms`,
                          animation: isMobileMenuOpen ? 'slideInRight 0.35s ease-out both' : 'none',
                        }}
                      >
                        {/* slanted plate */}
                        <span
                          aria-hidden
                          className={`absolute inset-0 -skew-x-[10deg] rounded-md border transition-all duration-200 group-focus-visible:ring-2 group-focus-visible:ring-[#00d9ff]/70 ${
                            active
                              ? 'border-transparent bg-gradient-to-r from-[#00e5ff] to-[#1e8cff]'
                              : 'border-white/15 bg-white/[0.06] group-hover:border-transparent group-hover:bg-gradient-to-r group-hover:from-[#00e5ff] group-hover:to-[#1e8cff]'
                          }`}
                        />
                        <span className={`relative font-sakana text-xl uppercase tracking-wide ${active ? 'text-[#04101e]' : 'text-white group-hover:text-[#04101e]'}`}>
                          {link.name}
                        </span>
                        <ArrowRight className={`relative transition-transform duration-200 group-hover:translate-x-1 ${active ? 'text-[#04101e]' : 'text-[#00d9ff] group-hover:text-[#04101e]'}`} size={20} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Footer */}
            <div className="relative px-6 pb-7 pt-4">
              <p className="font-sakana text-sm leading-tight text-white/80">
                <span className="text-[#00d9ff]">R</span>ecords. <span className="text-[#00d9ff]">C</span>hampions. <span className="text-[#00d9ff]">L</span>egends.
              </p>
              <div className="mt-4 flex gap-3">
                {[
                  [FaFacebook, 'Facebook', 'https://facebook.com/RCLbyrotaract3220/'],
                  [FaInstagram, 'Instagram', 'https://www.instagram.com/rclbyrotaract3220/'],
                  [FaTiktok, 'TikTok', 'https://www.tiktok.com/@rotaract_3220'],
                ].map(([Icon, label, href]) => (
                  <a key={label} href={href} aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all duration-200 hover:border-transparent hover:bg-gradient-to-br hover:from-[#00e5ff] hover:to-[#1e8cff] hover:text-[#04101e]">
                    <Icon className="text-base" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  )
}
