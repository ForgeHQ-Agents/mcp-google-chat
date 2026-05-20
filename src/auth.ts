import { JWT } from "google-auth-library";
import * as fs from "fs";

// Chat scopes for app authentication (service account acting as a Chat App).
//
// Google's auth model splits scopes into two families:
//   - `chat.bot` — legacy broad scope, works for a SUBSET of methods (spaces.list,
//     members.list, sending messages). Does NOT cover messages.list / messages.get.
//     No admin approval required.
//   - `chat.app.*` — granular scopes introduced 2025–2026. Required for reading
//     message history under app auth. Each requires ONE-TIME admin approval via
//     Workspace Marketplace install in admin.google.com.
//
// Reactions (spaces.messages.reactions.*) currently support USER auth only —
// there is no chat.app.reactions scope. The reaction tools in this MCP will
// return a clear permission error until user-auth/DWD is configured. We leave
// them registered so the agent surface is stable; runtime failures are honest.
//
// Outer trust gates: SA must be configured as a Chat App in GCP and added to
// each space in Google Chat. Inner gate: MGR_ALLOWED_SPACE_IDS allowlist
// (gates every method that takes a space_id).
export const SCOPES = [
  // Broad legacy scope — covers spaces.list and members.list with no admin approval
  "https://www.googleapis.com/auth/chat.bot",
  // Granular scope — required for messages.list/get under app auth (admin-approved)
  "https://www.googleapis.com/auth/chat.app.spaces.readonly",
  "https://www.googleapis.com/auth/chat.app.messages.readonly",
  "https://www.googleapis.com/auth/chat.app.memberships.readonly",
];

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || "";

let cachedJwtClient: JWT | null = null;

export async function getAuthenticatedClient(): Promise<JWT> {
  if (cachedJwtClient) return cachedJwtClient;

  if (!SERVICE_ACCOUNT_PATH) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_PATH is not set.");
  }
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account key not found at ${SERVICE_ACCOUNT_PATH}.`);
  }

  const content = fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8");
  const key = JSON.parse(content);
  if (key.type !== "service_account") {
    throw new Error('Invalid key file: expected type "service_account".');
  }

  const jwtClient = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });

  await jwtClient.authorize();
  cachedJwtClient = jwtClient;
  return jwtClient;
}

// Parse and freeze the allowlist at startup. Empty allowlist = agent can read
// nothing. We don't watch for changes — the resolver re-spawns this MCP server
// every run, so the allowlist always reflects current per-agent credentials.
function parseAllowlist(): Set<string> {
  const raw = process.env.MGR_ALLOWED_SPACE_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return new Set(ids);
}

const ALLOWED_SPACE_IDS = parseAllowlist();

export function getAllowedSpaceIds(): Set<string> {
  return ALLOWED_SPACE_IDS;
}

/** Throws if the given space_id is not in the agent's allowlist. */
export function assertSpaceAllowed(spaceId: string): void {
  if (!ALLOWED_SPACE_IDS.has(spaceId)) {
    throw new Error(
      `Space "${spaceId}" is not in this agent's allowlist. Ask the agent owner to add it via the manegr settings.`,
    );
  }
}
