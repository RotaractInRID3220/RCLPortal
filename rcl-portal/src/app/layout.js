import { Bebas_Neue, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import SessionProvider from "@/components/SessionProvider";

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
  description: "Official RCL Portal",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-9BRFC5JVKB"></script>
        <script>
          {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-9BRFC5JVKB');`}
        </script>
      </head>
      <body
        className={`${bebas.variable} ${poppins.variable} antialiased dark`}
        suppressHydrationWarning={true}
      >
        <SessionProvider>
          {children}
          <Toaster richColors  />
        </SessionProvider>
      </body>
    </html>
  );
}
