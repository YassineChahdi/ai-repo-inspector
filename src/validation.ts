import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

const TIMEOUT_MS = 10 * 60 * 1000;

export function runValidation(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      if (error) {
        const reason = error.killed
          ? `terminated: timed out after ${TIMEOUT_MS} ms or was killed`
          : `exit code ${error.code ?? "unknown"}`;
        resolve({
          command,
          status: "failed",
          output: output ? `${output}\n[${reason}]` : `[${reason}]`,
        });
        return;
      }
      resolve({ command, status: "passed", output });
    });
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
