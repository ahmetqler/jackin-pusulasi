// Sürüm numarası her yayında artırılır: activate sırasında eski önbellek
// silinsin, telefonda kurulu uygulama bayat paketle açılmasın.
const CACHE_NAME = "jack-shell-v4";
const APP_SHELL = [
  "/",
  "/friends",
  "/settings",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Tek tek ve hata yutarak: bir URL kaçarsa tüm kurulum düşmesin.
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API asla önbelleğe girmez. Bayat bir yön/mesafe, yokluğundan daha kötü.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/"))
      )
    );
    return;
  }

  // Stale-while-revalidate: önbellekten anında cevap ver (uygulama çevrimdışı
  // da açılsın), ama arkada yenile ki eski bir chunk takılıp kalmasın.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Dürtme bildirimi: "arkadaşın seni merak ediyor, uygulamayı aç".
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Jack'in Pusulası", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Aynı anda birden fazla dürtme birikmesin, sonuncusu yeterli.
      tag: "nudge",
      renotify: true,
    })
  );
});

// Bildirime dokununca uygulama açılır; açılır açılmaz konum güncellenir,
// yani bildirimin amacı tek dokunuşta gerçekleşmiş olur.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => "focus" in client);
      if (open) return open.focus();
      return self.clients.openWindow("/");
    })
  );
});
