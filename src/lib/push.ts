import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * Bildirim özelliği anahtarlar tanımlıysa açık.
 *
 * Tanımlı değilse sessizce kapalı kalıyor ve uygulama çalışmaya devam ediyor —
 * modül yüklenirken patlarsa build de düşerdi. Böylece anahtarlar Vercel'e
 * eklenmeden önce yapılan bir deploy da sorunsuz geçiyor.
 */
export const PUSH_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
);

if (PUSH_ENABLED) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export type PushPayload = {
  title: string;
  body: string;
};

/**
 * Kullanıcının tüm cihazlarına bildirim gönderir, ulaşan cihaz sayısını döner.
 * Ölü abonelikler (404/410) yolda temizlenir.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!PUSH_ENABLED) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Abonelik iptal edilmiş veya süresi dolmuş — bir daha denemeye değmez.
          await prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => {});
        }
      }
    }),
  );

  return delivered;
}
