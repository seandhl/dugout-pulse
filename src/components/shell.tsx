"use client";
import Link from "@/components/release-provider";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Switch } from "radix-ui";
import { Toaster, toast } from "sonner";
import { ScoreHelp } from "@/components/score-help";
const links = [
  ["/", "대시보드"],
  ["/players", "선수 탐색"],
  ["/published", "1군·데이터 시점"],
  ["/rankings", "기세 랭킹"],
  ["/compare", "선수 비교"],
  ["/about", "서비스 소개"],
] as const;
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {
      /* Use system preference if storage is unavailable. */
    }
    const initial = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", initial);
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    // Synchronize the external browser preference after mounting.
    requestAnimationFrame(() => setDark(initial));
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  function changeTheme(checked: boolean) {
    setDark(checked);
    document.documentElement.classList.toggle("dark", checked);
    try {
      localStorage.setItem("theme", checked ? "dark" : "light");
    } catch {
      /* Theme still works without storage. */
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="더그아웃 펄스 홈">
            <span className="brand-mark" aria-hidden="true">
              D<span>↗</span>
            </span>
            <span>
              DUGOUT<span className="brand-accent"> PULSE</span>
            </span>
          </Link>
          <div className="theme">
            <label htmlFor="theme">다크 모드</label>
            <Switch.Root
              id="theme"
              className="switch"
              checked={dark}
              onCheckedChange={changeTheme}
            >
              <Switch.Thumb className="thumb" />
            </Switch.Root>
          </div>
        </div>
        <TopNav pathname={pathname} />
      </header>
      <div className="demo-strip" role="region" aria-label="데모 안내">
        <span className="badge">DEMO</span>
        <span>DEMO — 가상의 선수와 경기 기록</span>
      </div>
      {offline && (
        <p className="offline" role="status">
          오프라인입니다. 새 페이지를 열려면 연결을 확인해 주세요.
        </p>
      )}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer>
        <span>© DUGOUT PULSE · 비공식 야구 분석 프로젝트</span>
        <Link href="/about">출처 및 데이터 정책</Link>
        <ScoreHelp />
        <Link href="/legal">권리·면책 고지</Link>
        <Link href="/privacy">개인정보 안내</Link>
        <Link href="/data-terms">데이터 이용 안내</Link>
        <Link href="/admin">관리자</Link>
        <button
          className="text-button"
          onClick={() =>
            toast.info(
              "DEMO — 가상의 선수와 경기 기록. 공식 기록과 기세 점수는 제공하지 않습니다.",
            )
          }
        >
          개발 상태 확인
        </button>
      </footer>
      <MobileBottomNav pathname={pathname} />
      <Toaster richColors closeButton />
    </>
  );
}

export const Shell = AppShell;

export function TopNav({ pathname }: { pathname: string }) {
  return (
    <nav className="nav" aria-label="주 메뉴">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (href === "/" ? pathname === href : pathname.startsWith(href))
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="mobile-nav" aria-label="모바일 주 메뉴">
      {links.slice(0, 4).map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (href === "/" ? pathname === href : pathname.startsWith(href))
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
