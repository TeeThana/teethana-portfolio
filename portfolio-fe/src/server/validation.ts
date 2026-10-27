import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const webUrl = z.union([
  z.literal(""),
  z
    .url()
    .max(2048)
    .refine(
      (value) => new URL(value).protocol === "https:",
      "Use an https URL",
    ),
]);
export const profileSchema = z
  .object({
    name: text(100).min(1),
    headline: text(160).min(1),
    bio: text(5000),
    location: text(120),
    avatarUrl: webUrl,
    email: z.union([z.literal(""), z.email().max(254)]),
    githubUrl: webUrl,
    linkedinUrl: webUrl,
    websiteUrl: webUrl,
    resumeUrl: webUrl,
    experience: z
      .array(
        z
          .object({
            period: text(80),
            role: text(120),
            organization: text(120),
            description: text(1000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export const projectPatchSchema = z
  .object({
    title: text(100).min(1).optional(),
    summary: text(500).optional(),
    content: text(15000).optional(),
    role: text(120).optional(),
    year: text(30).optional(),
    stack: z.array(text(40).min(1)).max(20).optional(),
    coverColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    liveUrl: webUrl.optional(),
    active: z.boolean().optional(),
    featured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one change",
  );
