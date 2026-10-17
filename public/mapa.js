// ==================
// ARQUIVO JS MAPA.JS
// ==================
'use strict';

// ==========================================
// 1. VARIÁVEIS GLOBAIS
// ==========================================
let map;
let tileLayer;
let radarMarkers = [];
let alertTimeout;
let mapaJaFoiCentralizadoInicialmente = false; // ✅ NOVO: Controla a centralização inicial

// ✅ CORREÇÃO DE SEGURANÇA: Atualiza as variáveis globais do app.js sem causar erro de referência
if (typeof window.userLat === 'undefined' || window.userLat === null) window.userLat = -19.919055;
if (typeof window.userLng === 'undefined' || window.userLng === null) window.userLng = -43.938641;

// Alias locais para facilitar o uso neste arquivo
let userLat = window.userLat;
let userLng = window.userLng;

// CONTROLE DE BARRAS LATERAIS
let searchActive = false;
let routeActive = false;
let gpsActive = true;
let sidebarAberta = false;
let watchId = null;
let gpsInitialized = false;
let browserGpsTimeout = null;

let prevLat = null;
let prevLng = null;
let prevTime = null;
let isFollowing = true;
let gpsSource = 'none';
let posicaoCentralOriginal = { lat: -19.919055, lng: -43.938641, zoom: 15 };
let coordenadasRotaNavegacao = [];
let ultimoSegmentoRota = -1;
let distanciaDaRota = Infinity;
let estaEmNavegacao = false;
let startRouteMarker = null;
let endRouteMarker = null;
let routingControl = null;
let destinoAtual = null;
let destinoNavegacao = null;

let ultimaAtualizacaoCamera = 0;
const INTERVALO_CAMERA_MS = 100;
let zoomAlvo = 17;
let zoomAtualEfetivo = 17;
let centroAtualEfetivo = { lat: null, lng: null };

let bearingAlvo = 0;
let bearingAtual = 0;
const FATOR_SUAVIZACAO_BEARING = 0.15;
let bearingAlvoAnterior = null;
let headingIconeNavegacao = 0;
let headingIconeSuavizado = 0;

let velocidadeAtual = 0;
let estaEmMovimento = false;
let posicaoSuavizadaGPS = { lat: null, lng: null };

let alertaHabilitado = true;
let ultimoRadarAlertado = null;
let returnToGpsTimer = null;
const TEMPO_RETORNO_GPS = 8000;
let refreshDelayTimer = null;
const TEMPO_REFRESH_DELAY = 5000;

let gpsAccuracyAtual = 999;
let gpsLastUpdateTime = 0;
let iconeCentralizado = false;

if (typeof window.alertaNormalidadeMostrado === 'undefined') {
    window.alertaNormalidadeMostrado = false;
}

let userMarker = null;

// ==========================================
// 2. CONTROLE DE TEXTOS - SITE vs APP
// ==========================================
function ajustarTextosClima() {
    const isMobile = window.innerWidth <= 600;
    const cidadeLabel = document.getElementById('cidade-atual') || document.getElementById('nomeCidade');
    if (cidadeLabel) {
        cidadeLabel.classList.remove('modo-site', 'modo-app');
        if (isMobile) {
            cidadeLabel.classList.add('modo-app');
        } else {
            cidadeLabel.classList.add('modo-site');
        }
    }
}
document.addEventListener('DOMContentLoaded', ajustarTextosClima);
window.addEventListener('resize', ajustarTextosClima);

// ==========================================
// 3. CONFIGURAÇÃO DO GITHUB
// ==========================================
let GITHUB_CONFIG = {
    owner: 'seabhra',
    repo: 'radar-speed-alert-api',
    path: 'radares.json',
    token: '',
    proxyUrl: '',
    _branchCache: null,
    appPath: 'radares_app.json',
    get cdnUrl() { return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@main/${this.path}`; },
    get rawUrl() { return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/main/${this.path}`; },
    get cdnUrlApp() { return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@main/${this.appPath}`; },
    get rawUrlApp() { return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/main/${this.appPath}`; }
};

let RADAR_MODO_OFFLINE = false;
let RADAR_PENDENTES_SINCRONIZAR = [];
let radaresAdicionadosNestaSessao = [];

