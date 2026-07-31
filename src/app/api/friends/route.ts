import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/lib/session";
import { buildRadarPayload } from "@/lib/radar";

/**
 * Radar durumu. Kerteriz her zaman sunucuda KAYITLI konumdan hesaplanır —
 * koordinat hiçbir zaman URL'e girmez (Vercel URL'leri loglar, body'leri değil).
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const payload = await buildRadarPayload(userId);
  if (!payload) return unauthorized();

  return NextResponse.json(payload);
}
