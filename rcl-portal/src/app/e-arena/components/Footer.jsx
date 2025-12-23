'use client'
import Image from 'next/image'
import Link from 'next/link'
import { FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa'

export default function Footer() {
  const navLinks = [
    { name: 'Council portal', href: '/portal/dashboard' },
    { name: 'Player QR', href: '/player' },
    { name: 'Leaderboard', href: '/e-arena/leaderboard' },
    { name: 'Handbook', href: '#handbook' },
  ]

  const socialLinks = [
    { name: 'Facebook', icon: FaFacebook, href: 'https://facebook.com/RCLbyrotaract3220/', color: 'hover:bg-blue-600' },
    { name: 'Instagram', icon: FaInstagram, href: 'https://www.instagram.com/rclbyrotaract3220/', color: 'hover:bg-pink-600' },
    { name: 'TikTok', icon: FaTiktok, href: 'https://www.tiktok.com/@rotaract_3220/video/7555918077867724050', color: 'hover:bg-black' },
  ]

  return (
    <footer className="relative bg-black border-t border-white/10 mt-auto">
      <div className="max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left Section - Logos */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <Image
                src="/LogoWhite.png"
                alt="Rotaract 3220"
                width={179}
                height={45}
                className="h-14 w-auto object-contain hover:scale-105 transition-transform duration-300"
              />
            </Link>
            <Link href="/e-arena">
              <Image
                src="/rcl-white.png"
                alt="RCL"
                width={82}
                height={106}
                className="h-20 w-auto object-contain hover:scale-105 transition-transform duration-300"
              />
            </Link>
          </div>

          {/* Center Section - Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 lg:gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="font-poppins text-white text-base lg:text-lg font-normal hover:text-cranberry transition-colors duration-300 relative group"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Section - Social Media Icons */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon
              return (
                <Link
                  key={social.name}
                  href={social.href}
                  className={`w-11 h-11 rounded-full border border-cranberry/50 hover:bg-cranberry flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cranberry/50 ${social.color}`}
                  aria-label={social.name}
                >
                  <Icon className="text-white text-xl" />
                </Link>
              )
            })}
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="w-full flex flex-col lg:flex-row gap-1 items-center lg:justify-between mt-5 border-t border-white/5 text-center">
          <p className="text-white/40 text-sm font-poppins">
            © {new Date().getFullYear()} Rotaract in RID 3220. All rights reserved.
          </p>
          <p className="text-xs md:text-sm text-white/40">
            Designed & Developed by <span className='animate-gradient font-bold bg-gradient-to-r bg-clip-text text-transparent from-[#22D1AE] via-[#EAEAEA] to-[#22D1AE]'><a href="https://www.instagram.com/code.techghost_/">Code.Techghost</a></span>
          </p>
        </div>
      </div>
    </footer>
  )
}
