import { prisma } from "@/lib/prisma";

export const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  friendCode: true,
  color: true,
  sharing: true,
} as const;

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  friendCode: string;
  color: string;
  sharing: boolean;
};

/** Kullanıcı artık yoksa null — çağıran taraf oturumu sonlandırır. */
export function getProfile(userId: string): Promise<Profile | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
}
