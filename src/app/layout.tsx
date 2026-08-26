import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { TabBar } from "@/components/TabBar";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kettlebell",
  description: "Workouts built round the kit you own and the time you have.",
  manifest: "/manifest.webmanifest",
  /*
   * iOS reads this link rather than the manifest's icon list, so an app added
   * to the Home Screen without it gets a screenshot of the page as its icon.
   * The two manifest sizes are for everything else.
   */
  icons: { apple: "/icons/apple-touch-icon.png" },
  /*
   * `display: standalone` in the manifest is only honoured from iOS 16.4. This
   * meta is what older iOSes read, and it is also what pins the status bar to
   * the default style: `black-translucent` would run the page up under the
   * clock, and nothing in this layout reserves room at the top for it.
   */
  appleWebApp: { title: "Kettlebell", capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geist.variable} antialiased`}>
      <body className="app-shell">
        {children}
        {/*
          Rendered here rather than per page, so it is one bar with one current
          tab wherever he is. It hides itself on the running workout - nothing
          may sit under the thumb mid-set - and carries its own safe-area inset,
          because a fixed element ignores the padding .app-shell puts on body.
        */}
        <TabBar />
      </body>
    </html>
  );
}
