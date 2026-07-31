// ============================================================================
//  KOORDİNAT ÇIKIŞ NOKTASI — buildRadarPayload() bu uygulamada lat/lng okuyup
//  dışarıya bir şey üreten TEK fonksiyondur.
//
//  Arkadaş verisi döndüren her route buradan geçer. Koordinatlar bu dosyanın
//  dışına çıkmaz: dışarıya sadece yön (derece) ve yuvarlanmış mesafe gider.
//  Yeni bir alan eklenecekse burada eklenir; başka bir yerde Location tablosu
//  sorgulanıp API yanıtına yazılmaz.
// ============================================================================
import { prisma } from "@/lib/prisma";
import {
  haversineMeters,
  initialBearingDeg,
  quantizeDistance,
  MIN_BEARING_DISTANCE_M,
} from "@/lib/geo";

export type FriendView = {
  id: string;
  name: string;
  /** Arkadaş paylaşımı açık mı — kapalıysa UI "Gizli" gösterir. */
  sharing: boolean;
  /** 0–359, saat yönünde, gerçek kuzeyden. Hesaplanamıyorsa null. */
  bearing: number | null;
  /** Yuvarlanmış metre. Hesaplanamıyorsa null. */
  distanceMeters: number | null;
  /** Arkadaşın konumunun tazeliği (ISO). Paylaşımı kapalıysa null. */
  updatedAt: string | null;
};

export type RadarPayload = {
  /** Tazelik hesabı sunucu saatine göre yapılır — telefon saati bozuk olabilir. */
  serverNow: string;
  me: {
    sharing: boolean;
    hasFix: boolean;
    updatedAt: string | null;
  };
  pendingRequests: number;
  friends: FriendView[];
};

const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;

const friendSelect = {
  id: true,
  displayName: true,
  sharing: true,
  location: { select: { lat: true, lng: true, updatedAt: true } },
} as const;

/** Kullanıcı artık yoksa null — çağıran taraf oturumu sonlandırır. */
export async function buildRadarPayload(userId: string): Promise<RadarPayload | null> {
  // Kendiliğinden temizlik: 24 saatten eski konumlar buharlaşır, cron gerekmez.
  void prisma.location
    .deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - LOCATION_TTL_MS) } } })
    .catch(() => {});

  const [me, friendships, pendingRequests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        sharing: true,
        location: { select: { lat: true, lng: true, updatedAt: true } },
      },
    }),
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requesterId: true,
        requester: { select: friendSelect },
        addressee: { select: friendSelect },
      },
    }),
    prisma.friendship.count({ where: { addresseeId: userId, status: "PENDING" } }),
  ]);

  if (!me) return null;

  // Görünmez moddayken konum satırı zaten silinmiş olur; o yüzden karşılıklı:
  // paylaşmıyorsan sen de kimsenin yönünü göremezsin.
  const myFix = me.sharing ? me.location : null;

  const friends: FriendView[] = friendships
    .map(({ requesterId, requester, addressee }) => {
      const other = requesterId === userId ? addressee : requester;
      const theirFix = other.sharing ? other.location : null;

      let bearing: number | null = null;
      let distanceMeters: number | null = null;

      if (myFix && theirFix) {
        const raw = haversineMeters(myFix.lat, myFix.lng, theirFix.lat, theirFix.lng);
        distanceMeters = quantizeDistance(raw);
        // 50 m altında GPS gürültüsü yönü anlamsızlaştırır -> ok gösterme.
        bearing =
          raw >= MIN_BEARING_DISTANCE_M
            ? Math.round(initialBearingDeg(myFix.lat, myFix.lng, theirFix.lat, theirFix.lng)) % 360
            : null;
      }

      return {
        id: other.id,
        name: other.displayName,
        sharing: other.sharing,
        bearing,
        distanceMeters,
        updatedAt: theirFix ? theirFix.updatedAt.toISOString() : null,
      };
    })
    // Yakın olan üstte; mesafesi bilinmeyenler sona.
    .sort((a, b) => {
      if (a.distanceMeters === null && b.distanceMeters === null) {
        return a.name.localeCompare(b.name, "tr");
      }
      if (a.distanceMeters === null) return 1;
      if (b.distanceMeters === null) return -1;
      return a.distanceMeters - b.distanceMeters;
    });

  return {
    serverNow: new Date().toISOString(),
    me: {
      sharing: me.sharing,
      hasFix: Boolean(me.location),
      updatedAt: me.location ? me.location.updatedAt.toISOString() : null,
    },
    pendingRequests,
    friends,
  };
}
