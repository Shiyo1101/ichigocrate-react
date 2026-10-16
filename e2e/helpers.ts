import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import type { InstanceConfig, InstanceEvents } from "./fixture/api";

/** フィクスチャページを開き、指定インスタンスをマウントして操作可能になるまで待つ。 */
export async function mount(page: Page, instances: InstanceConfig[]): Promise<void> {
  await page.goto("");
  await page.waitForFunction(() => "fixture" in window);
  await page.evaluate((configs) => window.fixture.mount(configs), instances);
  await Promise.all(
    instances.map(({ id, viaHook }) =>
      viaHook
        ? expect.poll(() => screenText(page, id).catch(() => "")).toContain("OK")
        : expect.poll(() => events(page, id).then((e) => e.readyCount)).toBeGreaterThan(0),
    ),
  );
}

export function canvas(page: Page, id: string): Locator {
  return page.getByTestId(id).locator("canvas");
}

export function events(page: Page, id: string): Promise<InstanceEvents> {
  return page.evaluate((target) => window.fixture.events(target), id);
}

export function screenText(page: Page, id: string): Promise<string> {
  return page.evaluate((target) => window.fixture.handle(target).getScreenText(), id);
}

/** ハンドルの exec を呼ぶ。即時文は呼び出し内で完了する。 */
export function exec(page: Page, id: string, line: string): Promise<void> {
  return page.evaluate(([target, l]) => window.fixture.handle(target).exec(l), [id, line] as const);
}

export function getVar(page: Page, id: string, name: string): Promise<number> {
  return page.evaluate(([target, n]) => window.fixture.handle(target).getVar(n), [
    id,
    name,
  ] as const);
}

/** 画面に text が現れるまで待つ (RUN 等はフレーム単位で進むため)。 */
export async function waitForScreen(page: Page, id: string, text: string): Promise<void> {
  await expect.poll(() => screenText(page, id)).toContain(text);
}
