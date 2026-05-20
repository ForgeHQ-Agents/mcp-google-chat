import { google, chat_v1 } from "googleapis";
import { getAuthenticatedClient, assertSpaceAllowed, getAllowedSpaceIds } from "./auth.js";

let chatClient: chat_v1.Chat | null = null;

export async function getChatClient(): Promise<chat_v1.Chat> {
  if (chatClient) return chatClient;
  const auth = await getAuthenticatedClient();
  chatClient = google.chat({ version: "v1", auth });
  return chatClient;
}

export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("allowlist")) return `Error: ${error.message}`;
    if (message.includes("401") || message.includes("unauthorized")) {
      return "Error: Authentication failed. The Chat App may be misconfigured in Google Cloud.";
    }
    if (message.includes("403") || message.includes("forbidden")) {
      return "Error: Permission denied. The bot may not have been added to this space yet.";
    }
    if (message.includes("404") || message.includes("not found")) {
      return "Error: Not found. The space or message may have been deleted, or the bot was removed.";
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return "Error: Rate limit exceeded. Please wait before making more requests.";
    }
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

export interface SpaceSummary {
  name: string;
  displayName: string;
  spaceType: string;
}

/** List spaces the bot can see, filtered to the agent's allowlist. */
export async function listSpaces(): Promise<SpaceSummary[]> {
  const allowed = getAllowedSpaceIds();
  if (allowed.size === 0) return [];

  const chat = await getChatClient();
  const out: SpaceSummary[] = [];
  let pageToken: string | undefined;
  do {
    const res = await chat.spaces.list({ pageSize: 1000, pageToken });
    for (const s of res.data.spaces ?? []) {
      if (!s.name) continue;
      if (!allowed.has(s.name)) continue;
      out.push({
        name: s.name,
        displayName: s.displayName ?? "",
        spaceType: s.spaceType ?? s.type ?? "",
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export interface ListMessagesResult {
  messages: chat_v1.Schema$Message[];
  nextPageToken?: string;
}

export async function listMessages(
  spaceId: string,
  pageSize?: number,
  pageToken?: string,
  filter?: string,
): Promise<ListMessagesResult> {
  assertSpaceAllowed(spaceId);
  const chat = await getChatClient();
  const res = await chat.spaces.messages.list({
    parent: spaceId,
    pageSize: pageSize ?? 50,
    pageToken,
    filter,
  });
  return {
    messages: res.data.messages ?? [],
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

export async function getMessage(spaceId: string, messageId: string): Promise<chat_v1.Schema$Message> {
  assertSpaceAllowed(spaceId);
  // messageId may be either the short id (e.g. "AAAA...") or the full resource name
  // (e.g. "spaces/<space>/messages/AAAA..."). If it's a full resource name, parse
  // the embedded space and require it to match the allowlist AND the provided
  // space_id — otherwise an LLM could bypass the allowlist by smuggling a
  // different space inside the messageId.
  let name: string;
  if (messageId.startsWith("spaces/")) {
    const match = messageId.match(/^(spaces\/[A-Za-z0-9_-]+)\/messages\/[A-Za-z0-9._-]+$/);
    if (!match) {
      throw new Error(
        `message_id "${messageId}" is malformed. Pass the short id (e.g. "AAAA...") or a full resource name "spaces/<space>/messages/<id>".`,
      );
    }
    const embeddedSpace = match[1];
    if (embeddedSpace !== spaceId) {
      throw new Error(
        `message_id space ("${embeddedSpace}") does not match space_id ("${spaceId}"). Pass a message id that belongs to space_id.`,
      );
    }
    assertSpaceAllowed(embeddedSpace);
    name = messageId;
  } else {
    name = `${spaceId}/messages/${messageId}`;
  }
  const chat = await getChatClient();
  const res = await chat.spaces.messages.get({ name });
  return res.data;
}

export interface ListMembersResult {
  members: chat_v1.Schema$Membership[];
  nextPageToken?: string;
}

export async function listMembers(
  spaceId: string,
  pageSize?: number,
  pageToken?: string,
): Promise<ListMembersResult> {
  assertSpaceAllowed(spaceId);
  const chat = await getChatClient();
  const res = await chat.spaces.members.list({
    parent: spaceId,
    pageSize: pageSize ?? 100,
    pageToken,
  });
  return {
    members: res.data.memberships ?? [],
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

// ============================================================
// REACTIONS — write surface (gated by the same allowlist as reads)
// ============================================================

/** Resolves a message_id (short or full resource name) into a canonical name, asserting allowlist. */
function resolveMessageName(spaceId: string, messageId: string): string {
  assertSpaceAllowed(spaceId);
  if (messageId.startsWith("spaces/")) {
    const match = messageId.match(/^(spaces\/[A-Za-z0-9_-]+)\/messages\/[A-Za-z0-9._-]+$/);
    if (!match) {
      throw new Error(
        `message_id "${messageId}" is malformed. Pass the short id (e.g. "AAAA...") or a full resource name "spaces/<space>/messages/<id>".`,
      );
    }
    const embeddedSpace = match[1];
    if (embeddedSpace !== spaceId) {
      throw new Error(
        `message_id space ("${embeddedSpace}") does not match space_id ("${spaceId}"). Pass a message id that belongs to space_id.`,
      );
    }
    assertSpaceAllowed(embeddedSpace);
    return messageId;
  }
  return `${spaceId}/messages/${messageId}`;
}

export async function addReaction(
  spaceId: string,
  messageId: string,
  emoji: string,
): Promise<chat_v1.Schema$Reaction> {
  const parent = resolveMessageName(spaceId, messageId);
  const chat = await getChatClient();
  const res = await chat.spaces.messages.reactions.create({
    parent,
    requestBody: { emoji: { unicode: emoji } },
  });
  return res.data;
}

export interface ListReactionsResult {
  reactions: chat_v1.Schema$Reaction[];
  nextPageToken?: string;
}

export async function listReactions(
  spaceId: string,
  messageId: string,
  pageSize?: number,
  pageToken?: string,
): Promise<ListReactionsResult> {
  const parent = resolveMessageName(spaceId, messageId);
  const chat = await getChatClient();
  const res = await chat.spaces.messages.reactions.list({
    parent,
    pageSize: pageSize ?? 100,
    pageToken,
  });
  return {
    reactions: res.data.reactions ?? [],
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

/**
 * Remove a reaction the bot previously added. The Chat API only lets you delete
 * reactions you created, and only by resource name — so we list, find the
 * matching emoji authored by the calling app, and delete it.
 *
 * Returns true if a reaction was removed, false if the bot had no matching
 * reaction on this message (idempotent semantics).
 */
export async function removeReaction(
  spaceId: string,
  messageId: string,
  emoji: string,
): Promise<boolean> {
  const parent = resolveMessageName(spaceId, messageId);
  const chat = await getChatClient();

  // Filter server-side by emoji. We still need to identify the bot's own
  // reaction (vs another user's same emoji) — the listed reactions include
  // the `user` field for the reactor; for app-authored reactions this is
  // the Chat App itself, so any reaction we created matches our identity.
  // The API only permits deleting your own reactions, so a 403 on delete
  // is the failure mode if the matched reaction wasn't ours.
  let pageToken: string | undefined;
  do {
    const res = await chat.spaces.messages.reactions.list({
      parent,
      filter: `emoji.unicode = "${emoji.replace(/"/g, '\\"')}"`,
      pageSize: 100,
      pageToken,
    });
    for (const r of res.data.reactions ?? []) {
      if (!r.name) continue;
      try {
        await chat.spaces.messages.reactions.delete({ name: r.name });
        return true;
      } catch {
        // Not ours — keep looking through the page.
        continue;
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return false;
}
