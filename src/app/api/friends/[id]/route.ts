import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

/** Arkadaşlıktan çıkar. [id] = arkadaşın kullanıcı id'si. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const { id: friendId } = await params;

  const { count } = await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
  });

  if (count === 0) {
    return NextResponse.json({ error: "Arkadaş bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
