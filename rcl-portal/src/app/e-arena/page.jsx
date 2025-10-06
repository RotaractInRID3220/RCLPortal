'use client'
import Image from 'next/image'
import Link from 'next/link'
import Footer from './components/Footer'
import GameCard from './components/GameCard'
import { FaInfoCircle } from 'react-icons/fa'

export default function EArenaPage() {
  const games = [
    { title: 'mk 11', image: '/mk image.png' },
    { title: 'fifa', image: '/fifa image.png' },
    { title: 'codm', image: '/cod.png' },
  ]

  return (
    <>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Belanosima:wght@400;600;700&display=swap" rel="stylesheet" />
      
      <div className="min-h-screen bg-black flex flex-col overflow-x-hidden">
      {/* Main Content */}
      <main className="flex-1 relative">
        {/* Background Image */}
        <div className="absolute inset-0 top-3 w-full h-screen z-0">
          <Image
            src="/bg image.png"
            alt="E-Arena Background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* Pink Glow Effect */}
        <div className="fixed top-[-900px] left-0 right-0 mx-auto w-[1490px] h-[864px] bg-cranberry/60 rounded-full z-0"
             style={{ filter: 'blur(1000px)' }}></div>

        {/* Content Container */}
        <div className="relative z-10  pb-20">
          
          {/* Hero Section */}
          <section className="lg:max-w-[1920px] mx-auto px-2 md:px-12 lg:px-24 h-screen flex flex-col justify-center relative">
            <div className="text-center mb-20">
              {/* RCL Text */}
              <h1 className="font-poppins text-white text-3xl md:text-5xl lg:text-5xl font-normal mb-4 tracking-wider leading-0 mt-[8%] select-none">
                RCL
              </h1>

              {/* E-ARENA Main Title */}
              <h2 className="bg-gradient-to-b from-cranberry to-cranberry/20 bg-clip-text text-transparent font-belanosima text-7xl md:text-9xl lg:text-[200px] xl:text-[280px] font-normal leading-[0.9] tracking-tight mb-10 select-none"
                  style={{ 
                    fontFamily: 'Belanosima, system-ui, sans-serif',
                    WebkitTextStroke: '2px rgba(216, 27, 93, 0.3)',
                  }}>
                E-ARENA
              </h2>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center max-w-3xl absolute md:bottom-30 bottom-14 lg:bottom-24 xl:bottom-15 left-0 right-0 mx-auto px-10 sm:px-0">
                <Link
                  href="#handbook"
                  className="group relative w-full sm:w-auto px-12 py-3 bg-cranberry/10 border border-cranberry rounded-lg overflow-hidden transition-all duration-300 hover:bg-cranberry/30 hover:border-cranberry/80 hover:shadow-lg hover:shadow-cranberry/30"
                >
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                  <span className="font-bebas text-cranberry text-3xl leading-none relative z-10 group-hover:text-white transition-colors duration-300">
                    handbook
                  </span>
                </Link>

                <Link
                  href="#tshirt"
                  className="group relative w-full sm:w-auto px-12 py-3 bg-cranberry/10 border border-cranberry rounded-lg overflow-hidden transition-all duration-300 hover:bg-cranberry/30 hover:border-cranberry/80 hover:shadow-lg hover:shadow-cranberry/30"
                >
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                  <span className="font-bebas text-cranberry text-3xl leading-none relative z-10 group-hover:text-white transition-colors duration-300">
                    ORDER YOUR TSHIRT
                  </span>
                </Link>
              </div>
            </div>
          </section>

          
              {/* Tagline */}
              <p className="font-bebas text-cranberry text-2xl md:text-3xl lg:text-4xl leading-tight max-w-4xl mx-auto tracking-wide text-center mt-20 px-10">
                rotaract in rid 3220&apos;s most electrifying E-sport arena
                <br />
                <span className='text-4xl md:text-5xl lg:text-5xl text-white'>where Rotaractors clash for glory!</span>
              </p>

          {/* Games Section */}
          <section className="max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 mt-20 mb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12 max-w-7xl mx-auto ">
              {games.map((game, index) => (
                <GameCard
                  key={index}
                  title={game.title}
                  image={game.image}
                  className="h-[600px]"
                />
              ))}
            </div>
          </section>

          {/* Registration Instruction */}
          <section className="max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 mt-20 mb-12">
            <div className="max-w-6xl mx-auto">
              <div className="relative group">
                {/* Animated border */}
                <div className="absolute inset-0 bg-gradient-to-r from-cranberry via-pink-500 to-cranberry bg-[length:200%_100%] animate-shimmer opacity-50 rounded-lg"
                     style={{ padding: '1px' }}>
                  <div className="absolute inset-[1px] bg-black/80 backdrop-blur-sm rounded-lg"></div>
                </div>

                {/* Content */}
                <div className="relative bg-cranberry/20 border border-cranberry rounded-lg px-8 py-6 backdrop-blur-sm">
                  <div className="flex items-center justify-center gap-4">
                    <FaInfoCircle className="text-cranberry text-3xl flex-shrink-0 animate-pulse" />
                    <p className="font-poppins text-white text-lg md:text-xl lg:text-2xl text-center leading-relaxed">
                      Contact your club president or secretary to register for the event.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      </div>
    </>
  )
}
