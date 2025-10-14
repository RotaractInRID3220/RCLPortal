'use client'
import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen  flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background blur effect */}
      <div className='w-[800px] h-[600px] fixed -top-80 left-0 right-0 m-auto bg-cranberry/75 z-0 rounded-full blur-[25rem]'></div>

      {/* RCL Logo Background Watermark */}
      <div className="fixed inset-0 flex items-center justify-center z-10">
        <Image
          src="/rcl-white.png"
          alt="RCL Background"
          width={800}
          height={800}
          className="opacity-[0.02] object-contain"
        />
      </div>

      {/* Main content */}
      <div className="text-center z-40 w-full max-w-4xl px-4 pt-10">
        {/* 404 Animation */}
        <div className="">
          <div className="relative">
            <div className="text-8xl md:text-9xl lg:text-[12rem] font-bebas text-cranberry mb-4 animate-pulse">
              404
            </div>
            <div className="absolute inset-0 text-8xl md:text-9xl lg:text-[12rem] font-bebas text-white/10 animate-ping">
              404
            </div>
          </div>
        </div>

        {/* Error message */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bebas text-white mb-4 tracking-wider">
            PAGE NOT FOUND
          </h1>
          <p className="text-xl md:text-2xl text-cranberry font-semibold mb-4">
            Oops! This page got lost in the game
          </p>
          <p className="text-white/80 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            The page you're looking for seems to have wandered off the field.
            Don't worry, let's get you back to the action!
          </p>
        </div>

        {/* Fun elements */}
        <div className="mb-12">
          <div className="flex justify-center space-x-4 mb-6">
            <div className="text-4xl animate-bounce delay-100">⚽</div>
            <div className="text-4xl animate-bounce delay-200">🏆</div>
            <div className="text-4xl animate-bounce delay-300">🎯</div>
            <div className="text-4xl animate-bounce delay-500">🏅</div>
          </div>
          <p className="text-white/60 text-sm italic">
            "The best teams are made by the best players... and the best recoveries!"
          </p>
        </div>

        {/* Navigation options */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl mb-12">
          <Link
            href="/"
            className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20 text-center"
          >
            <div className="text-3xl mb-2">🏠</div>
            <h3 className="text-lg font-semibold text-white mb-1">Home</h3>
            <p className="text-white/60 text-sm">Back to main page</p>
          </Link>

          <Link
            href="/admin/dashboard"
            className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20 text-center"
          >
            <div className="text-3xl mb-2">👑</div>
            <h3 className="text-lg font-semibold text-white mb-1">Admin</h3>
            <p className="text-white/60 text-sm">Admin dashboard</p>
          </Link>

          <Link
            href="/portal/dashboard"
            className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20 text-center"
          >
            <div className="text-3xl mb-2">🏛️</div>
            <h3 className="text-lg font-semibold text-white mb-1">Council</h3>
            <p className="text-white/60 text-sm">Council portal</p>
          </Link>

          <Link
            href="/player"
            className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20 text-center"
          >
            <div className="text-3xl mb-2">⚽</div>
            <h3 className="text-lg font-semibold text-white mb-1">Player</h3>
            <p className="text-white/60 text-sm">Player portal</p>
          </Link>
        </div> */}

      </div>

      {/* Footer */}
      <div className="mt-16 text-center z-10">
        <p className="text-white/40 text-sm">
          © 2025 Rotaract in RID 3220. All rights reserved.
        </p>
      </div>
    </div>
  );
}