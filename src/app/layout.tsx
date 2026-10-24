import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import { RegisterSW } from "@/components/app/pwa";
import { ToastProvider } from "@/components/ui/toast";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Table Ready: Restaurant Reservations and Waitlist", template: "%s · Table Ready" },
  description: "Online reservations and a waitlist for restaurants. Choose which tables and seats are open to online guests, and fill every seating.",
  openGraph: { siteName: "Table Ready", locale: "en_CA", type: "website" },
  applicationName: "Table Ready",
  appleWebApp: { capable: true, title: "Table Ready", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-180.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17110d" },
  ],
};

const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("tableready-theme")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
