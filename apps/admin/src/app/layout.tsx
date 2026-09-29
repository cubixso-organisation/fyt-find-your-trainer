import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
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
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-[100dvh] antialiased`}>
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