async function carregarConfigGitHub() {
    console.log('[Radar X9] 🔄 Carregando configuração...');
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            Object.assign(GITHUB_CONFIG, {
                owner: config.githubOwner || GITHUB_CONFIG.owner,
                repo: config.githubRepo || GITHUB_CONFIG.repo,
                path: config.githubPath || GITHUB_CONFIG.path,
                token: config.githubToken || '',
                proxyUrl: config.proxyUrl || '',
                appPath: config.githubAppPath || 'radares_app.json'
            });
            return true;
        }
    } catch (err) { console.warn('[Radar X9] Backend não disponível.'); }
    
    try {
        const savedConfig = localStorage.getItem('radarx9_github_config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            Object.assign(GITHUB_CONFIG, {
                owner: config.owner || GITHUB_CONFIG.owner,
                repo: config.repo || GITHUB_CONFIG.repo,
                path: config.path || GITHUB_CONFIG.path,
                token: config.token || '',
                proxyUrl: config.proxyUrl || '',
                appPath: config.appPath || 'radares_app.json'
            });
            return true;
        }
    } catch (err) { console.warn('[Radar X9] localStorage não disponível.'); }
    return false;
}

function salvarConfigGitHub(config) {
    try {
        localStorage.setItem('radarx9_github_config', JSON.stringify(config));
        GITHUB_CONFIG._branchCache = null;
        Object.assign(GITHUB_CONFIG, config);
        return true;
    } catch (err) {
        console.error('[Radar X9] Erro ao salvar config:', err);
        return false;
    }
}

async function obterBranchPadrao() {
    if (GITHUB_CONFIG._branchCache) return GITHUB_CONFIG._branchCache;
    if (!GITHUB_CONFIG.token) throw new Error('Token do GitHub não configurado.');
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`, {
        method: 'GET',
        headers: { 'Authorization': `token ${GITHUB_CONFIG.token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!resp.ok) throw new Error(`Não foi possível ler o repositório (${resp.status})`);
    const info = await resp.json();
    GITHUB_CONFIG._branchCache = info.default_branch || 'main';
    return GITHUB_CONFIG._branchCache;
}

// ==========================================
// 4. CONFIGURAÇÃO DE ALERTAS
// ==========================================
const ALERT_CONFIG = {
    DISTANCIA_MAXIMA: 180,
    DISTANCIA_CRITICA: 100,
    TEMPO_ALERTA: 15000,
    DISTANCIA_PASSAR_RADAR: 30,
    ANGULO_APROXIMACAO: 100,
    ANGULO_AFASTANDO: 140,
    HISTORICO_TAMANHO: 5,
    SUAVIZACAO_FATOR: 0.6,
    DISTANCIA_MINIMA_MOVIMENTO: 2,
    DISPAROS_SOM_ANTES_DE_SILENCIAR: 2
};

let currentHeading = 0;
let mapaRotacionado = false;
let bussolaHardwareDisponivel = false;
let posicaoSuavizada = { lat: null, lng: null };
let historicoPosicoes = [];
let historicoDistanciasRadar = {};
let ultimaPosicaoMarcador = { lat: null, lng: null };
let animacaoMarcadorAtiva = false;
let tipoAlertaAtivo = null;

// ==========================================
// 5. GPS STATUS INDICATOR
// ==========================================
function atualizarStatusGPS(position) {
    const dot = document.getElementById('gps-status-dot');
    const wrapper = document.getElementById('gps-status-wrapper');
    const label = document.getElementById('gps-status-label');
    if (!dot || !wrapper || !label) return;

    if (!position || !position.coords) {
        dot.className = 'gps-status-dot err';
        wrapper.className = 'gps-status-wrapper gps-err';
        label.textContent = 'SEM GPS';
        return;
    }

    const acc = position.coords.accuracy || 999;
    gpsAccuracyAtual = acc;
    gpsLastUpdateTime = Date.now();

    if (acc <= 150) {
        dot.className = 'gps-status-dot ok';
        wrapper.className = 'gps-status-wrapper gps-ok';
        label.textContent = 'GPS OK';
    } else if (acc <= 500) {
        dot.className = 'gps-status-dot warn';
        wrapper.className = 'gps-status-wrapper gps-warn';
        label.textContent = 'GPS IRREGULAR';
    } else {
        dot.className = 'gps-status-dot err';
        wrapper.className = 'gps-status-wrapper gps-err';
        label.textContent = 'GPS FRACO';
    }
}

setInterval(function() {
    if (gpsLastUpdateTime > 0 && (Date.now() - gpsLastUpdateTime) > 15000) {
        atualizarStatusGPS(null);
    }
}, 5000);

// ==========================================
// 6. MARCADORES E ÍCONES
// ==========================================
function criarIconeNavegador(pulsarIntenso) {
    var haloClass = 'nav-pulse-halo' + (pulsarIntenso ? ' intenso' : '');
    var htmlStr = '<div class="nav-pulse-wrap"><div class="' + haloClass + '"></div>' +
        '<img src="/imagens_app/ic_navigator_map.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'" style="width:70px;height:70px;"></div>';
    return L.divIcon({ html: htmlStr, className: 'user-gps-marker', iconSize: [50, 50], iconAnchor: [25, 50], popupAnchor: [0, -50] });
}

