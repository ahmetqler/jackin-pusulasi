import { prisma } from "@/lib/prisma";

const personSelect = { id: true, displayName: true, username: true } as const;

export type RequestRow = {
  id: string;
  createdAt: string;
  person: { id: string; displayName: string; username: string };
};

export type FriendRequests = {
  incoming: RequestRow[];
  outgoing: RequestRow[];
};

export async function getFriendRequests(userId: string): Promise<FriendRequests> {
  const [incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      select: { id: true, createdAt: true, requester: { select: personSelect } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendship.findMany({
      where: { requesterId: userId, status: "PENDING" },
      select: { id: true, createdAt: true, addressee: { select: personSelect } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    incoming: incoming.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      person: row.requester,
    })),
    outgoing: outgoing.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      person: row.addressee,
    })),
  };
}
