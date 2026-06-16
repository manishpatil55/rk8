import "server-only";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Mailer — same posture as StorageAdapter/ratelimit: a clean interface with a
 * zero-ops dev implementation and a documented swap point for production.
 *
 * v1 ships ConsoleFileMailer: it logs the message and drops a copy in
 * `data/outbox/` so flows that depend on email (DMCA notice verification) are
 * fully testable with no SMTP. At scale, implement this interface over
 * Resend/SES/Postmark and the call sites don't change.
 *
 * IMPORTANT: in production the DMCA email-verification round-trip is what keeps
 * an anonymous, unauthenticated takedown notice from arming the 72h auto-
 * unpublish clock. Wire a real transport before going live.
 */
export interface Mailer {
  send(msg: { to: string; subject: string; text: string }): Promise<void>;
}

const DATA_DIR = process.env.RK8_DATA_DIR ?? path.join(process.cwd(), "data");
const OUTBOX = path.join(DATA_DIR, "outbox");

class ConsoleFileMailer implements Mailer {
  async send(msg: { to: string; subject: string; text: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `\n[mailer] → ${msg.to}\n[mailer] subject: ${msg.subject}\n${msg.text}\n`,
    );
    try {
      mkdirSync(OUTBOX, { recursive: true });
      // filename is sortable + collision-resistant without a clock dependency
      const safe = msg.to.replace(/[^a-z0-9._@-]/gi, "_");
      const file = path.join(
        OUTBOX,
        `${safe}-${Math.random().toString(36).slice(2, 10)}.txt`,
      );
      await writeFile(
        file,
        `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`,
      );
    } catch {
      /* best-effort dev convenience; never block the request on the outbox */
    }
  }
}

export const mailer: Mailer = new ConsoleFileMailer();

/** base URL for links in emails — set APP_URL in prod */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
