import { expect, test } from "@playwright/test";
import { events, exec, mount, waitForScreen } from "./helpers";

test("persist=true の SAVE はリロード後も LOAD できる", async ({ page }) => {
  await mount(page, [{ id: "main", storagePrefix: "e2e-persist-" }]);
  await page.evaluate(() => window.fixture.handle("main").loadProgram("10 PRINT 123"));
  await exec(page, "main", "SAVE 3");
  expect(await page.evaluate(() => localStorage.getItem("e2e-persist-slot_03"))).not.toBeNull();

  await page.reload();
  await mount(page, [{ id: "main", storagePrefix: "e2e-persist-" }]);
  await exec(page, "main", "LOAD 3");
  await exec(page, "main", "RUN");
  await waitForScreen(page, "main", "123");
});

test("storagePrefix が異なるインスタンスはスロットを共有しない", async ({ page }) => {
  await mount(page, [
    { id: "a", storagePrefix: "e2e-a-" },
    { id: "b", storagePrefix: "e2e-b-" },
  ]);
  await page.evaluate(() => window.fixture.handle("a").loadProgram("10 PRINT 1"));
  await exec(page, "a", "SAVE 2");
  await exec(page, "b", "LOAD 2");
  expect((await events(page, "b")).errors).toEqual([{ code: 8, message: "File error" }]);
});

test("persist=false は localStorage を使わずリロードで消える", async ({ page }) => {
  await mount(page, [{ id: "main", storagePrefix: "e2e-volatile-", persist: false }]);
  await page.evaluate(() => window.fixture.handle("main").loadProgram("10 PRINT 1"));
  await exec(page, "main", "SAVE 4");
  expect((await events(page, "main")).errors).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("e2e-volatile-slot_04"))).toBeNull();

  // 同一セッション内では読み戻せる。
  await exec(page, "main", "NEW");
  await exec(page, "main", "LOAD 4");
  expect((await events(page, "main")).errors).toEqual([]);

  await page.reload();
  await mount(page, [{ id: "main", storagePrefix: "e2e-volatile-", persist: false }]);
  await exec(page, "main", "LOAD 4");
  expect((await events(page, "main")).errors).toEqual([{ code: 8, message: "File error" }]);
});
