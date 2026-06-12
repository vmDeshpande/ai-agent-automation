import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "demo-mcp-server",
  version: "1.0.0",
});

server.registerTool(
  "echo",
  {
    description: "Echoes the provided text and metadata.",
    inputSchema: {
      text: z.string(),
      taskId: z.string().optional(),
    },
  },
  async ({ text, taskId }) => ({
    content: [
      {
        type: "text",
        text: `echo:${text}`,
      },
    ],
    structuredContent: {
      echoed: text,
      taskId: taskId || null,
    },
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
