import { directoryQuery } from "@/contracts/player-directory";

/** Only a validated local directory query may be used as a return destination. */
export function directoryReturnHref(raw: string | null): string {
  if (!raw || raw.length > 2000) return "/players";
  try {
    const url = new URL(raw, "http://local");
    if (
      !raw.startsWith("/players?") ||
      url.origin !== "http://local" ||
      url.pathname !== "/players" ||
      url.hash
    )
      return "/players";
    const params = url.searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length)
      return "/players";
    if (!directoryQuery.safeParse(Object.fromEntries(params)).success)
      return "/players";
    return `/players?${params}`;
  } catch {
    return "/players";
  }
}
