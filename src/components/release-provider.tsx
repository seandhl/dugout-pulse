"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo } from "react";
const ReleaseContext = createContext("synthetic_v2");
export function ReleaseProvider({
  releaseId,
  children,
}: {
  releaseId: string;
  children: React.ReactNode;
}) {
  return (
    <ReleaseContext.Provider value={releaseId}>
      {children}
    </ReleaseContext.Provider>
  );
}
export default function ReleaseLink(props: React.ComponentProps<typeof Link>) {
  const releaseId = useContext(ReleaseContext);
  let href = props.href;
  if (
    typeof href === "string" &&
    href.startsWith("/") &&
    !href.startsWith("//")
  ) {
    const url = new URL(href, "http://local");
    url.searchParams.set("releaseId", releaseId);
    href = `${url.pathname}${url.search}${url.hash}`;
  }
  return <Link {...props} href={href} />;
}
export function releaseFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set(
    "x-pulse-release",
    document.body.dataset.releaseId ?? "synthetic_v2",
  );
  return fetch(input, { ...init, headers });
}

export function useReleaseRouter() {
  const router = useRouter();
  const releaseId = useContext(ReleaseContext);
  return useMemo(() => {
    const pin = (href: string) => {
      const url = new URL(href, window.location.href);
      url.searchParams.set("releaseId", releaseId);
      return `${url.pathname}${url.search}${url.hash}`;
    };
    return {
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(pin(href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(pin(href), options),
    };
  }, [router, releaseId]);
}
