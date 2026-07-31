import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

// 0/O ve 1/I/L karışmasın diye kısaltılmış alfabe — kod telefonda okunup
// elle yazılacak.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateFriendCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Kullanıcının yazdığını karşılaştırılabilir hale getirir: "k3m-7qp " -> "K3M7QP" */
export function normalizeFriendCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Gösterim için gruplar: "K3M7QP" -> "K3M-7QP" */
export function formatFriendCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
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
