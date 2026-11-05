import { expect, it } from "vitest";
import { directoryReturnHref } from "../../src/ui/player-navigation";

it("preserves a directory query while rejecting foreign, malformed and unsupported destinations", () => {
  expect(
    directoryReturnHref(
      "/players?team=sample_0&role=starter&sort=score&page=2",
    ),
  ).toBe("/players?team=sample_0&role=starter&sort=score&page=2");
  expect(directoryReturnHref("/players?")).toBe("/players?");
  for (const raw of [
    null,
    "https://example.com/players?role=starter",
    "//example.com/players?role=starter",
    "/players/other?role=starter",
    "/players?season=2025",
    "/players?role=starter&role=reliever",
    "/players?role=starter#other",
    "/players?returnTo=/admin",
    "/admin",
    `/players?q=${"a".repeat(2100)}`,
  ])
    expect(directoryReturnHref(raw)).toBe("/players");
});