const iconMap = {
    'Controlador Eletrônico de Velocidade (CEV)': '/imagens_app/ic_radar_cev_v2.png',
    'Detector de Avanço de Semáforo (DAS)': '/imagens_app/ic_radar_das_v2.png',
    'Detector de Tráfego em Local Proibido (DTLP)': '/imagens_app/ic_radar_dtlp_v2.png',
    'Detector de Conversão em Local Proibido (DCP)': '/imagens_app/ic_radar_rcp_v2.png',
    'Detector de Invasão de Faixa Exclusiva (DIFEX)': '/imagens_app/ic_radar_difex_v2.png',
    'Detector de Parada sobre Faixa de Pedestres (DPFP)': '/imagens_app/ic_radar_dpfp_v2.png',
    'Detector de Faixa Preferencial de Ônibus (BUS)': '/imagens_app/ic_radar_fpref_v2.png',
    'Zona Verde de Trânsito (ZVT)': '/imagens_app/ic_zona_verde.png',
    'Zona de Risco de Inundações Recorrentes (ZIR)': '/imagens_app/ic_zona_inunda.png',
    'Detector de Uso de Celular (DUC)': '/imagens_app/ic_radar_duc_v2.png',
    'Controle de Redução de Velocidade (CRV)': '/imagens_app/ic_radar_rev_v2.png',
    'Verificador de Cinto de Segurança (VCS)': '/imagens_app/ic_radar_cinto_v2.png',
    'Leitor Inteligente de Placas (OCR-P)': '/imagens_app/ic_radar_ocr_v2.png',
    'Leitor de Reconhecimento Facial (OCR-F)': '/imagens_app/ic_radar_facial_v2.png',
    'Câmera Olho Vivo (COV)': '/imagens_app/ic_olho_v2.png',
    'Zona de Perigo e Violência (ZPV)': '/imagens_app/ic_radar_perigo_v2.png',
    'Alerta de Alto Índice de Acidente (AIA)': '/imagens_app/ic_radar_acidente_v2.png',
    'Alerta de Caminhão na Faixa Esquerda (CFE)': '/imagens_app/ic_radar_truck_v2.png',
    'Zona de Estudo Nuclear (ZEN)': '/imagens_app/ic_radar_nuclear_v2.png',
    'Área de Escape Caminhões (ARE)': '/imagens_app/ic_area_escape.png',
    'Apenas Trânsito Local (ATL)': '/imagens_app/ic_local_traffic_v2.png',
    'Radar Inteligente de Velocidade Média (RIV)': '/imagens_app/ic_cam_video_v2.png',
    'Passagem Sob Túnel Viário (TUV)': '/imagens_app/ic_tunel_v2.png',
    'default': '/imagens_app/ic_radar_cev_v2.png'
};

function getIconUrl(tipo, velocidade) {
    const tipoLimpo = tipo ? tipo.trim() : "";
    if (!tipoLimpo) return iconMap['default'];
    if (iconMap[tipoLimpo]) return iconMap[tipoLimpo];
    
    if (tipoLimpo.includes('Velocidade') || tipoLimpo.includes('CEV')) {
        const velNum = parseInt(String(velocidade || '').replace(/[^0-9]/g, ''), 10);
        if ([30, 40, 50, 60, 70, 80, 100, 110].includes(velNum)) {
            return `/imagens_app/ic_radar_cev_${velNum}_v2.png`;
        }
        return '/imagens_app/ic_radar_cev_v2.png';
    }
    return iconMap['default'];
}

function criarIconeRadar(iconUrl, tamanho, fallbackUrl) {
    return L.icon({
        iconUrl: iconUrl,
        iconSize: [tamanho, tamanho],
        iconAnchor: [tamanho / 2, tamanho / 2],
        popupAnchor: [0, -tamanho / 2],
        className: 'radar-marker-icon'
    });
}

