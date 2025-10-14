import { Bebas_Neue, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import PrivateRoute from "@/lib/PrivateRoute";
import AdminSideNav from "../components/AdminSideNav";
import DeviceCheck from "../components/DeviceCheck";

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
  description: "Official RCL Portal for the DisCo members of the Rotaract in RID 3220",
};

export default function RootLayout({ children }) {
  return (
      <div
        className={`${bebas.variable} ${poppins.variable} antialiased dark`}
      >
        <div className="flex w-full">
          <div className="lg:w-2/12 lg:block hidden h-screen fixed">
            <AdminSideNav />
          </div>
          <div className="lg:w-10/12 lg:ml-auto lg:py-16 w-screen lg:px-10 py-5 px-3">
            <PrivateRoute accessType="admin">
                <DeviceCheck>
                    {children}
                </DeviceCheck>
                <Toaster richColors  />
            </PrivateRoute>
          </div>
        </div>

        <div className='w-[700px] h-[500px] fixed -top-80  left-0 right-0 m-auto bg-cranberry/75 -z-10 rounded-full blur-[20rem]'></div>

      </div>
  );
}
