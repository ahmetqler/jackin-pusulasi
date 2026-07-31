import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jack'in Pusulası",
    short_name: "Pusula",
    description:
      "Arkadaşlarının tam konumunu değil, sadece hangi yönde ve ne kadar uzakta olduklarını gösteren pusula.",
    start_url: "/",
    display: "standalone",
    // Portrait'e kilitliyoruz: ekran döndüğünde cihazın doğal üstü ile ekranın
    // üstü ayrışıyor ve pusula açısına platforma göre değişen bir düzeltme
    // terimi giriyor. Kurulu uygulamada bu sorunu hiç yaşamayalım.
    orientation: "portrait",
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