// ==========================================
// 7. FUNÇÕES AUXILIARES
// ==========================================
function calcularDistancia(lat1, lon1, lat2, lon2) {
    var R = 6371e3;
    var p1 = lat1 * Math.PI / 180;
    var p2 = lat2 * Math.PI / 180;
    var dp = (lat2 - lat1) * Math.PI / 180;
    var dl = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function suavizarBearing(alvo, atual, fator) {
    var diff = alvo - atual;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return (atual + diff * fator + 360) % 360;
}

function calcularZoomPorVelocidade() {
    if (velocidadeAtual < 5) return 19;
    if (velocidadeAtual < 20) return 18;
    if (velocidadeAtual < 40) return 17;
    if (velocidadeAtual < 60) return 16;
    if (velocidadeAtual < 80) return 15;
    return 14;
}

function mostrarInfoNavegacao(distancia, tempo) {
    var painel = document.getElementById('nav-info');
    var distanciaEl = document.getElementById('nav-distance');
    var tempoEl = document.getElementById('nav-time');
    var chegadaEl = document.getElementById('nav-arrival');
    if (!painel || !distanciaEl || !tempoEl) return;
    
    distanciaEl.textContent = '🚗 ' + String(distancia).replace('.', ',') + ' km';
    tempoEl.textContent = tempo + ' min';
    if (chegadaEl && tempo > 0) {
        var chegada = new Date(Date.now() + (tempo * 60 * 1000));
        chegadaEl.textContent = '🏁 Chegada: ' + String(chegada.getHours()).padStart(2, '0') + ':' + String(chegada.getMinutes()).padStart(2, '0');
    }
    painel.classList.add('visible');
}

// ==========================================
// 8. NAVEGAÇÃO E ROTA
// ==========================================
function adicionarMarcadoresRota(originLat, originLng, destLat, destLng) {
    destinoNavegacao = {lat: destLat, lng: destLng};
    if (startRouteMarker) { map.removeLayer(startRouteMarker); startRouteMarker = null; }
    if (endRouteMarker) { map.removeLayer(endRouteMarker); endRouteMarker = null; }
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    
    estaEmNavegacao = true;
    ultimaPosicaoMarcador = { lat: null, lng: null };
    
    var startIcon = L.divIcon({
        html: '<img id="nav-icon-img" src="/imagens_app/ic_navigator_map.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'" style="width:70px;height:70px;">',
        className: 'route-start-marker user-navigator-marker',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });
    startRouteMarker = L.marker([originLat, originLng], { icon: startIcon, zIndexOffset: 2000 }).addTo(map);
    
    var endIcon = L.divIcon({
        html: '<img src="/imagens_app/ic_icon_chegada.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/684/684908.png\'" style="width:45px;height:45px;">',
        className: 'route-end-marker',
        iconSize: [50, 50],
        iconAnchor: [25, 50]
    });
    endRouteMarker = L.marker([destLat, destLng], { icon: endIcon, zIndexOffset: 900 }).addTo(map);
}

function criarRota(destLat, destLng) {
    if (!userLat || !userLng) { showNotification("Aguardando posição GPS..."); return; }
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    destinoAtual = { lat: destLat, lng: destLng };
    adicionarMarcadoresRota(userLat, userLng, destLat, destLng);
    
    routingControl = L.Routing.control({
        waypoints: [L.latLng(userLat, userLng), L.latLng(destLat, destLng)],
        routeWhileDragging: false, addWaypoints: false, draggableWaypoints: false,
        fitSelectedRoutes: false, show: false, autoRoute: true,
        lineOptions: { styles: [{ color: '#FF9800', weight: 6, opacity: 1.0 }] },
        createMarker: function() { return null; }
    }).addTo(map);
    
    routingControl.on('routesfound', function(e) {
        let route = e.routes[0];
        if (route.coordinates && route.coordinates.length >= 2) {
            coordenadasRotaNavegacao = route.coordinates;
        }
        mostrarInfoNavegacao((route.summary.totalDistance / 1000).toFixed(1), Math.round(route.summary.totalTime / 60));
        $("#loading").hide();
    });
}

function finalizarNavegacao() {
    if (!map) return;
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    destinoAtual = null; destinoNavegacao = null; estaEmNavegacao = false;
    if (startRouteMarker) { map.removeLayer(startRouteMarker); startRouteMarker = null; }
    if (endRouteMarker) { map.removeLayer(endRouteMarker); endRouteMarker = null; }
    
    if (userLat && userLng) {
        userMarker = L.marker([userLat, userLng], { icon: criarIconeNavegador(false), zIndexOffset: 1000 }).addTo(map);
    }
    map.flyTo([userLat, userLng], 17, { duration: 1 });
    showNotification("Navegação encerrada");
}

// ==========================================
// 9. GPS TRACKING
// ==========================================
function startGPSTracking() {
    if (typeof browserGpsTimeout !== 'undefined' && browserGpsTimeout) {
        clearTimeout(browserGpsTimeout);
        browserGpsTimeout = null;
    }
    if (!navigator.geolocation) {
        if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
        if (typeof showNotification === 'function') showNotification("GPS não suportado.");
        return;
    }
    if (typeof watchId !== 'undefined' && watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    watchId = navigator.geolocation.watchPosition(
        function(position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            var accuracy = position.coords.accuracy;
            var speedKmh = position.coords.speed !== null ? Math.round(position.coords.speed * 3.6) : 0;
            
            if (typeof window.setUserLocation === 'function') {
                window.setUserLocation(lat, lng);
            }
            
            const speedDisplay = document.getElementById('speed-display');
            if (speedDisplay) speedDisplay.textContent = speedKmh;
            
            if (typeof window.atualizarStatusGPS === 'function') window.atualizarStatusGPS(position);
            if (typeof window.processarNovaPosicao === 'function') {
                window.processarNovaPosicao(lat, lng, speedKmh, position.coords.heading, accuracy);
            }
            
            if (!gpsInitialized) {
                gpsInitialized = true;
                if (typeof window.hideFullscreenLoading === 'function') window.hideFullscreenLoading();
            }
        },
        function(error) {
            console.error("❌ Erro GPS:", error.message);
            if (typeof window.atualizarStatusGPS === 'function') window.atualizarStatusGPS(null);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
    console.log("✅ GPS iniciado com watchId:", watchId);
}

// ==========================================
// 10. PROCESSAR NOVA POSIÇÃO (COM CENTRALIZAÇÃO AUTOMÁTICA)
// ==========================================
function processarNovaPosicao(newLat, newLng, speedKmh, hardwareHeading, accuracy) {
    if (!map) return;
    
    // Atualiza variáveis globais e locais
    window.userLat = newLat; window.userLng = newLng;
    userLat = newLat; userLng = newLng;

    var currentTime = Date.now();
    var dist = 0;
    adicionarAoHistorico(newLat, newLng, currentTime);
    var posSuave = suavizarPosicao(newLat, newLng);
    var smoothLat = posSuave.lat;
    var smoothLng = posSuave.lng;

    if (prevLat !== null) {
        dist = calcularDistancia(prevLat, prevLng, newLat, newLng);
        if (speedKmh === 0 && prevTime !== null) {
            var time = (currentTime - prevTime) / 1000;
            if (time > 0) speedKmh = Math.round((dist / time) * 3.6);
        }
    }
    if (speedKmh > 250) speedKmh = 0;
    velocidadeAtual = speedKmh;
    $('#speed-display').text(speedKmh);
    estaEmMovimento = speedKmh > 3 || dist > 2;

    var novoHeading = null;
    if (hardwareHeading !== null && !isNaN(hardwareHeading) && hardwareHeading >= 0) {
        if (!bussolaHardwareDisponivel) { currentHeading = hardwareHeading; bussolaHardwareDisponivel = true; }
        novoHeading = hardwareHeading;
    } else if (!bussolaHardwareDisponivel && dist > 3 && prevLat !== null) {
        var dy = newLat - prevLat;
        var dx = (newLng - prevLng) * Math.cos(newLat * Math.PI / 180);
        if (Math.abs(dx) > 0.0000001 || Math.abs(dy) > 0.0000001) {
            var calcHeading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            currentHeading = calcHeading;
            novoHeading = calcHeading;
        }
    }

    if (novoHeading !== null && estaEmMovimento) {
        bearingAlvo = novoHeading;
        headingIconeNavegacao = novoHeading;
    }
    if (currentHeading !== null) atualizarBussola(currentHeading);

    prevLat = newLat; prevLng = newLng; prevTime = currentTime;

    var accReal = (accuracy !== undefined && accuracy !== null && !isNaN(accuracy)) ? accuracy : 999;
    atualizarStatusGPS({ coords: { latitude: newLat, longitude: newLng, accuracy: accReal } });

    // ✅ CORREÇÃO PRINCIPAL: Centralizar o mapa na primeira posição GPS válida (precisão < 100m)
    if (!mapaJaFoiCentralizadoInicialmente && accReal < 100 && !estaEmNavegacao) {
        map.flyTo([newLat, newLng], 17, { duration: 1.2 });
        mapaJaFoiCentralizadoInicialmente = true;
        console.log("🗺️ [MAPA.JS] Mapa centralizado automaticamente no primeiro GPS válido.");
    }

    if (estaEmNavegacao) {
        if (!startRouteMarker) {
            console.warn("⚠️ startRouteMarker ausente durante navegação. Recriando...");
            adicionarMarcadoresRota(userLat, userLng, destinoAtual.lat, destinoAtual.lng);
        }
        if (startRouteMarker) {
            _iniciarAnimacaoNavegacao(smoothLat, smoothLng, novoHeading);
        }
        if (!gpsInitialized) {
            gpsInitialized = true;
            hideFullscreenLoading();
        }
    } else {
        if (!userMarker) {
            var defaultIcon = criarIconeNavegador(true);
            userMarker = L.marker([smoothLat, smoothLng], { icon: defaultIcon, zIndexOffset: 1000 }).addTo(map);
            userMarker.bindTooltip('Você está aqui', { permanent: false, direction: 'top', offset: [0, -25] });
            ultimaPosicaoMarcador = { lat: smoothLat, lng: smoothLng };
            iconeCentralizado = false;
            if (!gpsInitialized) {
                gpsInitialized = true;
                hideFullscreenLoading();
            }
        } else {
            if (iconeCentralizado && speedKmh > 3) {
                var pos = userMarker.getLatLng();
                map.removeLayer(userMarker);
                var navIcon = L.divIcon({
                    html: '<img src="/imagens_app/ic_navigator_map.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'" style="width:50px;height:50px;">',
                    className: 'user-gps-marker',
                    iconSize: [50, 50],
                    iconAnchor: [25, 50],
                    popupAnchor: [0, -50]
                });
                userMarker = L.marker([pos.lat, pos.lng], { icon: navIcon, zIndexOffset: 1000 }).addTo(map);
                userMarker.bindTooltip('Você está aqui', { permanent: false, direction: 'top', offset: [0, -25] });
                iconeCentralizado = false;
                showNotification("🧭 Modo navegação ativado");
            }
            moverMarcadorSuavemente(smoothLat, smoothLng);
        }
    }

    if (destinoAtual && routingControl && estaEmNavegacao) {
        if (!window.ultimaAtualizacaoRota || (currentTime - window.ultimaAtualizacaoRota > 5000)) {
            atualizarRota();
            window.ultimaAtualizacaoRota = currentTime;
        }
    }
    if (estaEmNavegacao && isFollowing) {
        atualizarCameraNavegacaoSuave();
    } else if (isFollowing && !estaEmNavegacao) {
        map.setView([smoothLat, smoothLng], map.getZoom(), { animate: true, duration: 0.5 });
    }
    
    verificarProximidadeRadares();
    if (destinoAtual) verificarChegadaDestino();
}

// ==========================================
// 11. INICIALIZAÇÃO DO MAPA E CONTROLES
// ==========================================
async function initMap() {
    console.log('[Radar X9] 🚀 Inicializando aplicação...');
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('[Radar X9] ❌ ERRO: Elemento #map NÃO EXISTE no HTML!');
        return;
    }
    
    await carregarConfigGitHub();
    carregarRadaresPendentes();
    
    if (typeof L === 'undefined') {
        hideFullscreenLoading();
        showNotification("Erro de conexão. Os mapas não puderam carregar.");
        return;
    }
    
    console.log('[Radar X9] 🗺️ Criando mapa Leaflet...');
    map = L.map('map', {
        center: [userLat, userLng],
        zoom: 15,
        zoomControl: false,
        rotate: true,
        bearing: 0
    });
    
    // ✅ CRUCIAL: Expõe o mapa globalmente para o app.js
    window.map = map;
    console.log('[Radar X9] ✅ Mapa criado e exportado como window.map');
    
    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);
    
    // ✅ GARANTIR QUE A BARRA LATERAL DE CONTROLES ESTEJA VISÍVEL
    const sidebarControls = document.getElementById('sidebar-controls');
    if (sidebarControls) {
        sidebarControls.classList.remove('retracted');
    }
    
    aplicarTemaMapa();
    setInterval(aplicarTemaMapa, 300000);
    inicializarBussolaHardware();
    
    // ==========================================
    // RECENTRALIZAR MAPA (BOTÃO DO SPEED WIDGET)
    // ==========================================
    let mapaCentralizado = true;
    let recentragemTimeout = null;
    const speedWidget = document.getElementById("speedWidget");
    const speedIcon = document.getElementById("speedIcon");

    function desativarCentralizacao(){
        if (mapaCentralizado) {
            console.log("ARRASTOU O MAPA - Desativando centralização");
            mapaCentralizado = false;
            if (speedIcon) speedIcon.src = "/imagens_app/ic_recentralizar.png";
            if (speedWidget) speedWidget.classList.add("recentralizar");
        }
        agendarRecentragemAutomatica();
    }

    function agendarRecentragemAutomatica(){
        if (recentragemTimeout) clearTimeout(recentragemTimeout);
        recentragemTimeout = setTimeout(function () {
            recentralizarMapa();
        }, 8000); // 8 segundos sem arrastar para recentralizar
    }

    function recentralizarMapa(){
        if (mapaCentralizado) return;
        if (recentragemTimeout) {
            clearTimeout(recentragemTimeout);
            recentragemTimeout = null;
        }
        console.log("RECENTRALIZANDO MAPA");
        mapaCentralizado = true;
        if (userLat && userLng && map) {
            map.flyTo([userLat, userLng], map.getZoom(), { animate: true, duration: 0.6 });
        }
        if (speedIcon) speedIcon.src = "/imagens_app/ic_speed_limit.png";
        if (speedWidget) speedWidget.classList.remove("recentralizar");
    }

    map.on("dragstart", desativarCentralizacao);

    if (speedWidget) {
        speedWidget.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!mapaCentralizado) {
                recentralizarMapa();
            } else {
                if (map) map.zoomIn(); // Se já estiver centralizado, dá zoom
            }
        });
    }
    
    // Ocultar bússola nativa do Leaflet
    function ocultarBussolaLeaflet() {
        $(".leaflet-control-compass").css("display", "none");
    }
    setTimeout(ocultarBussolaLeaflet, 100);
    setTimeout(ocultarBussolaLeaflet, 500);
    setTimeout(ocultarBussolaLeaflet, 1000);
    ocultarBussolaLeaflet();

    // Inicia o rastreamento GPS e carrega os radares
    startGPSTracking();
    carregarRadares();
    
    console.log('[Radar X9] ✅ Aplicação inicializada com sucesso!');
}

