import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./router.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-router-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-router-mono",
  display: "swap",
});

export default function RouterLayout({ children }: LayoutProps<"/router">) {
  return (
    <div className={`cash-router ${sans.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
