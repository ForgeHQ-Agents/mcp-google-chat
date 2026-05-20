#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as client from "./client.js";
import * as formatters from "./formatters.js";
import {
  ListSpacesSchema,
  type ListSpacesInput,
  ListMessagesSchema,
  type ListMessagesInput,
  GetMessageSchema,
  type GetMessageInput,
  ListMembersSchema,
  type ListMembersInput,
} from "./schemas.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Google Chat MCP Server

Usage: mcp-google-chat [options]

Options:
  --help, -h    Show this help

Environment:
  GOOGLE_SERVICE_ACCOUNT_PATH  Path to the Chat App service account JSON key.
  MGR_ALLOWED_SPACE_IDS        Comma-separated allowlist of Chat space IDs
                               (e.g. "spaces/AAA,spaces/BBB"). Empty means none.
`);
    process.exit(0);
  }

  const server = new McpServer({
    name: "google-chat-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "google_chat_list_spaces",
    {
      title: "List Allowed Google Chat Spaces",
      description:
        "List the Google Chat spaces this agent is allowed to read. The list reflects the per-agent allowlist set in manegr.",
      inputSchema: ListSpacesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListSpacesInput) => {
      try {
        const spaces = await client.listSpaces();
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(spaces, null, 2) }] };
        }
        return { content: [{ type: "text", text: formatters.formatSpacesMarkdown(spaces) }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "google_chat_list_messages",
    {
      title: "List Messages in a Chat Space",
      description:
        "List recent messages in a Google Chat space. Hard-errors if the space is not in this agent's allowlist.",
      inputSchema: ListMessagesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListMessagesInput) => {
      try {
        const result = await client.listMessages(
          params.space_id,
          params.page_size,
          params.page_token,
          params.filter,
        );
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return {
          content: [
            {
              type: "text",
              text: formatters.formatMessagesMarkdown(params.space_id, result.messages, result.nextPageToken),
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "google_chat_get_message",
    {
      title: "Get a Single Chat Message",
      description:
        "Fetch a single Google Chat message by id. Hard-errors if the space is not in this agent's allowlist.",
      inputSchema: GetMessageSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetMessageInput) => {
      try {
        const message = await client.getMessage(params.space_id, params.message_id);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(message, null, 2) }] };
        }
        return {
          content: [{ type: "text", text: formatters.formatMessageMarkdown(message) }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "google_chat_list_members",
    {
      title: "List Members of a Chat Space",
      description:
        "List members of a Google Chat space. Hard-errors if the space is not in this agent's allowlist.",
      inputSchema: ListMembersSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListMembersInput) => {
      try {
        const result = await client.listMembers(params.space_id, params.page_size, params.page_token);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return {
          content: [
            {
              type: "text",
              text: formatters.formatMembersMarkdown(params.space_id, result.members, result.nextPageToken),
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Chat MCP Server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