// ==========================================
// 12. CARREGAMENTO DE RADARES
// ==========================================
async function carregarRadares() {
    if (!map) return;
    $("#loading").show().html("<div class='loading-spinner'></div><div>Carregando alertas...</div>");
    
    try {
        const [responseCurados, responseApp] = await Promise.all([
            fetch(GITHUB_CONFIG.cdnUrl + '?v=' + Date.now()),
            fetch(GITHUB_CONFIG.cdnUrlApp + '?v=' + Date.now())
        ]);
        
        let todosOsRadares = [];
        if (responseCurados.ok) {
            const data = await responseCurados.json();
            todosOsRadares = todosOsRadares.concat((data.records || []).map(r => ({ ...r, _isUsuario: false })));
        }
        if (responseApp.ok) {
            const data = await responseApp.json();
            todosOsRadares = todosOsRadares.concat((data.records || []).map(r => ({ ...r, _isUsuario: true })));
        }
        
        if (todosOsRadares.length > 0) {
            renderizarRadaresNoMapa(todosOsRadares);
        } else {
            showNotification('⚠️ Nenhum radar encontrado');
        }
    } catch (err) {
        console.error('[Radar X9] ❌ Erro ao carregar radares:', err);
        showNotification('⚠️ Erro de conexão');
    } finally {
        $("#loading").hide();
    }
}

