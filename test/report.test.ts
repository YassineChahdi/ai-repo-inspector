import { describe, expect, it } from "vitest";
import { markdownReport } from "../src/report.js";

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [{ command: "npm test", status: "passed", output: "ok" }],
    });

    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
  });

  it("marks failed validations", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [{ command: "npm test", status: "failed", output: "1 test failed" }],
    });

    expect(report).toContain("❌ failed");
  });

  it("keeps validation output containing backtick fences inside its code block", () => {
    const output = "before\n```\ninjected text\n```\nafter";
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [{ command: "npm test", status: "passed", output }],
    });

    const fences = report.match(/^`{3,}$/gm) ?? [];
    expect(fences.filter((fence) => fence.length > 3)).toHaveLength(2);
  });
});