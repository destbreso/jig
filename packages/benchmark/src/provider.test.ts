// A spec's model names its provider by an entry of the person's config, by a kind, or by a preset's name.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { providerFor } from "./provider.js";

describe("the provider of a spec's model", () => {
  let dir: string;
  const saved = { ...process.env };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jig-benchmark-test-provider-"));
    // An empty config of the person's own, so the test never reads the machine's.
    process.env.JIG_CONFIG_DIR = join(dir, "config");
    delete process.env.NVIDIA_API_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
    rmSync(dir, { recursive: true, force: true });
  });

  it("takes a preset's name with no entry configured, its key from the preset's variable, and keeps the slashes of the model's own name", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test-key";
    const p = await providerFor("nvidia/meta/llama-3.3-70b-instruct", dir);
    expect(p.entry).toMatchObject({ name: "nvidia", kind: "openai-compatible", preset: "nvidia", baseUrl: "https://integrate.api.nvidia.com/v1", key: "env:NVIDIA_API_KEY" });
    expect(p.model).toBe("meta/llama-3.3-70b-instruct");
  });

  it("says when a preset's key is missing", async () => {
    await expect(providerFor("nvidia/meta/llama-3.3-70b-instruct", dir)).rejects.toThrow(/nvidia has no key/);
  });
});
