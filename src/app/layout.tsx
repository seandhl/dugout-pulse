import { baselineReleaseId } from "@/server/repositories/publication";
import { headers } from "next/headers";
import { ReleaseProvider } from "@/components/release-provider";
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
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const releaseId =
    (await headers()).get("x-pulse-release") ?? baselineReleaseId();
  return (
    <html lang="ko" suppressHydrationWarning>
      <body data-release-id={releaseId}>
        <ReleaseProvider releaseId={releaseId}>
          <Shell>{children}</Shell>
        </ReleaseProvider>
      </body>
    </html>
  );
}
