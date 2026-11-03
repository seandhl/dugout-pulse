import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://dugout-pulse.invalid"),
  robots: { index: false, follow: false },
  title: {
    default: "DUGOUT PULSE | 야구의 흐름을 읽다",
    template: "%s | DUGOUT PULSE",
  },
  description:
    "타자·선발·불펜의 흐름을 이해하는 한국어 야구 분석 서비스. DEMO 개발 미리보기.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
