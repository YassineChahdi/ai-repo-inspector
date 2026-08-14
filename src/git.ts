import { execFileSync } from "node:child_process";
import type { ChangedFile } from "./types.js";

function git(repositoryPath: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: repositoryPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`git ${args[0]} failed in ${repositoryPath}: ${stderr || (error as Error).message}`);
  }
}

function refExists(repositoryPath: string, ref: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], {
      cwd: repositoryPath,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? (refExists(repositoryPath, "main") ? "main" : "master");
  const output = git(repositoryPath, ["diff", "--name-status", `${base}...HEAD`]);

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      // Rename/copy lines look like "R100\told-path\tnew-path"; report the new path.
      const [code, ...pathParts] = line.split("\t");
      const kind = code[0];
      const status =
        kind === "A" ? "added"
        : kind === "D" ? "deleted"
        : kind === "R" ? "renamed"
        : kind === "C" ? "added"
        : "modified";
      const path = kind === "R" || kind === "C" ? pathParts[pathParts.length - 1] : pathParts.join("\t");
      return { path, status };
    });
}
