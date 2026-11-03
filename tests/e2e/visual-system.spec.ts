import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const screens = [
  ["home", "/"],
  ["directory", "/players"],
  ["detail", "/players/demo_0_00"],
  ["rankings", "/rankings?date=2026-11-03"],
  ["compare", "/compare?players=demo_0_00,demo_0_03"],
] as const;

for (const width of [320, 375, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`B01 ${width}px ${theme}`, async ({ page }, testInfo) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((value) => {
        localStorage.setItem("theme", value);
      }, theme);
      for (const [name, path] of screens) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.locator(".skeleton")).toHaveCount(0);
        if (name === "directory")
          await expect(
            page.getByRole("list", { name: "선수 검색 결과" }),
          ).toBeVisible();
        if (name === "home")
          await expect(page.getByRole("tablist").first()).toBeVisible();
        await expect(
          page.getByRole("region", { name: "데모 안내" }),
        ).toContainText("DEMO");
        await expect(page.locator("html")).toHaveClass(
          theme === "dark" ? /dark/ : /^$/,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          path,
        ).toBe(true);
        expect(
          (await new AxeBuilder({ page }).analyze()).violations,
          path,
        ).toEqual([]);
        const smallTargets = await page.locator("body").evaluate((main) =>
          [
            ...main.querySelectorAll(
              "button, [role=button], input:not([type=hidden]), select, a, summary",
            ),
          ]
            .filter(
              (el) =>
                el.getClientRects().length &&
                !el.closest('[aria-hidden="true"], [inert]') &&
                getComputedStyle(el).visibility !== "hidden" &&
                getComputedStyle(el).pointerEvents !== "none",
            )
            .filter((el) => {
              const target = el.matches(
                'input[type="checkbox"], input[type="radio"]',
              )
                ? (el.closest("label") ?? el)
                : el;
              const r = target.getBoundingClientRect();
              return r.width < 44 || r.height < 44;
            })
            .map((el) => ({
              html: el.outerHTML.slice(0, 200),
              width: el.getBoundingClientRect().width,
              height: el.getBoundingClientRect().height,
            })),
        );
        expect(smallTargets, path).toEqual([]);
        const screenshotOptions = {
          fullPage: true,
          // Developer tooling is not part of the product baseline.
          style: "nextjs-portal { display: none !important; }",
          animations: "disabled" as const,
          mask: [page.locator("nextjs-portal")],
        };
        const filename = `${name}-${width}-${theme}.png`;
        // System fonts render differently by OS. The reviewed baseline is macOS;
        // other platforms still run every assertion and retain review captures.
        if (process.platform === "darwin") {
          await expect.soft(page).toHaveScreenshot(filename, screenshotOptions);
        } else {
          await testInfo.attach(filename, {
            body: await page.screenshot(screenshotOptions),
            contentType: "image/png",
          });
        }
      }
    });
  }
}
