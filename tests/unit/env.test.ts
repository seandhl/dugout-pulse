import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env";
describe("DEMO-only environment", () => {
  it("accepts only explicit DEMO fixture profiles", () => {
    expect(parseEnv({ DEMO_PROFILE: "" }).DEMO_PROFILE).toBe("default");
    expect(parseEnv({ DEMO_PROFILE: "performance" }).DEMO_PROFILE).toBe(
      "performance",
    );
    expect(() => parseEnv({ DEMO_PROFILE: "external" })).toThrow();
  });
  it("defaults missing or empty mode to DEMO", () => {
    expect(parseEnv({}).DATA_MODE).toBe("DEMO");
    expect(parseEnv({ DATA_MODE: "" }).DATA_MODE).toBe("DEMO");
  });
  it("rejects real-data mode", () => {
    expect(() => parseEnv({ DATA_MODE: "APPROVED" })).toThrow();
  });
});
