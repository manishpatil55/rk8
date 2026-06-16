import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/me — lightweight auth state for client chrome (Header). */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(
    {
      user: user
        ? {
            id: user.id,
            name: user.name ?? user.email.split("@")[0],
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
          }
        : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
