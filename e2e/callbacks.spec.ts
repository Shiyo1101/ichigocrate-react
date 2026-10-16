import { expect, test } from "@playwright/test";
import { events, exec, mount, screenText, waitForScreen } from "./helpers";

const ID = "main";

test("defaultProgram と autoRun はマウント時に一度だけ適用される", async ({ page }) => {
  await mount(page, [
    { id: ID, persist: false, defaultProgram: '10 PRINT "HELLO"\n20 END', autoRun: true },
  ]);
  await waitForScreen(page, ID, "HELLO");
  // StrictMode の二重マウントでもプログラムが二重に走らない。
  await expect.poll(() => events(page, ID).then((e) => e.printed)).toBe("HELLO\nOK\n");
});

test("autoRun なしの defaultProgram は格納だけされる", async ({ page }) => {
  await mount(page, [{ id: ID, persist: false, defaultProgram: "10 PRINT 99" }]);
  // 実行されていれば単独の "99" 行が画面に出る。
  expect((await screenText(page, ID)).split("\n")).not.toContain("99");
  await exec(page, ID, "LIST");
  await waitForScreen(page, ID, "10 PRINT 99");
});

test("onReady は StrictMode 下でも有効なランナーに対して一度だけ呼ばれる", async ({ page }) => {
  await mount(page, [{ id: ID, persist: false }]);
  expect((await events(page, ID)).readyCount).toBe(1);
});

test("onPrint は起動バナーを含まず、以降の出力だけを流す", async ({ page }) => {
  await mount(page, [{ id: ID, persist: false }]);
  await exec(page, ID, "PRINT 1+2");
  await expect.poll(() => events(page, ID).then((e) => e.printed)).toBe("3\nOK\n");
});

test("onPrint は reset 後もバナーを流さない", async ({ page }) => {
  await mount(page, [{ id: ID, persist: false }]);
  await page.evaluate((id) => window.fixture.handle(id).reset(), ID);
  await exec(page, ID, "?7");
  await expect.poll(() => events(page, ID).then((e) => e.printed)).toBe("7\nOK\n");
});

test("onError は実行時エラーの番号と文言を受け取る", async ({ page }) => {
  await mount(page, [{ id: ID, persist: false }]);
  await exec(page, ID, "?1/0");
  await exec(page, ID, "LOAD 15");
  await expect
    .poll(() => events(page, ID).then((e) => e.errors))
    .toEqual([
      { code: 6, message: "Divide by 0" },
      { code: 8, message: "File error" },
    ]);
});

test("onError は RUN 中のエラーも通知し、ESC=Break は通知しない", async ({ page }) => {
  await mount(page, [{ id: ID, persist: false }]);
  await page.evaluate((id) => {
    const h = window.fixture.handle(id);
    h.loadProgram("10 A=A+1\n20 IF A>30 PRINT 1/0\n30 GOTO 10");
    h.run();
  }, ID);
  await expect.poll(() => events(page, ID).then((e) => e.errors.length)).toBe(1);

  await page.evaluate((id) => {
    const h = window.fixture.handle(id);
    h.loadProgram("10 GOTO 10");
    h.run();
    h.break();
  }, ID);
  await waitForScreen(page, ID, "Break in 10");
  expect((await events(page, ID)).errors).toEqual([{ code: 6, message: "Divide by 0" }]);
});
