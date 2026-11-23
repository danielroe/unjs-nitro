import { fileURLToPath } from "node:url";
import { build, createDevServer, createNitro, prepare } from "../../src/core";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("fixture", import.meta.url));

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startDevServer(name: string) {
  const nitro = await createNitro({
    rootDir,
    dev: true,
    preset: "nitro-dev",
    buildDir: fileURLToPath(new URL(`.nitro/${name}`, import.meta.url)),
    output: {
      dir: fileURLToPath(
        new URL(`.output-worker-reload/${name}`, import.meta.url)
      ),
    },
  });
  const devServer = createDevServer(nitro);
  const server = await devServer.listen(0, { hostname: "127.0.0.1" });
  await prepare(nitro);
  const ready = new Promise<void>((resolve) => {
    nitro.hooks.hook("dev:reload", () => resolve());
  });
  await build(nitro);
  await ready;
  return {
    devServer,
    base: server.url,
    async close() {
      await devServer.close();
      await nitro.close();
    },
  };
}

async function getWorkerState(base: string, path: string) {
  const response = await fetch(base + path);
  expect(response.status).toBe(200);
  return (await response.json()) as { threadId: number; id: string };
}

describe("nitro:dev:worker-reload", () => {
  it("finishes in-flight requests on a worker that is being replaced", async () => {
    const { devServer, base, close } = await startDevServer("reload");
    try {
      const current = await getWorkerState(base, "state");
      const slow = getWorkerState(base, "slow");
      await delay(300);
      devServer.reload();

      const [slowState, nextState] = await Promise.all([
        slow,
        getWorkerState(base, "state"),
      ]);
      expect(slowState).toEqual(current);
      expect(nextState).not.toEqual(current);
    } finally {
      await close();
    }
  }, 30_000);

  it("stops waiting for in-flight requests after the shutdown timeout", async () => {
    const { devServer, base, close } = await startDevServer("timeout");
    process.env.NITRO_SHUTDOWN_TIMEOUT = "1";
    try {
      await getWorkerState(base, "state");
      const hang = fetch(base + "hang");
      await delay(300);
      devServer.reload();

      const response = await hang;
      expect(response.status).toBe(503);
    } finally {
      delete process.env.NITRO_SHUTDOWN_TIMEOUT;
      await close();
    }
  }, 30_000);
});
