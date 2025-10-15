import { Bebas_Neue, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import PrivateRoute from "@/lib/PrivateRoute";
import PortalSideNav from "./components/PortalSideNav";
import DeviceCheck from "./components/DeviceCheck";
import Script from "next/script";

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
          <div className="lg:w-10/12 ml-auto lg:py-16 lg:px-10 py-5 px-5">
            <PrivateRoute accessType="portal">
                <DeviceCheck>
                    {children}
                </DeviceCheck>
                <Toaster richColors  />
            </PrivateRoute>
          </div>
        </div>

        <div className='w-[700px] h-[500px] fixed -top-80  left-0 right-0 m-auto bg-cranberry/75 -z-10 rounded-full blur-[20rem]'></div>

      </div>
      </>
  );
}
