import type { ChangedFile, ValidationResult } from "./types.js";

type ReportInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

// A fence longer than any backtick run in the content keeps command output
// from breaking out of its code block (and into an AI client's context).
function fenced(text: string): string {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  return [fence, text, fence].join("\n");
}

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];
  if (input.changedFiles.length === 0) {
    lines.push("- (none)");
  }
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }
  lines.push("", "## Validation output");
  if (input.validationResults.length === 0) {
    lines.push("No validation commands were run.");
  }
  for (const result of input.validationResults) {
    const marker = result.status === "passed" ? "✅ passed" : "❌ failed";
    lines.push(`### ${result.command} — ${marker}`, fenced(result.output));
  }
  return lines.join("\n");
}