function renderizarRadaresNoMapa(records) {
    if (!map || !records || records.length === 0) return;
    
    records.forEach(function(record) {
        let lat = null, lng = null;
        const campos = [record[8], record[9], record.lat, record.latitude];
        for (let campo of campos) {
            if (!campo) continue;
            const match = String(campo).match(/(-?\s*\d+\.\d+)\s*,\s*(-?\s*\d+\.\d+)/);
            if (match) {
                lat = parseFloat(match[1].replace(/\s+/g, '').replace(/--/g, '-'));
                lng = parseFloat(match[2].replace(/\s+/g, '').replace(/--/g, '-'));
                if (!isNaN(lat) && !isNaN(lng)) break;
            }
        }
        
        if (!lat || !lng || lat < -34.5 || lat > 6 || lng < -74.5 || lng > -34) return;
        
        const tipo = (record[3] || record.tipo || "Não Identificado").trim();
        const velocidade = record[4] || record.velocidade || "0";
        const endereco = record[2] || record.endereco || "Endereço não informado";
        
        const iconeRadar = criarIconeRadar(getIconUrl(tipo, velocidade), 40, '/imagens_app/ic_radar_cev_v2.png');
        const radarMarker = L.marker([lat, lng], { icon: iconeRadar, zIndexOffset: 1000 }).addTo(map);
        
        radarMarker.bindPopup(
            '<div style="color:#222; font-family:\'Inter\'; text-align:center; min-width:200px;">' +
            '<b>' + tipo + '</b><br><hr style="border:0; border-top:1px solid #ddd; margin:5px 0;">' +
            '<div style="font-size:0.9rem;">' + endereco + '</div>' +
            '<div style="color:#d00; font-weight:bold; margin-top:5px;">Máx: ' + velocidade + ' km/h</div>' +
            (record._isUsuario ? '<div style="color:#00cc66;font-size:0.75rem;margin-top:4px;">🧩 Compartilhado por usuários</div>' : '') +
            '</div>'
        );
        
        radarMarker.radarData = {
            id: record[0] || record.id || Math.random(),
            latitude: lat,
            longitude: lng,
            endereco: endereco,
            velocidade_maxima: velocidade,
            tipoOriginal: tipo,
            isUsuario: !!record._isUsuario
        };
        radarMarkers.push(radarMarker);
    });
    
    showNotification(`✅ Mapa atualizado: ${radarMarkers.length} radares`);
}

