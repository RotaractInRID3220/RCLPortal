'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { HiMenu, HiX } from 'react-icons/hi'

export default function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
        <div className="max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 py-2 flex items-center justify-between">
          {/* Left Logo - Rotaract 3220 */}
          <div className="flex-shrink-0 z-30">
            <Link href="/" onClick={closeMobileMenu}>
              <Image
                src="/LogoWhite.png"
                alt="Rotaract 3220"
                width={120}
                height={31}
                className="h-10 md:h-13 w-auto object-contain hover:scale-105 transition-transform duration-300 "
                priority
              />
            </Link>
          </div>

          {/* Center Navigation Links - Hidden on mobile/tablet */}
          <div className="hidden lg:flex items-center gap-8 py-3 px-10 rounded-full border lg:gap-12 backdrop-blur-md border-b border-white/5">
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
              <Link href="/e-arena" onClick={closeMobileMenu}>
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
              className="md:flex lg:hidden w-11 h-11 rounded-full border border-cranberry/50 hover:bg-cranberry flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cranberry/50 focus:outline-none focus:ring-2 focus:ring-cranberry focus:ring-offset-2 focus:ring-offset-black z-30 backdrop-blur-md"
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

      {/* Mobile Side Panel - Slides from right */}
      <div
        className={`fixed inset-0 z-40 md:flex lg:hidden transition-all duration-300 ${
          isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />

        {/* Side Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-80 max-w-[90vw] bg-cranberry/20 shadow-2xl transform transition-transform duration-300 !z-50 ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-end p-6 border-b border-white/10">
            {/* <h2 className="text-white text-xl font-bold font-poppins">Menu</h2>  */}
            <button
              onClick={closeMobileMenu}
              className=" rounded-full hover:bg-white/10 flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 border border-cranberry w-11 h-11"
              aria-label="Close menu"
            >
              <HiX className="text-white text-lg" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-6">
            <ul className="space-y-4">
              {navLinks.map((link, index) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    onClick={closeMobileMenu}
                    className="block w-full text-white border border-cranberry/40 bg-cranberry/30 text-lg font-poppins font-medium hover:bg-cranberry/10 px-4 py-3 rounded-lg transition-all duration-200 hover:translate-x-2 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/10"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animation: isMobileMenuOpen ? 'slideInRight 0.3s ease-out forwards' : 'none',
                    }}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>


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
