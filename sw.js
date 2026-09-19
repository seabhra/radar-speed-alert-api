const CACHE_NAME = 'radar-cache-v11'; // <-- ALTERADO: v11 força a atualização no celular

// Lista de URLs para cache (Mantida exatamente como você enviou)
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/site.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  
  '/imagens_app/ic_compass.png', 
  '/imagens_app/ic_area_escape.png', 
  '/imagens_app/ic_cam_video.png',  
  '/imagens_app/ic_icon_chegada.png', 
  '/imagens_app/ic_girar_map.png',
  '/imagens_app/ic_local_traffic.png',
  '/imagens_app/ic_olho.png',
  '/imagens_app/ic_radar_cinto_v2.png',
  '/imagens_app/ic_radar_acidente.png',
  '/imagens_app/ic_radar_cev_30_v2.png',
  '/imagens_app/ic_radar_cev_40_v2.png',
  '/imagens_app/ic_radar_cev_50_v2.png',
  '/imagens_app/ic_radar_cev_60_v2.png',
  '/imagens_app/ic_radar_cev_70_v2.png',
  '/imagens_app/ic_radar_cev_80_v2.png',
  '/imagens_app/ic_radar_cev_100_v2.png',
  '/imagens_app/ic_radar_cev_110_v2.png',
  '/imagens_app/ic_compass_active.png',
  '/imagens_app/ic_gps_busca.png', 
  '/imagens_app/ic_gps_marker.png',
  '/imagens_app/ic_icon_app.png',
  '/imagens_app/ic_location_button.png',
  '/imagens_app/ic_location_button_active.png',
  '/imagens_app/ic_navigator_map.png',
  '/imagens_app/ic_radar_busca.png',
  '/imagens_app/ic_radar_cem_v2.png',
  '/imagens_app/ic_radar_cev_v2.png',
  '/imagens_app/ic_radar_das_v2.png',
  '/imagens_app/ic_radar_dife_v2.png',
  '/imagens_app/ic_radar_dfpr_v2.png',
  '/imagens_app/ic_radar_dtlp_v2.png',
  '/imagens_app/ic_radar_duc_v2.png',
  '/imagens_app/ic_radar_ocr_v2.png',
  '/imagens_app/ic_radar_facial_v2.png',
  '/imagens_app/ic_radar_nuclear_v2.png',
  '/imagens_app/ic_radar_truck_v2.png',
  '/imagens_app/ic_tunel_v2.png',
  '/imagens_app/ic_zona_inunda_v2.png',
  '/imagens_app/ic_radar_rcp_v2.png',
  '/imagens_app/ic_radar_rev_v2.png',
  '/imagens_app/ic_recentralizar.png',
  '/imagens_app/ic_refresh_button.png',
  '/imagens_app/ic_speed_limit.png',
  '/imagens_app/ic_zoom_in.png',
  '/imagens_app/ic_zoom_out.png',
  '/imagens_app/ic_semaforo_inteligente.png',
  '/imagens_app/ic_radar_poluido_v2.png',
  '/imagens_app/ic_mercado_central.png',
  '/imagens_app/ic_mirante_mangabeiras.png',
  '/imagens_app/ic_parque_mangabeiras.png',
  '/imagens_app/ic_mercado_novo.png',
  '/imagens_app/ic_santa_tereza.png',
  '/imagens_app/ic_rua_sapucai.png',
  '/imagens_app/ic_praca_liberdade.png',
  '/imagens_app/ic_edificio_maletta.png',
  '/imagens_app/ic_praca_papa.png',
  '/imagens_app/ic_museu_futebol.png',
  '/imagens_app/ic_igreja_pampulha.png',
  '/imagens_app/ic_parque_ecologico_pampulha.png',
  '/imagens_app/ic_parque_guanabara.png',
  '/imagens_app/ic_parque_serra_curral.png',
  '/imagens_app/ic_feira_afonso_pena.png',
  '/imagens_app/ic_palacio_artes.png',
  '/imagens_app/ic_parque_municipal.png',
  '/imagens_app/ic_praca_savassi.png',
  '/imagens_app/ic_museu_artes_oficios.png',
  '/imagens_app/ic_museu_abilio_barreto.png',
  '/imagens_app/ic_polo_artesanato.png',
  '/imagens_app/zap.png'
];

// Instalação
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Falha ao cachear. Verifique se TODOS os arquivos existem:', error);
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

// Interceptação de requisições (CORRIGIDO PARA NÃO CACHAR APIS)
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  // 🚨 REGRA DE OURO: Ignorar cache para APIs externas e recursos de terceiros
  // Isso garante que o clima (openweathermap), mapas e APIs sempre busquem dados frescos
  if (
    requestUrl.includes('openweathermap.org') ||
    requestUrl.includes('/api/') ||
    !requestUrl.startsWith(self.location.origin) // Se não for do seu domínio (radarx9.vercel.app)
  ) {
    return fetch(event.request); // Vai direto para a internet, sem tocar no cache
  }

  // Estratégia Cache-First para os arquivos do seu próprio app (imagens, HTML, JS)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Retorna do cache se existir (super rápido)
        }
        
        // Se não estiver no cache, busca na rede
        return fetch(event.request)
          .then((networkResponse) => {
            // Se for uma requisição GET válida, salva no cache para o futuro
            if (event.request.method === 'GET' && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback offline para a página principal
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            return new Response('Offline: Recurso não disponível', { status: 404 });
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