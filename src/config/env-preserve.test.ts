import { describe, expect, it } from "vitest";
import { restoreEnvVarRefs } from "./env-preserve.js";

describe("restoreEnvVarRefs", () => {
  const env = {
    TELEGRAM_BOT_TOKEN: "tg-secret-123",
    LOCAL_TOKEN: "local-secret-456",
  } satisfies Record<string, string>;

  it("restores a simple env-var reference when the resolved value matches", () => {
    const incoming = { channels: { telegram: { botToken: "tg-secret-123" } } };
    const parsed = { channels: { telegram: { botToken: "${TELEGRAM_BOT_TOKEN}" } } };

    expect(restoreEnvVarRefs(incoming, parsed, env)).toEqual({
      channels: { telegram: { botToken: "${TELEGRAM_BOT_TOKEN}" } },
    });
  });

  it("keeps the caller value when the value was intentionally changed", () => {
    const incoming = { channels: { telegram: { botToken: "new-token" } } };
    const parsed = { channels: { telegram: { botToken: "${TELEGRAM_BOT_TOKEN}" } } };

    expect(restoreEnvVarRefs(incoming, parsed, env)).toEqual(incoming);
  });

  it("restores escaped templates as escaped templates", () => {
    const incoming = { note: "${LOCAL_TOKEN}" };
    const parsed = { note: "$${LOCAL_TOKEN}" };

    expect(restoreEnvVarRefs(incoming, parsed, env)).toEqual({
      note: "$${LOCAL_TOKEN}",
    });
  });

  it("walks arrays and nested objects", () => {
    const incoming = {
      providers: [{ token: "tg-secret-123" }, { token: "literal" }],
    };
    const parsed = {
      providers: [{ token: "${TELEGRAM_BOT_TOKEN}" }, { token: "literal" }],
    };

    expect(restoreEnvVarRefs(incoming, parsed, env)).toEqual({
      providers: [{ token: "${TELEGRAM_BOT_TOKEN}" }, { token: "literal" }],
    });
  });
});
