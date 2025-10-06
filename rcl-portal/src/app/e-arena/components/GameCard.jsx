'use client'
import Image from 'next/image'

export default function GameCard({ title, image, className = '' }) {
  return (
    <div className={`group relative overflow-hidden cursor-crosshair rounded-lg ${className}`}>
      {/* Animated border effect */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cranberry via-pink-500 to-cranberry bg-[length:200%_100%] animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
           style={{ padding: '2px' }}>
        <div className="absolute inset-[2px] bg-black rounded-lg"></div>
      </div>

      {/* Card container */}
      <div className="relative h-full flex overflow-hidden rounded-lg">
        {/* Left side - Game title (rotated) */}
        <div className="relative w-[146px] bg-cranberry/24 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-cranberry/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <h3 className="font-bebas text-cranberry text-[100px] leading-[104px] tracking-wider transform -rotate-90 whitespace-nowrap select-none group-hover:text-white transition-colors duration-500 relative z-10" 
              style={{ 
                textShadow: '0 0 20px rgba(216, 27, 93, 0.5)',
                letterSpacing: title === 'fifa' ? '0.11em' : 'normal'
              }}>
            {title}
          </h3>
        </div>

        {/* Right side - Game image */}
        <div className="relative flex-1 overflow-hidden bg-black">
          {/* Electric glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cranberry/20 via-transparent to-cranberry/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"></div>
          
          {/* Image */}
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />

          {/* Animated shine effect */}
          <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
        </div>
      </div>

      {/* Pulsing corner accent */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-cranberry/30 blur-2xl rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-500"></div>
    </div>
  )
}
