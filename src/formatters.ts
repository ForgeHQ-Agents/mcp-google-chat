import type { chat_v1 } from "googleapis";
import type { SpaceSummary } from "./client.js";

export function formatSpacesMarkdown(spaces: SpaceSummary[]): string {
  if (spaces.length === 0) {
    return "No allowed spaces. Ask the agent owner to grant access to one or more spaces in manegr settings.";
  }
  const lines = ["# Allowed Chat Spaces", ""];
  for (const s of spaces) {
    const label = s.displayName || "(no display name)";
    lines.push(`- **${label}** — \`${s.name}\` (${s.spaceType || "unknown"})`);
  }
  return lines.join("\n");
}

export function formatMessageMarkdown(m: chat_v1.Schema$Message): string {
  const sender = m.sender?.displayName || m.sender?.name || "unknown";
  const created = m.createTime || "unknown time";
  const body = (m.text ?? m.formattedText ?? "").trim() || "(no text content)";
  const id = m.name ?? "(no id)";
  const thread = m.thread?.name ? `\n*Thread*: \`${m.thread.name}\`` : "";
  return [
    `**${sender}** · ${created}`,
    `*Id*: \`${id}\`${thread}`,
    "",
    body,
  ].join("\n");
}

export function formatMessagesMarkdown(
  spaceId: string,
  messages: chat_v1.Schema$Message[],
  nextPageToken?: string,
): string {
  if (messages.length === 0) {
    return `# Messages in ${spaceId}\n\nNo messages.`;
  }
  const blocks = messages.map((m) => formatMessageMarkdown(m));
  let out = `# Messages in ${spaceId}\n\n${blocks.join("\n\n---\n\n")}`;
  if (nextPageToken) out += `\n\n*More messages available. Use page_token: "${nextPageToken}"*`;
  return out;
}

export function formatMembersMarkdown(
  spaceId: string,
  members: chat_v1.Schema$Membership[],
  nextPageToken?: string,
): string {
  if (members.length === 0) {
    return `# Members of ${spaceId}\n\nNo members.`;
  }
  const lines = [`# Members of ${spaceId}`, ""];
  for (const m of members) {
    const displayName = m.member?.displayName || m.member?.name || "unknown";
    const role = m.role ?? "MEMBER";
    const state = m.state ?? "";
    lines.push(`- ${displayName} — ${role}${state ? ` (${state})` : ""}`);
  }
  if (nextPageToken) lines.push("", `*More members available. Use page_token: "${nextPageToken}"*`);
  return lines.join("\n");
}
