import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createConfigIO } from "./io.js";

async function withTempConfig(
  configContent: string,
  run: (params: { configPath: string; dir: string }) => Promise<void>,
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-9813-"));
  const configPath = path.join(dir, "openclaw.json");
  await fs.writeFile(configPath, configContent, "utf-8");
  try {
    await run({ configPath, dir });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("writeConfigFile env-ref preservation", () => {
  it("preserves ${ENV_VAR} references when only meta is updated", async () => {
    await withTempConfig(
      JSON.stringify(
        {
          channels: {
            telegram: {
              botToken: "${TELEGRAM_BOT_TOKEN}",
            },
          },
        },
        null,
        2,
      ),
      async ({ configPath }) => {
        const io = createConfigIO({
          configPath,
          env: { TELEGRAM_BOT_TOKEN: "tg-secret-123" } as NodeJS.ProcessEnv,
        });

        const loaded = io.loadConfig();
        await io.writeConfigFile(loaded);

        const written = JSON.parse(await fs.readFile(configPath, "utf-8")) as {
          meta?: { lastTouchedAt?: string };
          channels?: { telegram?: { botToken?: string } };
        };

        expect(written.channels?.telegram?.botToken).toBe("${TELEGRAM_BOT_TOKEN}");
        expect(typeof written.meta?.lastTouchedAt).toBe("string");
      },
    );
  });

  it("preserves references backed by config.env values", async () => {
    await withTempConfig(
      JSON.stringify(
        {
          env: {
            LOCAL_GATEWAY_TOKEN: "local-secret-456",
          },
          gateway: {
            auth: {
              token: "${LOCAL_GATEWAY_TOKEN}",
            },
          },
        },
        null,
        2,
      ),
      async ({ configPath }) => {
        const env = {} as NodeJS.ProcessEnv;
        const io = createConfigIO({ configPath, env });

        const loaded = io.loadConfig();
        await io.writeConfigFile(loaded);

        const written = JSON.parse(await fs.readFile(configPath, "utf-8")) as {
          gateway?: { auth?: { token?: string } };
        };

        expect(written.gateway?.auth?.token).toBe("${LOCAL_GATEWAY_TOKEN}");
      },
    );
  });

  it("fails closed when the existing config cannot be parsed for safe preservation", async () => {
    await withTempConfig("{ invalid json5", async ({ configPath }) => {
      const io = createConfigIO({
        configPath,
        env: { TELEGRAM_BOT_TOKEN: "tg-secret-123" } as NodeJS.ProcessEnv,
      });

      await expect(
        io.writeConfigFile({
          channels: {
            telegram: {
              botToken: "tg-secret-123",
            },
          },
        }),
      ).rejects.toThrow("unable to preserve env-var references safely");
    });
  });
});
