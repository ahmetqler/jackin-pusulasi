import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const action = (body as Record<string, unknown> | null)?.action;

  const friendship = await prisma.friendship.findUnique({
    where: { id },
    select: { id: true, status: true, requesterId: true, addresseeId: true },
  });

  if (!friendship || friendship.status !== "PENDING") {
    return NextResponse.json({ error: "İstek bulunamadı" }, { status: 404 });
  }

  if (action === "accept") {
    // Kabul etmek sadece isteği ALANIN hakkı.
    if (friendship.addresseeId !== userId) {
      return NextResponse.json({ error: "yetkisiz" }, { status: 403 });
    }
    await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "decline") {
    // Alan reddedebilir, gönderen de geri çekebilir.
    if (friendship.addresseeId !== userId && friendship.requesterId !== userId) {
      return NextResponse.json({ error: "yetkisiz" }, { status: 403 });
    }
    await prisma.friendship.delete({ where: { id: friendship.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
}
