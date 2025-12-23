import { Bebas_Neue, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import PrivateRoute from "@/lib/PrivateRoute";
import PortalSideNav from "./components/PortalSideNav";
import DeviceCheck from "./components/DeviceCheck";
import Script from "next/script";
import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400", // Add this line

});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"], // Add this line
});


export const metadata = {
  title: "RCL Portal",
  description: "Official RCL Portal for the Council members of the Rotaract in RID 3220",
};

export default function RootLayout({ children }) {
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
        <div
          className={`${bebas.variable} ${poppins.variable} antialiased dark`}
        >
        <div className="flex w-full">
          <div className="lg:w-2/12 h-screen hidden lg:block fixed">
            <PortalSideNav />
          </div>
          <div className="lg:w-10/12 ml-auto lg:pt-16 lg:px-10 pt-5 px-5 min-h-screen flex flex-col">
            <div className="flex-1">
              <PrivateRoute accessType="portal">
                  <DeviceCheck>
                      {children}
                  </DeviceCheck>
                  <Toaster richColors  />
              </PrivateRoute>
            </div>
            <footer className="mt-8 text-center pb-5 flex justify-between w-full">
              <p className="text-xs text-white/40 mb-1">Version {packageJson.version}</p>
              <p className="text-xs md:text-xs text-white/40">
                Tool by <span className='hover:animate-gradient font-bold '><a href="https://www.instagram.com/code.techghost_/" className="hover:text-white/60 transition-colors">Code.Techghost</a></span>
              </p>
            </footer>
          </div>
        </div>

        <div className='w-[700px] h-[500px] fixed -top-80  left-0 right-0 m-auto bg-cranberry/75 -z-10 rounded-full blur-[20rem]'></div>

      </div>
      </>
  );
}
