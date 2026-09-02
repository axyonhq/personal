import { Fredoka, Nunito } from "next/font/google";
import "./discovery.css";

const sans = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-discovery-sans",
  display: "swap",
});

const display = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-discovery-serif",
  display: "swap",
});

export default function DiscoveryLayout({ children }: LayoutProps<"/discovery">) {
  return (
    <div className={`discovery ${sans.variable} ${display.variable}`}>
      {children}
    </div>
  );
}
