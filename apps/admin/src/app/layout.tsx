import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

// Satoshi is not on Google Fonts; it is self-hosted from Fontshare (ITF FFL,
// see ./fonts/LICENSE-Satoshi.txt). One variable file covers 300–900.
const satoshi = localFont({
  src: "./fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
  style: "normal",
  display: "swap",
});
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "FYT Console", template: "%s · FYT Console" },
  description: "Operator console for FYT, Find Your Trainer.",
  robots: { index: false, follow: false },
};

// Applies the saved theme before paint so there is no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('tp-theme');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${satoshi.variable} ${outfit.variable} ${geistMono.variable} min-h-[100dvh] antialiased`}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!bg-surface !text-ink !border !border-line !rounded-[10px] !shadow-[var(--shadow-overlay)] !font-sans",
              description: "!text-ink-2",
            },
          }}
        />
      </body>
    </html>
  );
}
