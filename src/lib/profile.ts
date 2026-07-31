import { prisma } from "@/lib/prisma";

export const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  friendCode: true,
  sharing: true,
} as const;

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  friendCode: string;
  sharing: boolean;
};

export function getProfile(userId: string): Promise<Profile> {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: profileSelect });
}
