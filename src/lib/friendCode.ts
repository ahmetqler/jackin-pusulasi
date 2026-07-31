import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { FRIEND_CODE_LENGTH } from "@/lib/friendCodeFormat";

// 0/O ve 1/I/L karışmasın diye kısaltılmış alfabe — kod telefonda okunup
// elle yazılacak.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateFriendCode(): string {
  let code = "";
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export async function generateUniqueFriendCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateFriendCode();
    const taken = await prisma.user.findUnique({
      where: { friendCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new Error("Arkadaş kodu üretilemedi");
}
