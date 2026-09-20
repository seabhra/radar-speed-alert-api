const CACHE_NAME = 'radar-cache-v13'; // Atualizado para forçar nova instalação

const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/site.webmanifest',
  '/style.css',
  '/mapa.js',
  '/app.js',
  '/imagens_app/ic_compass.png',
  '/imagens_app/ic_gps_marker.png',
  '/imagens_app/ic_icon_app.png'
  // Adicione apenas os arquivos que você TEM CERTEZA que existem
];

// Instalação TOLERANTE A FALHAS
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto');
        return Promise.all(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`⚠️ Falha ao cachear ${url}:`, err.message);
              return null;
            })
          )
        );
      })
  );
  self.skipWaiting();
});

// Ativação
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Ativando...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('Service Worker: Removendo cache antigo:', key);
            return caches.delete(key);
          })
      );
    })
  );
  clients.claim();
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  // Ignore requisições de extensões e esquemas não-http
  if (requestUrl.startsWith('chrome-extension://') || 
      requestUrl.startsWith('moz-extension://') ||
      !requestUrl.startsWith('http')) {
    return;
  }

  // Ignore APIs externas (clima, mapas, etc.)
  if (requestUrl.includes('openweathermap.org') || 
      requestUrl.includes('nominatim.openstreetmap.org') ||
      requestUrl.includes('cdn.jsdelivr.net') ||
      !requestUrl.startsWith(self.location.origin)) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then((networkResponse) => {
            // NÃO cachear respostas parciais (206) ou com erro
            if (networkResponse.status === 206 || !networkResponse.ok) {
              return networkResponse;
            }
            
            if (event.request.method === 'GET') {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone).catch(err => {
                  console.warn('Falha ao salvar no cache:', err);
                });
              });
            }
            return networkResponse;
          })
          .catch(() => {
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            return new Response('Offline', { status: 404 });
          });
      })
  );
});

// Notificações
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
