import { describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";
import { createFixtureRepo } from "./fixtures.js";

describe("changedFiles", () => {
  it("detects modified, added, and renamed files against the default base", () => {
    const repo = createFixtureRepo();
    const files = changedFiles(repo);
    expect(files).toContainEqual({ path: "a.txt", status: "modified" });
    expect(files).toContainEqual({ path: "b.txt", status: "added" });
    expect(files).toContainEqual({ path: "kept.txt", status: "renamed" });
  });

  it("throws a clear error for an unknown base ref", () => {
    const repo = createFixtureRepo();
    expect(() => changedFiles(repo, "no-such-branch")).toThrowError(/git diff failed/);
  });
});
