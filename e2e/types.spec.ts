import { expect, test } from "@playwright/test";
import { isValidAddress } from "../src/types";

test("isValidAddress は #000-#117F の整数だけを有効とする", () => {
  expect(isValidAddress(0)).toBe(true);
  expect(isValidAddress(0x117f)).toBe(true);
  expect(isValidAddress(0x1180)).toBe(false);
  expect(isValidAddress(-1)).toBe(false);
  expect(isValidAddress(1.5)).toBe(false);
  expect(isValidAddress(Number.NaN)).toBe(false);
});
