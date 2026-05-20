import { JWT } from "google-auth-library";
import * as fs from "fs";

// Read-only Chat scopes. The service account must be configured as a Chat App
// in Google Cloud and added to spaces in Google Chat — those are the outer
// trust gates. The per-agent allowlist (MGR_ALLOWED_SPACE_IDS) is the inner one.
export const SCOPES = [
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/chat.memberships.readonly",
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
