import { describe, expect, it } from "vitest";
import { runValidation } from "../src/validation.js";

describe("runValidation", () => {
  it("reports a passing command", async () => {
    const result = await runValidation('node -e "console.log(42)"', process.cwd());
    expect(result.status).toBe("passed");
    expect(result.output).toContain("42");
  });

  it("reports a failing command instead of throwing", async () => {
    const result = await runValidation('node -e "console.error(\'boom\'); process.exit(3)"', process.cwd());
    expect(result.status).toBe("failed");
    expect(result.output).toContain("boom");
    expect(result.output).toContain("exit code 3");
  });
});
