import Script from "next/script";

export const metadata = {
  title: "Player Search - RCL Portal",
  description: "Search for players and generate QR code lanyards",
};

export default function PlayerLayout({ children }) {
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
      {children}
    </>
  );
}
