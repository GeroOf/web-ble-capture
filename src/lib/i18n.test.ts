import { describe, expect, it } from "vitest";
import {
  MESSAGES,
  getLocaleMeta,
  resolveLocalizedText,
  SUPPORTED_LOCALES,
  translate,
} from "./i18n";

describe("i18n", () => {
  it("keeps message keys aligned across locales", () => {
    const [baseLocale, ...otherLocales] = SUPPORTED_LOCALES;
    const baseKeys = Object.keys(MESSAGES[baseLocale]).sort();

    for (const locale of otherLocales) {
      expect(Object.keys(MESSAGES[locale]).sort()).toEqual(baseKeys);
    }
  });

  it("resolves localized structured messages", () => {
    expect(
      resolveLocalizedText("ja", {
        messageKey: "log.connectedTo",
        messageValues: { deviceName: "Sensor A" },
      }),
    ).toBe("Sensor A に接続しました");

    expect(
      resolveLocalizedText("en", {
        messageKey: "log.connectedTo",
        messageValues: { deviceName: "Sensor A" },
      }),
    ).toBe("Connected to Sensor A");
  });

  it("preserves legacy raw messages", () => {
    expect(resolveLocalizedText("ja", { message: "legacy message" })).toBe("legacy message");
  });

  it("returns locale specific metadata", () => {
    expect(getLocaleMeta("ja").title).toContain("ブラウザ完結");
    expect(getLocaleMeta("en").title).toContain("Browser-based");
  });

  it("interpolates parameterized labels", () => {
    expect(translate("ja", "history.logCount", { count: 5 })).toBe("5 件");
    expect(translate("en", "history.logCount", { count: 5 })).toBe("5 logs");
  });
});
