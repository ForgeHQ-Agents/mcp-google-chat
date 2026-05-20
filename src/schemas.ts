import { z } from "zod";

const SpaceIdSchema = z
  .string()
  .regex(/^spaces\/[A-Za-z0-9_-]+$/, "space_id must look like 'spaces/AAA...'");

const ResponseFormatSchema = z.enum(["markdown", "json"]).default("markdown");

export const ListSpacesSchema = {
  response_format: ResponseFormatSchema.optional(),
};
export type ListSpacesInput = {
  response_format?: "markdown" | "json";
};

export const ListMessagesSchema = {
  space_id: SpaceIdSchema,
  page_size: z.number().int().min(1).max(1000).optional(),
  page_token: z.string().optional(),
  filter: z
    .string()
    .optional()
    .describe(
      "Optional filter, e.g. 'createTime > \"2024-01-01T00:00:00Z\"' (see Chat API list filter syntax).",
    ),
  response_format: ResponseFormatSchema.optional(),
};
export type ListMessagesInput = {
  space_id: string;
  page_size?: number;
  page_token?: string;
  filter?: string;
  response_format?: "markdown" | "json";
};

export const GetMessageSchema = {
  space_id: SpaceIdSchema,
  message_id: z
    .string()
    .min(1)
    .describe(
      "Message id (e.g. 'AAAA...') or full resource name ('spaces/<space>/messages/AAAA...').",
    ),
  response_format: ResponseFormatSchema.optional(),
};
export type GetMessageInput = {
  space_id: string;
  message_id: string;
  response_format?: "markdown" | "json";
};

export const ListMembersSchema = {
  space_id: SpaceIdSchema,
  page_size: z.number().int().min(1).max(1000).optional(),
  page_token: z.string().optional(),
  response_format: ResponseFormatSchema.optional(),
};
export type ListMembersInput = {
  space_id: string;
  page_size?: number;
  page_token?: string;
  response_format?: "markdown" | "json";
};

// Unicode emoji constraint: at least one codepoint, reasonable upper bound.
// We don't try to parse "is this a real emoji" — the Chat API rejects bad ones.
const EmojiSchema = z
  .string()
  .min(1)
  .max(32)
  .describe('A single Unicode emoji (e.g. "👍", "✅", "🔥"). Custom org emojis are not supported.');

export const AddReactionSchema = {
  space_id: SpaceIdSchema,
  message_id: z
    .string()
    .min(1)
    .describe("Message id (e.g. 'AAAA...') or full resource name."),
  emoji: EmojiSchema,
  response_format: ResponseFormatSchema.optional(),
};
export type AddReactionInput = {
  space_id: string;
  message_id: string;
  emoji: string;
  response_format?: "markdown" | "json";
};

export const RemoveReactionSchema = {
  space_id: SpaceIdSchema,
  message_id: z
    .string()
    .min(1)
    .describe("Message id (e.g. 'AAAA...') or full resource name."),
  emoji: EmojiSchema,
  response_format: ResponseFormatSchema.optional(),
};
export type RemoveReactionInput = {
  space_id: string;
  message_id: string;
  emoji: string;
  response_format?: "markdown" | "json";
};

export const ListReactionsSchema = {
  space_id: SpaceIdSchema,
  message_id: z
    .string()
    .min(1)
    .describe("Message id (e.g. 'AAAA...') or full resource name."),
  page_size: z.number().int().min(1).max(1000).optional(),
  page_token: z.string().optional(),
  response_format: ResponseFormatSchema.optional(),
};
export type ListReactionsInput = {
  space_id: string;
  message_id: string;
  page_size?: number;
  page_token?: string;
  response_format?: "markdown" | "json";
};
