import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./discovery.css";

const sans = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-discovery-sans",
  display: "swap",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-discovery-serif",
  display: "swap",
});

export default function DiscoveryLayout({ children }: LayoutProps<"/discovery">) {
  return (
    <div className={`discovery ${sans.variable} ${serif.variable}`}>
      {children}
    </div>
  );
}