// ==========================================
// 13. FUNÇÕES AUXILIARES DE SUPORTE
// ==========================================
function showNotification(msg) {
    if (typeof window.showToast === 'function') {
        window.showToast(msg);
    } else {
        console.log("NOTIFICAÇÃO:", msg);
    }
}

function hideFullscreenLoading() {
    const el = document.getElementById('loading-fullscreen');
    if (el) { el.classList.add('fade-out'); setTimeout(() => el.style.display = 'none', 600); }
}

function carregarRadaresPendentes() {
    try {
        const pendentes = localStorage.getItem('radarx9_pendentes');
        if (pendentes) RADAR_PENDENTES_SINCRONIZAR = JSON.parse(pendentes);
    } catch (e) {}
}

function suavizarPosicao(novaLat, novaLng) {
    if (posicaoSuavizada.lat === null) {
        posicaoSuavizada.lat = novaLat;
        posicaoSuavizada.lng = novaLng;
        return { lat: novaLat, lng: novaLng };
    }
    var fator = ALERT_CONFIG.SUAVIZACAO_FATOR;
    posicaoSuavizada.lat += (novaLat - posicaoSuavizada.lat) * fator;
    posicaoSuavizada.lng += (novaLng - posicaoSuavizada.lng) * fator;
    return { lat: posicaoSuavizada.lat, lng: posicaoSuavizada.lng };
}

