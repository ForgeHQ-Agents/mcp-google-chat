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
  AddReactionSchema,
  type AddReactionInput,
  RemoveReactionSchema,
  type RemoveReactionInput,
  ListReactionsSchema,
  type ListReactionsInput,
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
    version: "1.1.1",
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

  // ============================================================
  // REACTIONS — write surface (gated by the same allowlist as reads)
  // ============================================================

  server.registerTool(
    "google_chat_add_reaction",
    {
      title: "Add Emoji Reaction to a Chat Message",
      description:
        "React to a Google Chat message with a Unicode emoji (e.g. \"👍\", \"✅\"). Hard-errors if the space is not in this agent's allowlist. Reactions are visible to everyone in the space; use them to acknowledge, classify, or signal status without posting a full message.",
      inputSchema: AddReactionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: AddReactionInput) => {
      try {
        const reaction = await client.addReaction(params.space_id, params.message_id, params.emoji);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(reaction, null, 2) }] };
        }
        return {
          content: [
            { type: "text", text: `Reacted with ${params.emoji} on \`${params.message_id}\`.` },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "google_chat_remove_reaction",
    {
      title: "Remove Bot's Emoji Reaction from a Chat Message",
      description:
        "Remove a reaction the bot previously added. Only removes the bot's own reactions; other users' reactions are untouched. Idempotent: if the bot has no matching reaction, this returns success with removed=false.",
      inputSchema: RemoveReactionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: RemoveReactionInput) => {
      try {
        const removed = await client.removeReaction(params.space_id, params.message_id, params.emoji);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify({ removed }, null, 2) }] };
        }
        return {
          content: [
            {
              type: "text",
              text: removed
                ? `Removed ${params.emoji} from \`${params.message_id}\`.`
                : `No ${params.emoji} reaction from the bot was found on \`${params.message_id}\`.`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "google_chat_list_reactions",
    {
      title: "List Reactions on a Chat Message",
      description:
        "List all emoji reactions on a Google Chat message, grouped by emoji with counts. Useful to check whether the bot has already reacted before adding a duplicate.",
      inputSchema: ListReactionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListReactionsInput) => {
      try {
        const result = await client.listReactions(
          params.space_id,
          params.message_id,
          params.page_size,
          params.page_token,
        );
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return {
          content: [
            {
              type: "text",
              text: formatters.formatReactionsMarkdown(
                params.space_id,
                params.message_id,
                result.reactions,
                result.nextPageToken,
              ),
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
