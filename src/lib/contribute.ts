import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSystem } from "@/config/systems.config";
import { checkMagic } from "@/lib/detect";
import { storage } from "@/lib/storage";

/**
 * Community contribution pipeline (§4.4). Everything is validated BEFORE any
 * bytes are written, so a rejected upload never leaves orphan files. Submissions
 * land as `pending` and are invisible publicly until a moderator approves (3c).
 */

export const MAX_ROM_BYTES = 256 * 1024 * 1024; // §4.4 hard cap
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const PENDING_CAP = 3; // §4.4 rate cap: 3 pending submissions per user

export class ContributeError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const MetaSchema = z.object({
  title: z.string().trim().min(2).max(120),
  systemId: z.string().min(1),
  description: z.string().trim().max(2000).optional().default(""),
  year: z.coerce.number().int().min(1970).max(2100).optional(),
  players: z.coerce.number().int().min(1).max(8).optional(),
  licenseClass: z.enum(["homebrew", "public_domain", "open"]),
});

const COVER_EXT = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "game";
}

export async function countPending(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.submittedBy, userId),
        eq(schema.games.status, "pending"),
      ),
    );
  return r?.n ?? 0;
}

export interface SubmitResult {
  gameId: string;
  slug: string;
  systemId: string;
}

export async function submitGame(opts: {
  userId: string;
  rom: File;
  cover: File | null;
  fields: Record<string, FormDataEntryValue | null>;
  attested: boolean;
}): Promise<SubmitResult> {
  // 1. mandatory rights attestation (§4.4)
  if (!opts.attested) throw new ContributeError("attestation");

  // 2. metadata
  const parsed = MetaSchema.safeParse({
    title: opts.fields.title,
    systemId: opts.fields.systemId,
    description: opts.fields.description ?? "",
    year: opts.fields.year || undefined,
    players: opts.fields.players || undefined,
    licenseClass: opts.fields.licenseClass,
  });
  if (!parsed.success)
    throw new ContributeError("invalid", parsed.error.issues[0]?.message);
  const { title, systemId, description, year, players, licenseClass } =
    parsed.data;

  const system = getSystem(systemId);
  if (!system) throw new ContributeError("system");

  // 3. ROM: size → extension allowlist → magic-byte sanity (§7.3)
  if (!opts.rom || opts.rom.size === 0) throw new ContributeError("no_rom");
  if (opts.rom.size > MAX_ROM_BYTES) throw new ContributeError("too_large");
  const ext = opts.rom.name.slice(opts.rom.name.lastIndexOf(".")).toLowerCase();
  if (!system.extensions.includes(ext))
    throw new ContributeError("ext", `${ext} is not valid for ${system.shortName}`);
  const bytes = new Uint8Array(await opts.rom.arrayBuffer());
  const magic = checkMagic(systemId, ext, bytes);
  if (magic.known && !magic.ok)
    throw new ContributeError(
      "magic",
      `file contents don't look like a ${system.shortName} rom`,
    );

  // 4. cover validation (before any write)
  let coverExt: string | null = null;
  if (opts.cover && opts.cover.size > 0) {
    if (opts.cover.size > MAX_COVER_BYTES)
      throw new ContributeError("cover_large");
    coverExt = COVER_EXT.get(opts.cover.type) ?? null;
    if (!coverExt) throw new ContributeError("cover_type");
  }

  // 5. dedupe + per-user pending cap
  const sha = createHash("sha256").update(bytes).digest("hex");
  const [dupe] = await db
    .select({ id: schema.games.id })
    .from(schema.games)
    .where(eq(schema.games.romSha256, sha))
    .limit(1);
  if (dupe) throw new ContributeError("duplicate");
  if ((await countPending(opts.userId)) >= PENDING_CAP)
    throw new ContributeError("pending_cap");

  // 6. unique (system, slug)
  let slug = slugify(title);
  const [taken] = await db
    .select({ id: schema.games.id })
    .from(schema.games)
    .where(and(eq(schema.games.systemId, systemId), eq(schema.games.slug, slug)))
    .limit(1);
  if (taken) slug = `${slug}-${sha.slice(0, 6)}`;

  // 7. persist — bytes first (validated), then the row
  const romKey = `roms/${sha}${ext}`;
  await storage.put(romKey, Buffer.from(bytes));
  let coverKey: string | null = null;
  if (opts.cover && coverExt) {
    coverKey = `covers/${sha}${coverExt}`;
    await storage.put(coverKey, Buffer.from(await opts.cover.arrayBuffer()));
  }

  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.games).values({
    id,
    slug,
    title,
    systemId,
    engine: system.engine,
    year: year ?? null,
    players: players ?? null,
    description,
    coverPath: coverKey,
    romPath: romKey,
    romSha256: sha,
    sizeBytes: bytes.length,
    licenseClass,
    licenseNote: `community submission — uploader attested: ${licenseClass}`,
    status: "pending",
    submittedBy: opts.userId,
    playCount: 0,
    staffPick: false,
    createdAt: now,
  });

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId: opts.userId,
    action: "submit",
    target: `game:${id}`,
    metaJson: JSON.stringify({ slug, systemId, sha }),
    createdAt: now,
  });

  return { gameId: id, slug, systemId };
}
