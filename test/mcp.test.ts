import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/mcp-server.js";
import { createFixtureRepo } from "./fixtures.js";

async function callReview(args: Record<string, unknown>) {
  const server = createServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const result = await client.callTool({ name: "review_repository", arguments: args });
  await client.close();
  await server.close();
  return result;
}

describe("review_repository MCP tool", () => {
  it("returns a report for the repository path it was given", async () => {
    const repo = createFixtureRepo();
    const result = await callReview({ repositoryPath: repo });
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain("a.txt (modified)");
    expect(text).toContain("b.txt (added)");
  });

  it("returns a tool error instead of crashing for a bad path", async () => {
    const result = await callReview({ repositoryPath: "/definitely/not/a/repo" });
    expect(result.isError).toBe(true);
  });
});