function adicionarAoHistorico(lat, lng, timestamp) {
    historicoPosicoes.push({ lat: lat, lng: lng, time: timestamp });
    if (historicoPosicoes.length > ALERT_CONFIG.HISTORICO_TAMANHO) historicoPosicoes.shift();
}

function moverMarcadorSuavemente(targetLat, targetLng) {
    var marcadorParaMover = estaEmNavegacao ? startRouteMarker : userMarker;
    if (!marcadorParaMover) return;
    if (ultimaPosicaoMarcador.lat === null) {
        ultimaPosicaoMarcador = { lat: targetLat, lng: targetLng };
        marcadorParaMover.setLatLng([targetLat, targetLng]);
        return;
    }
    var distancia = calcularDistancia(ultimaPosicaoMarcador.lat, ultimaPosicaoMarcador.lng, targetLat, targetLng);
    if (distancia < ALERT_CONFIG.DISTANCIA_MINIMA_MOVIMENTO) return;
    
    var inicioLat = ultimaPosicaoMarcador.lat;
    var inicioLng = ultimaPosicaoMarcador.lng;
    var duracao = 300;
    var inicioTempo = performance.now();
    if (animacaoMarcadorAtiva) return;
    animacaoMarcadorAtiva = true;
    
    function animarFrame(tempoAtual) {
        var progresso = Math.min((tempoAtual - inicioTempo) / duracao, 1);
        var easing = 1 - Math.pow(1 - progresso, 3);
        var latAtual = inicioLat + (targetLat - inicioLat) * easing;
        var lngAtual = inicioLng + (targetLng - inicioLng) * easing;
        marcadorParaMover.setLatLng([latAtual, lngAtual]);
        if (progresso < 1) {
            requestAnimationFrame(animarFrame);
        } else {
            ultimaPosicaoMarcador = { lat: targetLat, lng: targetLng };
            animacaoMarcadorAtiva = false;
        }
    }
    requestAnimationFrame(animarFrame);
}

function verificarProximidadeRadares() {
    // Lógica simplificada para evitar erros se as funções de alerta não estiverem prontas
    if (typeof window.verificarProximidadeRadares === 'function') {
        window.verificarProximidadeRadares();
    }
}

function verificarChegadaDestino() {
    if (typeof window.verificarChegadaDestino === 'function') {
        window.verificarChegadaDestino();
    }
}

function atualizarRota() {
    if (typeof window.atualizarRota === 'function') {
        window.atualizarRota();
    }
}

function _iniciarAnimacaoNavegacao(toLat, toLng, novoHeading) {
    // Placeholder para animação fluida
}

function atualizarBussola(headingDegrees) {
    var needle = document.getElementById('compass-needle-img');
    if (needle && headingDegrees != null && !isNaN(headingDegrees)) {
        needle.style.transform = 'rotate(' + headingDegrees + 'deg)';
    }
}

function aplicarTemaMapa() {
    if (typeof map === 'undefined' || !map) return;
    var mapContainer = map.getContainer();
    var hora = new Date().getHours();
    var isNight = (hora >= 18 || hora < 6);
    mapContainer.classList.toggle('matrix-night', isNight);
    mapContainer.classList.toggle('matrix-day', !isNight);
}

function inicializarBussolaHardware() {
    if (typeof DeviceOrientationEvent !== 'undefined') {
        window.addEventListener('deviceorientation', function(event) {
            if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) { 
                currentHeading = event.webkitCompassHeading; 
                bussolaHardwareDisponivel = true; 
            }
        }, true);
    }
}

// ==========================================
// 14. INICIALIZAÇÃO GERAL
// ==========================================
document.addEventListener('DOMContentLoaded', async function() {
    ajustarTextosClima();
    aplicarTemaMapa();
    carregarRadaresPendentes();
    initMap();
    
    setTimeout(() => { 
        const l = document.getElementById('loading-fullscreen'); 
        if (l) {
            l.classList.add('fade-out');
            setTimeout(() => { if (l) l.style.display = 'none'; }, 600);
        } 
    }, 1500);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registrado:', reg.scope))
            .catch(err => console.error('Falha no SW:', err));
    });
}
