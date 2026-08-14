import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A repo with a main branch and a feature branch containing one modified,
// one added, and one renamed file.
export function createFixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "inspector-fixture-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-b", "main");
  git("config", "user.email", "fixture@example.com");
  git("config", "user.name", "Fixture");
  writeFileSync(join(dir, "a.txt"), "one\n");
  writeFileSync(join(dir, "keep-me.txt"), "stable content that stays identical\n");
  git("add", ".");
  git("commit", "-m", "base");
  git("checkout", "-b", "feature");
  writeFileSync(join(dir, "a.txt"), "one\ntwo\n");
  writeFileSync(join(dir, "b.txt"), "new file\n");
  git("mv", "keep-me.txt", "kept.txt");
  git("add", ".");
  git("commit", "-m", "feature work");
  return dir;
}
