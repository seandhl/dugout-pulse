import "server-only";
import { headers } from "next/headers";
import { withPublication } from "./publication";
export async function withPagePublication<T>(run: () => T) {
  const h = await headers();
  return withPublication(h.get("x-pulse-release") ?? undefined, run);
}

export async function withoutReleaseQuery(
  values: Promise<Record<string, string | string[] | undefined>>,
) {
  const { releaseId: _releaseId, ...query } = await values;
  void _releaseId;
  return query;
}
