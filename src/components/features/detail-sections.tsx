"use client";
import type { ReactNode } from "react";
import { Tabs } from "radix-ui";
import { useSearchParams } from "next/navigation";
import { useReleaseRouter } from "@/components/release-provider";

export function useDetailQuery() {
  const params = useSearchParams();
  const router = useReleaseRouter();
  return (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) next.set(key, value);
    router.replace(`?${next}`, { scroll: false });
  };
}
export function DetailSections({
  children,
  season,
}: {
  children: ReactNode;
  season: ReactNode;
}) {
  const params = useSearchParams();
  const change = useDetailQuery();
  const tab = params.get("tab") ?? "momentum";
  if (params.getAll("tab").length > 1 || !["momentum", "season"].includes(tab))
    return (
      <section className="panel" role="alert">
        <p>유효하지 않은 상세 탭입니다.</p>
        <button className="button" onClick={() => change({ tab: "momentum" })}>
          기세 분석으로
        </button>
      </section>
    );
  return (
    <Tabs.Root value={tab} onValueChange={(tab) => change({ tab })}>
      <Tabs.List className="ds-tabs" aria-label="선수 상세 정보">
        <Tabs.Trigger value="momentum">기세 분석</Tabs.Trigger>
        <Tabs.Trigger value="season">시즌 기록</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="momentum">{children}</Tabs.Content>
      <Tabs.Content value="season">{season}</Tabs.Content>
    </Tabs.Root>
  );
}
