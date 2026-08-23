import { describe, expect, it } from "vitest";
import { detectPlatform, isStandalone } from "./platform";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const IPAD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0";

describe("detectPlatform", () => {
  it("detects iPhone", () => {
    expect(detectPlatform(IPHONE_UA)).toBe("ios");
  });

  it("detects iPad reporting as Macintosh with touch", () => {
    expect(detectPlatform(IPAD_UA)).toBe("ios");
  });

  it("detects Android", () => {
    expect(detectPlatform(ANDROID_UA)).toBe("android");
  });

  it("falls back to desktop", () => {
    expect(detectPlatform(DESKTOP_UA)).toBe("desktop");
  });
});

describe("isStandalone", () => {
  it("is true when iOS Safari's navigator.standalone is set", () => {
    expect(isStandalone({ standalone: true })).toBe(true);
  });

  it("is true when the display-mode media query matches", () => {
    expect(isStandalone({ matchesStandaloneMediaQuery: true })).toBe(true);
  });

  it("is false in a plain browser tab", () => {
    expect(
      isStandalone({ standalone: false, matchesStandaloneMediaQuery: false }),
    ).toBe(false);
  });

  it("is false when neither signal is present", () => {
    expect(isStandalone({})).toBe(false);
  });
});
