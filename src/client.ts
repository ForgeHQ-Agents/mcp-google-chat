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
