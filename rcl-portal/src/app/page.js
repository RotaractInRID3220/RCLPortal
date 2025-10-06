import { redirect } from 'next/navigation';
import Image from "next/image";

export default function Home() {
  redirect('/e-arena');

  // Keep the existing content below for future use (commented out)
  // <div className="min-h-screen bg-black flex flex-col items-center justify-center lg:pt-0 pt-10 pb-20 px-4 relative overflow-hidden">
  //   /* Background blur effect */
  //   <div className='w-[800px] h-[600px] fixed -top-80 left-0 right-0 m-auto bg-cranberry/75 z-0 rounded-full blur-[25rem]'></div>
  //   /* RCL Logo Background Watermark */
  //   <div className="fixed inset-0 flex items-center justify-center z-10">
  //     <Image
  //       src="/rcl-white.png"
  //       alt="RCL Background"
  //       width={800}
  //       height={800}
  //       className="opacity-[0.02] object-contain"
  //     />
  //   </div>
  //   /* Main content */
  //   <div className="text-center mb-12 z-10 w-full max-w-4xl px-4 mt-5 lg:mt-0">
  //     <div className="mb-6">
  //       <Image
  //         src="/LogoWhite.png"
  //         alt="RCL Portal Logo"
  //         width={120}
  //         height={120}
  //         className="mx-auto mb-4"
  //       />
  //       <h1 className="text-5xl md:text-7xl lg:text-8xl font-bebas text-white mb-4 tracking-wider">
  //         RCL PORTAL
  //       </h1>
  //       <p className="text-xl md:text-2xl text-cranberry font-semibold mb-2">
  //         Coming Soon
  //       </p>
  //     </div>
  //     /* Progress bar */
  //     <div className="max-w-md mx-auto mb-8">
  //       <div className="bg-white/10 rounded-full h-3 mb-2">
  //         <div className="bg-cranberry h-3 rounded-full w-3/4 transition-all duration-1000 ease-out"></div>
  //       </div>
  //       <p className="text-white/60 text-sm">75% Complete</p>
  //     </div>
  //     <p className="text-white/80 text-base md:text-lg  max-w-2xl mx-auto leading-relaxed">
  //       The ultimate platform for Rotaract Champions League management.
  //     </p>
  //   </div>
  //   /* Portal buttons grid */
  //   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full max-w-6xl z-10 px-4">
  //     <a
  //       href="/admin/dashboard"
  //       className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20"
  //     >
  //       <div className="text-center">
  //         <div className="text-4xl mb-3">👑</div>
  //         <h3 className="text-xl font-semibold text-white mb-2">Admin Portal</h3>
  //         <p className="text-white/60 text-sm">Manage events, players, and system settings</p>
  //       </div>
  //     </a>
  //     <a
  //       href="/portal/dashboard"
  //       className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20"
  //     >
  //       <div className="text-center">
  //         <div className="text-4xl mb-3">🏛️</div>
  //         <h3 className="text-xl font-semibold text-white mb-2">Council Portal</h3>
  //         <p className="text-white/60 text-sm">Council management and oversight</p>
  //       </div>
  //     </a>
  //     <a
  //       href="/player"
  //       className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20"
  //     >
  //       <div className="text-center">
  //         <div className="text-4xl mb-3">⚽</div>
  //         <h3 className="text-xl font-semibold text-white mb-2">Player Portal</h3>
  //         <p className="text-white/60 text-sm">Player profiles and match participation</p>
  //       </div>
  //     </a>
  //     <a
  //       href="/admin/dashboard/register"
  //       className="group bg-cranberry/10 hover:bg-cranberry/20 border border-cranberry/30 hover:border-cranberry rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cranberry/20"
  //     >
  //       <div className="text-center">
  //         <div className="text-4xl mb-3">📝</div>
  //         <h3 className="text-xl font-semibold text-white mb-2">Day Registrations</h3>
  //         <p className="text-white/60 text-sm">Daily event and match registrations</p>
  //       </div>
  //     </a>
  //   </div>
  //   /* Footer */
  //   <div className="absolute bottom-10 text-center z-10">
  //     <p className="text-white/40 text-sm">
  //       © 2025 Rotaract in RID 3220. All rights reserved.
  //     </p>
  //   </div>
  // </div>
}
