// ==================
// ARQUIVO JS MAPA.JS (versão corrigida e harmonizada)
// ==================
(function () {
// Variáveis compartilhadas com o app.js
try { if (typeof userLat === 'undefined' || userLat === null) userLat = -19.919055; } catch (e) { window.userLat = -19.919055; }
try { if (typeof userLng === 'undefined' || userLng === null) userLng = -43.938641; } catch (e) { window.userLng = -43.938641; }
try { if (typeof alertaNormalidadeMostrado === 'undefined') alertaNormalidadeMostrado = false; } catch (e) { window.alertaNormalidadeMostrado = false; }

// VARIÁVEIS GLOBAIS
let map = null;
let tileLayer = null;
let radarMarkers = [];
let alertTimeout = null;

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
let userMarker = null;

// Recentralizar
let mapaCentralizado = true;
let recentragemTimeout = null;
let speedWidgetEl = null;
let speedIconEl = null;
const TEMPO_RECENTRALIZAR_MS = 10000;
const ICONE_RECENTRALIZAR = '/imagens_app/ic_recentralizar.png';
const ICONE_VELOCIDADE = '/imagens_app/ic_speed_limit.png';

// Modal de radar
let selectedSpeed = '';
let selectedType = '';
let radarLat = null;
let radarLng = null;

function executarSeguro(nome, fn) {
    try { return fn(); } 
    catch (err) { console.error('[Radar X9] ❌ Falha em "' + nome + '":', err); return undefined; }
}

function ajustarTextosClima() {
    const isMobile = window.innerWidth <= 600;
    const cidadeLabel = document.getElementById('cidade-atual');
    if (cidadeLabel) {
        cidadeLabel.classList.remove('modo-site', 'modo-app');
        cidadeLabel.classList.add(isMobile ? 'modo-app' : 'modo-site');
    }
}

let GITHUB_CONFIG = {
    owner: 'seabhra', repo: 'radar-speed-alert-api', path: 'radares.json', token: '', proxyUrl: '',
    _branchCache: null, appPath: 'radares_app.json',
    get cdnUrl() { return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@main/${this.path}`; },
    get rawUrl() { return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/main/${this.path}`; },
    get cdnUrlApp() { return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@main/${this.appPath}`; },
    get rawUrlApp() { return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/main/${this.appPath}`; }
};

let RADAR_MODO_OFFLINE = false;
let RADAR_PENDENTES_SINCRONIZAR = [];
let radaresAdicionadosNestaSessao = [];

function fetchComTimeout(url, opcoes, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return Promise.race([
        fetch(url, opcoes),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Timeout: ' + url)); }, timeoutMs); })
    ]);
}

async function carregarConfigGitHub() {
    try {
        const response = await fetchComTimeout('/api/config', undefined, 5000);
        if (response.ok) {
            const config = await response.json();
            Object.assign(GITHUB_CONFIG, {
                owner: config.githubOwner || GITHUB_CONFIG.owner, repo: config.githubRepo || GITHUB_CONFIG.repo,
                path: config.githubPath || GITHUB_CONFIG.path, token: config.githubToken || '',
                proxyUrl: config.proxyUrl || '', appPath: config.githubAppPath || 'radares_app.json'
            });
            return true;
        }
    } catch (err) { /* Backend não disponível, segue para localStorage */ }
    try {
        const savedConfig = localStorage.getItem('radarx9_github_config');
        if (savedConfig) {
            Object.assign(GITHUB_CONFIG, JSON.parse(savedConfig));
            return true;
        }
    } catch (err) { /* localStorage não disponível */ }
    return false;
}

function salvarConfigGitHub(config) {
    try {
        localStorage.setItem('radarx9_github_config', JSON.stringify(config));
        GITHUB_CONFIG._branchCache = null;
        Object.assign(GITHUB_CONFIG, config);
        return true;
    } catch (err) { return false; }
}

async function obterBranchPadrao() {
    if (GITHUB_CONFIG._branchCache) return GITHUB_CONFIG._branchCache;
    if (!GITHUB_CONFIG.token) throw new Error('Token do GitHub não configurado.');
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`, {
        method: 'GET', headers: { 'Authorization': `token ${GITHUB_CONFIG.token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!resp.ok) throw new Error(`Não foi possível ler o repositório (${resp.status})`);
    const info = await resp.json();
    GITHUB_CONFIG._branchCache = info.default_branch || 'main';
    return GITHUB_CONFIG._branchCache;
}

const ALERT_CONFIG = {
    DISTANCIA_MAXIMA: 180, DISTANCIA_CRITICA: 100, TEMPO_ALERTA: 15000, DISTANCIA_PASSAR_RADAR: 30,
    ANGULO_APROXIMACAO: 100, ANGULO_AFASTANDO: 140, HISTORICO_TAMANHO: 5, SUAVIZACAO_FATOR: 0.6,
    DISTANCIA_MINIMA_MOVIMENTO: 2, DISPAROS_SOM_ANTES_DE_SILENCIAR: 2
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
let somAlertaHabilitado = true;

function atualizarStatusGPS(position) {
    const dot = document.getElementById('gps-status-dot');
    const wrapper = document.getElementById('gps-status-wrapper');
    const label = document.getElementById('gps-status-label');
    if (!dot || !wrapper || !label) return;
    
    if (!position || !position.coords) {
        dot.className = 'gps-status-dot err'; wrapper.className = 'gps-status-wrapper gps-err'; label.textContent = 'SEM GPS';
        return;
    }
    const acc = position.coords.accuracy || 999;
    gpsAccuracyAtual = acc; gpsLastUpdateTime = Date.now();
    
    if (acc <= 150) {
        dot.className = 'gps-status-dot ok'; wrapper.className = 'gps-status-wrapper gps-ok'; label.textContent = 'GPS OK';
    } else if (acc <= 500) {
        dot.className = 'gps-status-dot warn'; wrapper.className = 'gps-status-wrapper gps-warn'; label.textContent = 'GPS IRREGULAR';
    } else {
        dot.className = 'gps-status-dot err'; wrapper.className = 'gps-status-wrapper gps-err'; label.textContent = 'GPS FRACO';
    }
}

setInterval(function () {
    if (gpsLastUpdateTime > 0 && (Date.now() - gpsLastUpdateTime) > 15000) atualizarStatusGPS(null);
}, 5000);

function criarIconeNavegador(pulsarIntenso) {
    var haloClass = 'nav-pulse-halo' + (pulsarIntenso ? ' intenso' : '');
    var htmlStr = '<div class="nav-pulse-wrap"><div class="' + haloClass + '"></div>' +
        '<img src="/imagens_app/ic_navigator_map.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'" style="width:70px;height:70px;"></div>';
    return L.divIcon({ html: htmlStr, className: 'user-gps-marker', iconSize: [50, 50], iconAnchor: [25, 50], popupAnchor: [0, -50] });
}

function ativarPulsoIntenso() { var halo = document.querySelector('.nav-pulse-halo'); if (halo) halo.classList.add('intenso'); }
function desativarPulsoIntenso() { var halo = document.querySelector('.nav-pulse-halo'); if (halo) halo.classList.remove('intenso'); }

const iconMap = {
    'Controlador Eletrônico de Velocidade':'/imagens_app/ic_radar_cev_v2.png', 'Controlador Eletrônico de Velocidade (CEV)':'/imagens_app/ic_radar_cev_v2.png',
    'Controlador Eletrônico Misto (DAS) + (CEV)':'/imagens_app/ic_radar_cem_cev.png', 'Controlador Eletrônico Misto (DAS) + (DCP)':'/imagens_app/ic_radar_cem_dcp.png',
    'Controlador Eletrônico Misto (DAS) + (DIF)':'/imagens_app/ic_radar_cem_move.png', 'Detector de Avanço de Semáforo (DAS)':'/imagens_app/ic_radar_das_v2.png',
    'Detector de Tráfego em Local Proibido (DTLP)':'/imagens_app/ic_radar_dtlp_v2.png', 'Detector de Conversão em Local Proibido (DCP)':'/imagens_app/ic_radar_rcp_v2.png',
    'Detector de Invasão de Faixa Exclusiva (DIFEX)':'/imagens_app/ic_radar_difex_v2.png', 'Detector de Parada sobre Faixa de Pedestres (DPFP)':'/imagens_app/ic_radar_dpfp_v2.png',
    'Detector de Faixa Preferencial de Ônibus (BUS)':'/imagens_app/ic_radar_fpref_v2.png', 'Zona Verde de Trânsito (ZVT)':'/imagens_app/ic_zona_verde.png',
    'Zona de Risco de Inundações Recorrentes (ZIR)':'/imagens_app/ic_zona_inunda.png', 'Detector de Uso de Celular (DUC)': '/imagens_app/ic_radar_duc_v2.png',
    'Controle de Redução de Velocidade (CRV)':'/imagens_app/ic_radar_rev_v2.png', 'Verificador de Cinto de Segurança (VCS)':'/imagens_app/ic_radar_cinto_v2.png',
    'Leitor Inteligente de Placas (OCR-P)':'/imagens_app/ic_radar_ocr_v2.png', 'Leitor de Reconhecimento Facial (OCR-F)':'/imagens_app/ic_radar_facial_v2.png',
    'Câmera Olho Vivo (COV)': '/imagens_app/ic_olho_v2.png', 'Zona de Perigo e Violência (ZPV)':'/imagens_app/ic_radar_perigo_v2.png',
    'Alerta de Alto Índice de Acidente (AIA)':'/imagens_app/ic_radar_acidente_v2.png', 'Alerta de Caminhão na Faixa Esquerda (CFE)':'/imagens_app/ic_radar_truck_v2.png',
    'Zona de Estudo Nuclear (ZEN)':'/imagens_app/ic_radar_nuclear_v2.png', 'Área de Escape Caminhões (ARE)':'/imagens_app/ic_area_escape.png',
    'Apenas Trânsito Local (ATL)':'/imagens_app/ic_local_traffic_v2.png', 'Radar Inteligente de Velocidade Média (RIV)':'/imagens_app/ic_cam_video_v2.png',
    'Passagem Sob Túnel Viário (TUV)':'/imagens_app/ic_tunel_v2.png', 'Alerta de Poluição Elevada (APE)':'/imagens_app/ic_radar_poluido_v2.png',
    'Semáforo Inteligente (SEI)': '/imagens_app/ic_semaforo_inteligente.png', 'default': '/imagens_app/ic_radar_cev_v2.png'
};

// (Mantidos os arrays de classificação TIPOS_ALERTA_RADAR, TIPOS_ALERTA_RISCO, etc. para brevidade, o código original já os tem corretos)
const TIPOS_ALERTA_RADAR = ['Detector de Parada sobre Faixa de Pedestres (DPFP)', 'Detector de Conversão em Local Proibido (DCP)', 'Controlador Eletrônico de Velocidade (CEV)', 'Detector de Avanço de Semáforo (DAS)'];
const TIPOS_ALERTA_RISCO = ['Zona de Perigo e Violência (ZPV)', 'Alerta de Alto Índice de Acidente (AIA)', 'Zona de Risco de Inundações Recorrentes (ZIR)'];
const TIPOS_ALERTA_MOBILIDADE = ['Detector de Faixa Preferencial de Ônibus (BUS)', 'Apenas Trânsito Local (ATL)', 'Leitor Inteligente de Placas (OCR-P)'];
const TIPOS_ALERTA_DESTAQUE = ['Mercado Central - Arte e Gastronomia', 'Praça da Liberdade - Arte e Cultura'];
const TIPOS_ALERTA_SERVICO = ['Ponto Abrigo Amigo', 'WC Público Comum', 'Recarga Carro Elétrico'];
const TIPOS_SEM_ALERTA = [];

const ajusteNomes = {
    'Controlador Eletrônico de Velocidade': 'Radar de Velocidade (CEV)', 'Controlador Eletrônico de Velocidade (CEV)': 'Radar de Velocidade (CEV)',
    'Detector de Parada sobre Faixa de Pedestres (DPFP)': 'Detector de Parada sobre Faixa de Pedestres (DPFP)',
    'Detector de Avanço de Semáforo (DAS)': 'Radar de Avanço de Semáforo (DAS)', 'Detector de Conversão em Local Proibido (DCP)': 'Detector de Conversão em Local Proibido (DCP)',
    'Detector de Tráfego em Local Proibido (DTLP)': 'Zona de Tráfego Proibido (ZTP)', 'Detector de Invasão de Faixa Exclusiva (DIFEX)': 'Faixa Exclusiva de Ônibus e Táxis (FOT)',
    'Detector de Faixa Preferencial de Ônibus (BUS)': 'Faixa Preferencial de Ônibus (BUS)', 'Zona Verde de Trânsito (ZVT)': 'Zona Verde de Trânsito (ZVT)',
    'Zona de Risco de Inundações Recorrentes (ZIR)':'Zona de Risco - Inundações Recorrentes (ZIR)', 'Detector de Uso de Celular (DUC)': 'Radar de Uso de Celular (DUC)',
    'Verificador de Cinto de Segurança (VCS)': 'Radar de Uso de Cinto de Segurança (RCS)', 'Leitor Inteligente de Placas (OCR-P)': 'Leitor de Placas (OCR-P)',
    'Leitor de Reconhecimento Facial (OCR-F)': 'Reconhecimento Facial (OCR-F)', 'Apenas Trânsito Local (ATL)': 'Apenas Trânsito Local (ATL)',
    'Passagem Sob Túnel Viário (TUV)':'Passagem Sob Túnel Viário (TUV)', 'Radar Inteligente de Velocidade Média (RIV)': 'Radar Inteligente de Velocidade Média (RIV)',
    'Alerta de Poluição Elevada (APE)': 'Área com Poluição Elevada (APE)'
};

function formatarNomeExibicao(nomeOriginal) {
    if (!nomeOriginal) return "";
    const prefixo = "Descubra a Cidade - ";
    return nomeOriginal.startsWith(prefixo) ? nomeOriginal.substring(prefixo.length) : nomeOriginal;
}

function getIconUrl(tipo, velocidade) {
    const tipoLimpo = tipo ? tipo.trim() : "";
    if (!tipoLimpo) return iconMap['default'];
    if (tipoLimpo.includes('Velocidade') || tipoLimpo.includes('CEV')) {
        var velNum = parseInt(String(velocidade || '').replace(/[^0-9]/g, ''), 10);
        if ([30,40,50,60,70,80,100,110].includes(velNum)) return `/imagens_app/ic_radar_cev_${velNum}_v2.png`;
        return '/imagens_app/ic_radar_cev_v2.png';
    }
    if (iconMap[tipoLimpo]) return iconMap[tipoLimpo];
    return iconMap['default'];
}

function showNotification(message) {
    var toast = document.getElementById('toast-msg');
    if (!toast) { console.log('[Radar X9] ' + message); return; }
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(showNotification._t);
    showNotification._t = setTimeout(function () { toast.classList.remove('show'); }, 3500);
}

function hideFullscreenLoading() {
    var el = document.getElementById('loading-fullscreen');
    if (el) { el.classList.add('fade-out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600); }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    var R = 6371e3, p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    var dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function suavizarBearing(alvo, atual, fator) {
    var diff = alvo - atual;
    while (diff > 180) diff -= 360; while (diff < -180) diff += 360;
    return (atual + diff * fator + 360) % 360;
}

function calcularZoomPorVelocidade() {
    if (velocidadeAtual < 5) return 19; if (velocidadeAtual < 20) return 18;
    if (velocidadeAtual < 40) return 17; if (velocidadeAtual < 60) return 16;
    if (velocidadeAtual < 80) return 15; return 14;
}

function calcularCentroMapaComOffset(lat, lng, bearing) {
    if (!estaEmNavegacao || !mapaRotacionado) return { lat: lat, lng: lng };
    var offsetDist = 0.0003, rad = (bearing - 90) * Math.PI / 180;
    return { lat: lat - Math.cos(rad) * offsetDist, lng: lng - Math.sin(rad) * offsetDist };
}

function encontrarPontoMaisProximoDaRota(lat, lng) {
    if (!coordenadasRotaNavegacao || coordenadasRotaNavegacao.length < 2) return { lat: lat, lng: lng, distancia: Infinity, segmento: -1, heading: null };
    let melhor = null, menorDistancia = Infinity, cosLat = Math.cos(lat * Math.PI / 180);
    const xGPS = lng * cosLat, yGPS = lat;
    for (let i = 0; i < coordenadasRotaNavegacao.length - 1; i++) {
        const a = coordenadasRotaNavegacao[i], b = coordenadasRotaNavegacao[i + 1];
        const ax = a.lng * cosLat, ay = a.lat, bx = b.lng * cosLat, by = b.lat;
        const dx = bx - ax, dy = by - ay, comprimento2 = dx * dx + dy * dy;
        let t = comprimento2 > 0 ? Math.max(0, Math.min(1, ((xGPS - ax) * dx + (yGPS - ay) * dy) / comprimento2)) : 0;
        const px = ax + t * dx, py = ay + t * dy;
        const distancia2 = (xGPS - px) * (xGPS - px) + (yGPS - py) * (yGPS - py);
        if (distancia2 < menorDistancia) {
            menorDistancia = distancia2;
            melhor = { lat: py, lng: px / cosLat, distancia: calcularDistancia(lat, lng, py, px / cosLat), segmento: i, heading: calcularBearing(a.lat, a.lng, b.lat, b.lng) };
        }
    }
    return melhor;
}

function ajustarPosicaoNaVia(lat, lng) {
    const resultado = encontrarPontoMaisProximoDaRota(lat, lng);
    if (!resultado) return { lat: lat, lng: lng };
    distanciaDaRota = resultado.distancia;
    if (resultado.distancia > 30) return { lat: lat, lng: lng, heading: null, ajustado: false };
    ultimoSegmentoRota = resultado.segmento;
    return { lat: resultado.lat, lng: resultado.lng, heading: resultado.heading, ajustado: true };
}

function suavizarPosicao(novaLat, novaLng) {
    if (posicaoSuavizada.lat === null) { posicaoSuavizada.lat = novaLat; posicaoSuavizada.lng = novaLng; return { lat: novaLat, lng: novaLng }; }
    posicaoSuavizada.lat += (novaLat - posicaoSuavizada.lat) * ALERT_CONFIG.SUAVIZACAO_FATOR;
    posicaoSuavizada.lng += (novaLng - posicaoSuavizada.lng) * ALERT_CONFIG.SUAVIZACAO_FATOR;
    return { lat: posicaoSuavizada.lat, lng: posicaoSuavizada.lng };
}

function adicionarAoHistorico(lat, lng, timestamp) {
    historicoPosicoes.push({ lat: lat, lng: lng, time: timestamp });
    if (historicoPosicoes.length > ALERT_CONFIG.HISTORICO_TAMANHO) historicoPosicoes.shift();
}

function calcularTendenciaDistancia(radarId, distanciaAtual) {
    if (!historicoDistanciasRadar[radarId]) historicoDistanciasRadar[radarId] = [];
    historicoDistanciasRadar[radarId].push({ distancia: distanciaAtual, time: Date.now() });
    if (historicoDistanciasRadar[radarId].length > 5) historicoDistanciasRadar[radarId].shift();
    var historico = historicoDistanciasRadar[radarId];
    if (historico.length < 2) return { estaAproximando: true, estaAfastando: false };
    var diferenca = historico[0].distancia - historico[historico.length - 1].distancia;
    if (diferenca > 5) return { estaAproximando: true, estaAfastando: false, diferenca: diferenca };
    if (diferenca < -5) return { estaAproximando: false, estaAfastando: true, diferenca: diferenca };
    return { estaAproximando: true, estaAfastando: false, diferenca: 0 };
}

function moverMarcadorSuavemente(targetLat, targetLng) {
    if (estaEmNavegacao && coordenadasRotaNavegacao.length >= 2) {
        const posicaoCorrigida = ajustarPosicaoNaVia(targetLat, targetLng);
        targetLat = posicaoCorrigida.lat; targetLng = posicaoCorrigida.lng;
        if (posicaoCorrigida.heading !== null) { headingIconeNavegacao = posicaoCorrigida.heading; atualizarIconeNavegacaoVia(headingIconeNavegacao); }
    }
    var marcadorParaMover = estaEmNavegacao ? startRouteMarker : userMarker;
    if (!marcadorParaMover) return;
    if (ultimaPosicaoMarcador.lat === null) { ultimaPosicaoMarcador = { lat: targetLat, lng: targetLng }; marcadorParaMover.setLatLng([targetLat, targetLng]); return; }
    var distancia = calcularDistancia(ultimaPosicaoMarcador.lat, ultimaPosicaoMarcador.lng, targetLat, targetLng);
    if (distancia < ALERT_CONFIG.DISTANCIA_MINIMA_MOVIMENTO) return;
    
    var inicioLat = ultimaPosicaoMarcador.lat, inicioLng = ultimaPosicaoMarcador.lng, duracao = 300, inicioTempo = performance.now();
    if (animacaoMarcadorAtiva) return;
    animacaoMarcadorAtiva = true;
    
    function animarFrame(tempoAtual) {
        var progresso = Math.min((tempoAtual - inicioTempo) / duracao, 1);
        var easing = 1 - Math.pow(1 - progresso, 3);
        marcadorParaMover.setLatLng([inicioLat + (targetLat - inicioLat) * easing, inicioLng + (targetLng - inicioLng) * easing]);
        if (progresso < 1) { requestAnimationFrame(animarFrame); } 
        else { ultimaPosicaoMarcador = { lat: targetLat, lng: targetLng }; animacaoMarcadorAtiva = false; }
    }
    requestAnimationFrame(animarFrame);
}

function verificarDirecaoMelhorada(uLat, uLng, uHeading, radarLatP, radarLngP, radarId, distanciaAtual) {
    if (!uHeading || uHeading === -1 || isNaN(uHeading)) {
        var t = calcularTendenciaDistancia(radarId, distanciaAtual);
        return { estaAproximando: t.estaAproximando, estaAfastando: t.estaAfastando };
    }
    var deltaX = radarLngP - uLng, deltaY = radarLatP - uLat;
    var anguloRadar = (Math.atan2(deltaY, deltaX) * 180 / Math.PI + 360) % 360;
    var diff = Math.abs(uHeading - anguloRadar); diff = Math.min(diff, 360 - diff);
    var tendencia = calcularTendenciaDistancia(radarId, distanciaAtual);
    return { estaAproximando: (diff < ALERT_CONFIG.ANGULO_APROXIMACAO) || tendencia.estaAproximando, estaAfastando: (diff > ALERT_CONFIG.ANGULO_AFASTANDO) && tendencia.estaAfastando };
}

function aplicarTemaMapa() {
    if (!map) return;
    var mapContainer = map.getContainer();
    var isNight = (new Date().getHours() >= 18 || new Date().getHours() < 6);
    mapContainer.classList.toggle('matrix-night', isNight);
    mapContainer.classList.toggle('matrix-day', !isNight);
    if (!tileLayer) {
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);
    }
}

function ajustarPosicaoSpeedWidget(subir) {
    var speedWidget = document.querySelector('.speed-widget');
    if (speedWidget) subir ? speedWidget.classList.add('alerta-ativo') : speedWidget.classList.remove('alerta-ativo');
}
function ajustarBussolaParaBusca(ativo) {
    var compassWidget = document.querySelector('.compass-widget');
    if (compassWidget) ativo ? compassWidget.classList.add('busca-ativo') : compassWidget.classList.remove('busca-ativo');
}
function ocultarBussola(ocultar) {
    var compassWidget = document.querySelector('.compass-widget');
    if (compassWidget) ocultar ? compassWidget.classList.add('hidden') : compassWidget.classList.remove('hidden');
}

function atualizarHorarioChegada(minutos) {
    minutos = parseInt(minutos);
    if (isNaN(minutos) || minutos < 0) { $("#nav-arrival").text("🏁 Chegada: --:--"); return; }
    const agora = new Date(); agora.setMinutes(agora.getMinutes() + minutos);
    $("#nav-arrival").text("🏁 Chegada: " + String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0"));
}

function adicionarMarcadoresRota(originLat, originLng, destLat, destLng) {
    destinoNavegacao = { lat: destLat, lng: destLng };
    if (startRouteMarker) { map.removeLayer(startRouteMarker); startRouteMarker = null; }
    if (endRouteMarker) { map.removeLayer(endRouteMarker); endRouteMarker = null; }
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    estaEmNavegacao = true; ultimaPosicaoMarcador = { lat: null, lng: null };
    
    var startIcon = L.divIcon({
        html: '<img id="nav-icon-img" src="/imagens_app/ic_navigator_map.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'" style="width:70px;height:70px;transform-origin:center center;transition:transform 0.3s ease-out;">',
        className: 'route-start-marker user-navigator-marker', iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -25]
    });
    startRouteMarker = L.marker([originLat, originLng], { icon: startIcon, zIndexOffset: 2000 }).addTo(map);
    
    var endIcon = L.divIcon({
        html: '<img src="/imagens_app/ic_icon_chegada.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/684/684908.png\'" style="width:45px;height:45px;">',
        className: 'route-end-marker', iconSize: [50, 50], iconAnchor: [25, 50], popupAnchor: [0, -50]
    });
    endRouteMarker = L.marker([destLat, destLng], { icon: endIcon, zIndexOffset: 900 }).addTo(map);
}

function atualizarRota() {
    if (!destinoAtual || !userLat || !userLng || !routingControl) return;
    routingControl.setWaypoints([L.latLng(userLat, userLng), L.latLng(destinoAtual.lat, destinoAtual.lng)]);
    routingControl.route();
}

function verificarChegadaDestino() {
    if (!destinoAtual || !userLat || !userLng) return;
    if (calcularDistancia(userLat, userLng, destinoAtual.lat, destinoAtual.lng) <= 30) {
        showNotification("Você chegou ao seu destino!");
        if (endRouteMarker) endRouteMarker.openPopup();
        setTimeout(finalizarNavegacao, 4000);
    }
}

function finalizarNavegacao() {
    if (!map) return;
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    destinoAtual = null; destinoNavegacao = null; estaEmNavegacao = false; estaEmMovimento = false; velocidadeAtual = 0;
    if (startRouteMarker) { map.removeLayer(startRouteMarker); startRouteMarker = null; }
    if (endRouteMarker) { map.removeLayer(endRouteMarker); endRouteMarker = null; }
    if (_navAnim.rafId) { cancelAnimationFrame(_navAnim.rafId); _navAnim.rafId = null; }
    _navAnim.fromLat = null; _navAnim.fromLng = null; ultimaPosicaoMarcador = { lat: null, lng: null };
    posicaoSuavizadaGPS = { lat: null, lng: null }; ultimaAtualizacaoCamera = 0; zoomAtualEfetivo = 18;
    centroAtualEfetivo = { lat: null, lng: null }; zoomAlvo = 18; bearingAlvo = 0; bearingAtual = 0;
    bearingAlvoAnterior = null; headingIconeNavegacao = 0; headingIconeSuavizado = 0;
    if (typeof map.setBearing === 'function') map.setBearing(0);
    mapaRotacionado = false;
    
    var ri = document.getElementById('rotate-btn-icon');
    if (ri) { ri.src = "/imagens_app/ic_girado_map.png"; ri.style.transform = 'rotate(0deg)'; }
    var rb = document.getElementById('btn-rotate-map');
    if (rb) rb.classList.remove('rotated');
    
    if (userLat && userLng) atualizarMarcadorUsuario(userLat, userLng, 'navegador');
    
    var sidebar = document.getElementById('sidebar-controls');
    var btnMenu = document.getElementById('btn-menu-toggle');
    if (sidebar && sidebar.classList.contains('controls-hidden')) { // Ajustado para controls-hidden
        sidebar.classList.remove('controls-hidden');
        if (btnMenu) btnMenu.classList.remove('active');
    }
    map.flyTo([userLat, userLng], 17, { duration: 1 });
    showNotification("Navegação encerrada");
}

function removerRota() { finalizarNavegacao(); }

function atualizarMarcadorUsuario(lat, lng, modo) {
    if (!map || estaEmNavegacao) return;
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    userMarker = L.marker([lat, lng], { icon: criarIconeNavegador(false), zIndexOffset: 1000 }).addTo(map);
    userMarker.bindTooltip('Você está aqui', { permanent: false, direction: 'top', offset: [0, -25] });
    ultimaPosicaoMarcador = { lat: lat, lng: lng }; iconeCentralizado = false;
}

function criarRota(destLat, destLng) {
    if (!userLat || !userLng) { showNotification("Aguardando posição GPS..."); return; }
    if (typeof L.Routing === 'undefined') { showNotification("Módulo de rotas não carregou."); return; }
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    destinoAtual = { lat: destLat, lng: destLng };
    adicionarMarcadoresRota(userLat, userLng, destLat, destLng);
    
    routingControl = L.Routing.control({
        waypoints: [L.latLng(userLat, userLng), L.latLng(destLat, destLng)], routeWhileDragging: false, addWaypoints: false,
        draggableWaypoints: false, fitSelectedRoutes: false, show: false, autoRoute: true,
        lineOptions: { styles: [{ color: '#4A148C', weight: 16, opacity: 0.4 }, { color: '#FF9800', weight: 5, opacity: 1.0 }] },
        createMarker: function () { return null; }, showAlternatives: false
    }).addTo(map);
    
    routingControl.on('routesfound', function (e) {
        let route = e.routes[0];
        if (route.coordinates && route.coordinates.length >= 2) {
            coordenadasRotaNavegacao = route.coordinates;
            var p1 = route.coordinates[0], p2 = route.coordinates[1];
            var headingInicial = calcularBearing(p1.lat, p1.lng, p2.lat, p2.lng);
            headingIconeNavegacao = headingInicial; headingIconeSuavizado = headingInicial;
            _navAnim.headingAlvo = headingInicial; _navAnim.headingSuavizado = headingInicial;
            bearingAlvo = headingInicial; bearingAtual = headingInicial; ultimoSegmentoRota = 0;
        }
        mostrarInfoNavegacao((route.summary.totalDistance / 1000).toFixed(1), Math.round(route.summary.totalTime / 60));
        iniciarModoNavegacaoSuave();
    });
}

function calcularBearing(lat1, lng1, lat2, lng2) {
    var dLon = (lng2 - lng1) * Math.PI / 180, lat1Rad = lat1 * Math.PI / 180, lat2Rad = lat2 * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2Rad);
    var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function iniciarModoNavegacaoSuave() {
    estaEmNavegacao = true; isFollowing = true;
    if (currentHeading > 0 && typeof map.setBearing === 'function') {
        mapaRotacionado = true; bearingAlvo = currentHeading; bearingAtual = currentHeading;
        map.setBearing(currentHeading);
        var rb = document.getElementById('btn-rotate-map');
        if (rb) rb.classList.add('rotated');
    }
}

function atualizarCameraNavegacaoSuave() {
    if (!estaEmNavegacao || !isFollowing) return;
    let agora = Date.now();
    if (agora - ultimaAtualizacaoCamera < INTERVALO_CAMERA_MS) return;
    ultimaAtualizacaoCamera = agora;
    
    let zoomDesejado = calcularZoomPorVelocidade();
    zoomAlvo = zoomAlvo * 0.85 + zoomDesejado * 0.15;
    let zoomArredondado = Math.round(zoomAlvo * 10) / 10;
    let latCam = ultimaPosicaoMarcador.lat || posicaoSuavizada.lat || userLat;
    let lngCam = ultimaPosicaoMarcador.lng || posicaoSuavizada.lng || userLng;
    let c = calcularCentroMapaComOffset(latCam, lngCam, bearingAtual);
    
    let mudancaPos = centroAtualEfetivo.lat !== null ? calcularDistancia(c.lat, c.lng, centroAtualEfetivo.lat, centroAtualEfetivo.lng) : 999;
    
    if (mapaRotacionado && typeof map.setBearing === 'function') {
        bearingAtual = suavizarBearing(bearingAlvo, bearingAtual, FATOR_SUAVIZACAO_BEARING);
        map.setBearing(bearingAtual);
        var rotateBtnIcon = document.getElementById('rotate-btn-icon');
        if (rotateBtnIcon) rotateBtnIcon.style.transform = 'rotate(' + bearingAtual + 'deg)';
    }
    if (mudancaPos < 2 && Math.abs(zoomArredondado - zoomAtualEfetivo) < 0.3 && centroAtualEfetivo.lat !== null) return;
    
    centroAtualEfetivo = { lat: c.lat, lng: c.lng }; zoomAtualEfetivo = zoomArredondado;
    map.setView([c.lat, c.lng], zoomArredondado, { animate: false, duration: 0 });
}

async function buscarCoordenadas(endereco) {
    try {
        var response = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(endereco));
        var data = await response.json();
        if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        return null;
    } catch (e) { return null; }
}

function resetarMapa() {
    if (!map) return;
    mapaRotacionado = false; bearingAlvo = 0; bearingAtual = 0;
    if (typeof map.setBearing === 'function') map.setBearing(0);
    var rotateBtnIcon = document.getElementById('rotate-btn-icon');
    if (rotateBtnIcon) { rotateBtnIcon.src = "/imagens_app/ic_girado_map.png"; rotateBtnIcon.style.transform = 'rotate(0deg)'; }
    var rotateBtn = document.getElementById('btn-rotate-map');
    if (rotateBtn) rotateBtn.classList.remove('rotated');
    
    map.setView([posicaoCentralOriginal.lat, posicaoCentralOriginal.lng], posicaoCentralOriginal.zoom, { animate: true, duration: 0.5 });
    isFollowing = false; alertaNormalidadeMostrado = false;
    
    if (!estaEmNavegacao && userMarker) {
        var pos = userMarker.getLatLng(); map.removeLayer(userMarker);
        userMarker = L.marker([pos.lat, pos.lng], { icon: criarIconeNavegador(false), zIndexOffset: 1000 }).addTo(map);
        iconeCentralizado = false;
    }
    removerRota(); esconderAlertaVisual(); showNotification("Mapa resetado");
    historicoDistanciasRadar = {};
}

function atualizarBussola(headingDegrees) {
    var needle = document.getElementById('compass-needle-img');
    if (needle && headingDegrees != null && !isNaN(headingDegrees)) needle.style.transform = 'rotate(' + headingDegrees + 'deg)';
    if (estaEmNavegacao && coordenadasRotaNavegacao && coordenadasRotaNavegacao.length >= 2 && userLat != null) {
        var posicaoVia = ajustarPosicaoNaVia(userLat, userLng);
        if (posicaoVia && posicaoVia.heading != null) { headingIconeNavegacao = posicaoVia.heading; atualizarIconeNavegacaoVia(headingIconeNavegacao); }
    }
}

function atualizarIconeNavegacaoVia(headingVia) {
    var navIcon = document.querySelector('.nav-pulse-wrap img');
    if (!navIcon || headingVia == null || isNaN(headingVia)) return;
    navIcon.style.transform = mapaRotacionado ? 'rotate(0deg)' : 'rotate(' + headingVia + 'deg)';
}

var _navAnim = { rafId: null, fromLat: null, fromLng: null, toLat: null, toLng: null, startTime: null, duration: 600, headingAlvo: 0, headingSuavizado: 0 };

function _animarIconeNavegacao() {
    if (!estaEmNavegacao || !startRouteMarker) return;
    var agora = performance.now(), progresso = Math.min((agora - _navAnim.startTime) / _navAnim.duration, 1);
    var t = 1 - Math.pow(1 - progresso, 3);
    _navAnim.headingSuavizado = suavizarBearing(_navAnim.headingAlvo, _navAnim.headingSuavizado, 0.12);
    startRouteMarker.setLatLng([_navAnim.fromLat + (_navAnim.toLat - _navAnim.fromLat) * t, _navAnim.fromLng + (_navAnim.toLng - _navAnim.fromLng) * t]);
    var imgNav = document.getElementById('nav-icon-img');
    if (imgNav) imgNav.style.transform = 'rotate(' + _navAnim.headingSuavizado + 'deg)';
    posicaoSuavizadaGPS = { lat: _navAnim.fromLat + (_navAnim.toLat - _navAnim.fromLat) * t, lng: _navAnim.fromLng + (_navAnim.toLng - _navAnim.fromLng) * t };
    if (progresso < 1) { _navAnim.rafId = requestAnimationFrame(_animarIconeNavegacao); } 
    else { _navAnim.rafId = null; ultimaPosicaoMarcador = { lat: _navAnim.toLat, lng: _navAnim.toLng }; }
}

function _iniciarAnimacaoNavegacao(toLat, toLng, novoHeading) {
    if (_navAnim.rafId) { cancelAnimationFrame(_navAnim.rafId); _navAnim.rafId = null; }
    var pos = startRouteMarker ? startRouteMarker.getLatLng() : null;
    _navAnim.fromLat = pos ? pos.lat : toLat; _navAnim.fromLng = pos ? pos.lng : toLng;
    _navAnim.toLat = toLat; _navAnim.toLng = toLng; _navAnim.startTime = performance.now();
    if (novoHeading !== null && !isNaN(novoHeading)) { _navAnim.headingAlvo = novoHeading; headingIconeNavegacao = novoHeading; }
    _navAnim.rafId = requestAnimationFrame(_animarIconeNavegacao);
}

function processarNovaPosicao(newLat, newLng, speedKmh, hardwareHeading, accuracy) {
    if (!map) return;
    var currentTime = Date.now(), dist = 0;
    adicionarAoHistorico(newLat, newLng, currentTime);
    var posSuave = suavizarPosicao(newLat, newLng);
    
    if (prevLat !== null) {
        dist = calcularDistancia(prevLat, prevLng, newLat, newLng);
        if (speedKmh === 0 && prevTime !== null) {
            var time = (currentTime - prevTime) / 1000;
            if (time > 0) speedKmh = Math.round((dist / time) * 3.6);
        }
    }
    if (speedKmh > 250) speedKmh = 0;
    velocidadeAtual = speedKmh;
    var speedEl = document.getElementById('speed-display');
    if (speedEl) speedEl.textContent = speedKmh;
    estaEmMovimento = speedKmh > 3 || dist > 2;
    
    var novoHeading = null;
    if (hardwareHeading !== null && !isNaN(hardwareHeading) && hardwareHeading >= 0) {
        if (!bussolaHardwareDisponivel) { currentHeading = hardwareHeading; bussolaHardwareDisponivel = true; }
        novoHeading = hardwareHeading;
    } else if (!bussolaHardwareDisponivel && dist > 3 && prevLat !== null) {
        var dy = newLat - prevLat, dx = (newLng - prevLng) * Math.cos(newLat * Math.PI / 180);
        if (Math.abs(dx) > 0.0000001 || Math.abs(dy) > 0.0000001) {
            currentHeading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            novoHeading = currentHeading;
        }
    }
    if (novoHeading !== null && estaEmMovimento) { bearingAlvo = novoHeading; headingIconeNavegacao = novoHeading; }
    if (currentHeading !== null) atualizarBussola(currentHeading);
    
    prevLat = newLat; prevLng = newLng; prevTime = currentTime;
    userLat = newLat; userLng = newLng;
    atualizarStatusGPS({ coords: { latitude: newLat, longitude: newLng, accuracy: accuracy || 999 } });
    
    if (estaEmNavegacao) {
        if (!startRouteMarker && destinoAtual) adicionarMarcadoresRota(userLat, userLng, destinoAtual.lat, destinoAtual.lng);
        if (startRouteMarker) _iniciarAnimacaoNavegacao(posSuave.lat, posSuave.lng, novoHeading);
        if (!gpsInitialized) { gpsInitialized = true; hideFullscreenLoading(); }
    } else {
        if (!userMarker) {
            userMarker = L.marker([posSuave.lat, posSuave.lng], { icon: criarIconeNavegador(true), zIndexOffset: 1000 }).addTo(map);
            userMarker.bindTooltip('Você está aqui', { permanent: false, direction: 'top', offset: [0, -25] });
            ultimaPosicaoMarcador = { lat: posSuave.lat, lng: posSuave.lng }; iconeCentralizado = false;
            map.setView([posSuave.lat, posSuave.lng], Math.max(map.getZoom(), 17), { animate: false });
            if (!gpsInitialized) { gpsInitialized = true; hideFullscreenLoading(); }
        } else {
            if (iconeCentralizado && speedKmh > 3) {
                var pos = userMarker.getLatLng(); map.removeLayer(userMarker);
                userMarker = L.marker([pos.lat, pos.lng], { icon: criarIconeNavegador(false), zIndexOffset: 1000 }).addTo(map);
                iconeCentralizado = false; showNotification("🧭 Modo navegação ativado");
            }
            moverMarcadorSuavemente(posSuave.lat, posSuave.lng);
        }
    }
    
    if (destinoAtual && routingControl && estaEmNavegacao) {
        if (!window.ultimaAtualizacaoRota || (currentTime - window.ultimaAtualizacaoRota > 5000)) {
            atualizarRota(); window.ultimaAtualizacaoRota = currentTime;
        }
    }
    if (estaEmNavegacao && isFollowing) atualizarCameraNavegacaoSuave();
    else if (isFollowing && !estaEmNavegacao) map.setView([posSuave.lat, posSuave.lng], map.getZoom(), { animate: true, duration: 0.5 });
    
    verificarProximidadeRadares();
    if (destinoAtual) verificarChegadaDestino();
}

var _ultimaNotificacaoApp = { t: 0, lat: null, lng: null };
function notificarLocalizacaoApp(lat, lng) {
    if (typeof window.setUserLocation !== 'function') return;
    var agora = Date.now();
    var moveu = _ultimaNotificacaoApp.lat === null ? Infinity : calcularDistancia(_ultimaNotificacaoApp.lat, _ultimaNotificacaoApp.lng, lat, lng);
    if (moveu > 50 || (agora - _ultimaNotificacaoApp.t) > 30000) {
        _ultimaNotificacaoApp = { t: agora, lat: lat, lng: lng };
        try { window.setUserLocation(lat, lng); } catch (e) {}
    }
}

function obterPosicaoInicialRapida() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        function (position) {
            notificarLocalizacaoApp(position.coords.latitude, position.coords.longitude);
            processarNovaPosicao(position.coords.latitude, position.coords.longitude, position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0, position.coords.heading, position.coords.accuracy);
        },
        function (error) { if (typeof window.setUserLocation === 'function') window.setUserLocation(-19.9167, -43.9345); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function startGPSTracking() {
    if (browserGpsTimeout) { clearTimeout(browserGpsTimeout); browserGpsTimeout = null; }
    if (!navigator.geolocation) { hideFullscreenLoading(); showNotification("GPS não suportado."); return; }
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    
    watchId = navigator.geolocation.watchPosition(
        function (position) {
            notificarLocalizacaoApp(position.coords.latitude, position.coords.longitude);
            processarNovaPosicao(position.coords.latitude, position.coords.longitude, position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0, position.coords.heading, position.coords.accuracy);
            if (!gpsInitialized) { gpsInitialized = true; hideFullscreenLoading(); }
        },
        function (error) {
            atualizarStatusGPS(null);
            if (error.code === 1) showNotification("Permissão de GPS negada.");
            else if (error.code === 2) showNotification("Sinal GPS indisponível.");
            if (!gpsInitialized) hideFullscreenLoading();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
    browserGpsTimeout = setTimeout(function () { if (!gpsInitialized) { showNotification("Aguardando sinal de GPS..."); hideFullscreenLoading(); } }, 8000);
}

function stopGPSTracking() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; gpsInitialized = false; }
    if (browserGpsTimeout) { clearTimeout(browserGpsTimeout); browserGpsTimeout = null; }
}
function restartGPSTracking() { stopGPSTracking(); setTimeout(startGPSTracking, 500); }

function ajustarHeaderResponsivo() {
    const width = window.innerWidth;
    const gpsLabel = document.getElementById('gps-status-label');
    const cidadeLabel = document.getElementById('cidade-atual');
    if (width < 400) {
        if (gpsLabel) gpsLabel.textContent = '';
        if (cidadeLabel) { cidadeLabel.classList.add('tela-muito-pequena'); cidadeLabel.classList.remove('modo-app', 'modo-site'); }
    } else if (width < 600) {
        if (gpsLabel && !gpsLabel.textContent) gpsLabel.textContent = 'GPS';
        if (cidadeLabel) { cidadeLabel.classList.remove('tela-muito-pequena'); cidadeLabel.classList.add('modo-app'); }
    } else {
        if (gpsLabel && !gpsLabel.textContent) gpsLabel.textContent = 'GPS';
        if (cidadeLabel) { cidadeLabel.classList.remove('tela-muito-pequena', 'modo-app'); cidadeLabel.classList.add('modo-site'); }
    }
}

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function classificarAlerta(tipoOriginal) {
    var tipoNorm = normalizarTexto(tipoOriginal);
    for (var d = 0; d < TIPOS_ALERTA_DESTAQUE.length; d++) if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_DESTAQUE[d]))) return 'destaque';
    for (var r = 0; r < TIPOS_ALERTA_RISCO.length; r++) if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_RISCO[r]))) return 'risco';
    for (var m = 0; m < TIPOS_ALERTA_MOBILIDADE.length; m++) if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_MOBILIDADE[m]))) return 'mobilidade';
    for (var sv = 0; sv < TIPOS_ALERTA_SERVICO.length; sv++) if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_SERVICO[sv]))) return 'servico';
    for (var rr = 0; rr < TIPOS_ALERTA_RADAR.length; rr++) if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_RADAR[rr]))) return 'radar';
    return 'radar';
}

function deveAlertaRadar(tipoOriginal) {
    var tipoNorm = normalizarTexto(tipoOriginal);
    for (var i = 0; i < TIPOS_SEM_ALERTA.length; i++) if (tipoNorm.includes(normalizarTexto(TIPOS_SEM_ALERTA[i]))) return false;
    return true;
}

var contagemTocarSom = 0;
function dispararAlerta(radarData, distancia) {
    var tipo = classificarAlerta(radarData.tipoOriginal);
    tipoAlertaAtivo = tipo; ultimoRadarAlertado = radarData.id; contagemTocarSom = 0;
    var $container = $("#alert-container"), $bar = $container.find(".alert-bar");
    $bar.removeClass('alert-bar-radar alert-bar-risco alert-bar-mobilidade alert-bar-destaque alert-bar-servico alert-bar-critico alert-bar-risco-critico alert-bar-mobilidade-critico alert-bar-destaque-critico alert-bar-servico-critico');
    $bar.addClass('alert-bar-' + tipo);
    
    var tipoExibicao = ajusteNomes[radarData.tipoOriginal] || radarData.tipoOriginal;
    $("#alert-icon").attr('src', getIconUrl(radarData.tipoOriginal, radarData.velocidade_maxima));
    var titulos = { radar: 'ALERTA DE RADAR', risco: 'ALERTA DE RISCO', mobilidade: 'AVISO MOBILIDADE', destaque: 'DESCUBRA A CIDADE', servico: 'REDE DE SERVIÇOS' };
    $("#alert-title").text(titulos[tipo] || 'ATENÇÃO!');
    
    var vel = radarData.velocidade_maxima || '';
    var textoParaExibir = tipo === 'destaque' ? tipoExibicao.replace(/^Descubra a Cidade\s*-\s*/i, '').trim() : tipoExibicao;
    var base = textoParaExibir + (vel ? ' — ' + vel + ' km' : '');
    $("#alert-text").data('alert-base', base).text(base + ' - ' + Math.round(distancia) + ' m');
    
    if (distancia <= ALERT_CONFIG.DISTANCIA_CRITICA) $bar.addClass('alert-bar-' + tipo + '-critico');
    $container.stop(true, true).show(); ajustarPosicaoSpeedWidget(true);
    tocarSomAlerta(tipo);
    if (alertTimeout) clearTimeout(alertTimeout);
    alertTimeout = setTimeout(esconderAlertaVisual, ALERT_CONFIG.TEMPO_ALERTA);
}

function atualizarDistanciaAlerta(distancia) {
    var $text = $("#alert-text"), base = $text.data('alert-base') || $text.text().split(' - ')[0];
    $text.text(base + ' - ' + Math.round(distancia) + ' m');
    if (alertTimeout) clearTimeout(alertTimeout);
    alertTimeout = setTimeout(esconderAlertaVisual, ALERT_CONFIG.TEMPO_ALERTA);
}

function fecharAlertaImediatamente() {
    if (alertTimeout) { clearTimeout(alertTimeout); alertTimeout = null; }
    $("#alert-container").stop(true, true).hide(); ajustarPosicaoSpeedWidget(false);
    pararTodosSons(); cancelarSequenciaSom(); tipoAlertaAtivo = null;
}

function esconderAlertaVisual() {
    if (alertTimeout) { clearTimeout(alertTimeout); alertTimeout = null; }
    var tipoAnterior = tipoAlertaAtivo;
    $("#alert-container").fadeOut(200, function () { $(this).find(".alert-bar").removeClass('alert-bar-critico alert-bar-risco-critico alert-bar-mobilidade-critico alert-bar-destaque-critico alert-bar-servico-critico'); });
    ajustarPosicaoSpeedWidget(false); pararTodosSons(); cancelarSequenciaSom();
    if (tipoAnterior && somAlertaHabilitado) silenciarAlertaComBeep(tipoAnterior);
    tipoAlertaAtivo = null;
}

function verificarProximidadeRadares() {
    if (radarMarkers.length === 0) return;
    let radarMaisProximo = null, menorDistancia = Infinity;
    radarMarkers.forEach(function (marker) {
        const rData = marker.radarData;
        if (!rData || !deveAlertaRadar(rData.tipoOriginal)) return;
        const dist = calcularDistancia(userLat, userLng, rData.latitude, rData.longitude);
        if (dist < menorDistancia) { menorDistancia = dist; radarMaisProximo = rData; }
    });
    
    if (radarMaisProximo && menorDistancia <= ALERT_CONFIG.DISTANCIA_MAXIMA) {
        const direcao = verificarDirecaoMelhorada(userLat, userLng, currentHeading, radarMaisProximo.latitude, radarMaisProximo.longitude, radarMaisProximo.id, menorDistancia);
        if (menorDistancia <= ALERT_CONFIG.DISTANCIA_PASSAR_RADAR) { esconderAlertaVisual(); ultimoRadarAlertado = radarMaisProximo.id; return; }
        if (direcao.estaAfastando) { fecharAlertaImediatamente(); if (menorDistancia > ALERT_CONFIG.DISTANCIA_MAXIMA - 30) ultimoRadarAlertado = null; return; }
        if (direcao.estaAproximando) {
            if (ultimoRadarAlertado !== radarMaisProximo.id) dispararAlerta(radarMaisProximo, menorDistancia);
            else { atualizarDistanciaAlerta(menorDistancia); if (menorDistancia <= ALERT_CONFIG.DISTANCIA_CRITICA) $(".alert-bar").addClass("alert-bar-critico"); }
        }
    } else {
        if ($("#alert-container").is(":visible")) esconderAlertaVisual();
        if (menorDistancia > ALERT_CONFIG.DISTANCIA_MAXIMA + 80) { ultimoRadarAlertado = null; historicoDistanciasRadar = {}; }
    }
}

function inicializarBotaoAlertaToggle() {
    var alertBtn = document.getElementById('btn-alert-toggle');
    var alertIcon = document.getElementById('alert-toggle-icon');
    if (!alertBtn) return;
    alertBtn.addEventListener('click', function () {
        somAlertaHabilitado = !somAlertaHabilitado; alertaHabilitado = somAlertaHabilitado;
        if (somAlertaHabilitado) {
            alertBtn.classList.remove('alert-off');
            if (alertIcon) alertIcon.src = '/imagens_app/ic_sound_on.png';
            tocarBeepConfirmacao('on'); showNotification('Som LIGADO');
        } else {
            alertBtn.classList.add('alert-off');
            if (alertIcon) alertIcon.src = '/imagens_app/ic_sound_off.png';
            pararTodosSons(); cancelarSequenciaSom();
            tocarBeepConfirmacao('off'); showNotification('Som DESLIGADO');
        }
    });
}

function tocarBeepConfirmacao(estado) {
    try {
        var ctx = getAudioCtx(), osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (estado === 'on') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(1200, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
        } else {
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {}
}

function silenciarAlertaComBeep(tipoAlerta) {
    cancelarSequenciaSom();
    try { var ctx = getAudioCtx(); _tocarBeep(ctx, tipoAlerta); } catch (e) {}
}

function _tocarBeep(ctx, tipoAlerta) {
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (tipoAlerta === 'risco') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.6, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } else if (tipoAlerta === 'mobilidade') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.5, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
    } else {
        osc.type = 'sine'; osc.frequency.setValueAtTime(1050, ctx.currentTime);
        gain.gain.setValueAtTime(0.6, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
    }
}

var _audioCtx = null, _audioDesbloqueado = false;
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(function () {});
    return _audioCtx;
}

function desbloquearAudioMobile() {
    if (_audioDesbloqueado) return;
    try {
        var ctx = getAudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume().then(function () { _audioDesbloqueado = true; });
        } else { _audioDesbloqueado = true; }
    } catch (e) {}
}
['click', 'touchstart', 'touchend', 'keydown'].forEach(function (evt) { document.addEventListener(evt, desbloquearAudioMobile, { once: false, passive: true }); });

var _alertSoundsDesbloqueados = false;
var IDS_AUDIOS_ALERTA = ['alert-sound-radar', 'alert-sound-risco', 'alert-sound-aviso', 'alert-sound-destaque', 'alert-sound-servico'];
function desbloquearAudiosDeAlerta() {
    IDS_AUDIOS_ALERTA.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el || el._desbloqueado) return;
        el.muted = true;
        var p = el.play();
        if (p && typeof p.then === 'function') {
            p.then(function () { el.pause(); el.currentTime = 0; el.muted = false; el._desbloqueado = true; }).catch(function () { el.muted = false; });
        } else { el.muted = false; }
    });
}
['click', 'touchstart', 'touchend', 'keydown'].forEach(function (evt) { document.addEventListener(evt, desbloquearAudiosDeAlerta, { once: false, passive: true }); });

var _sequenciaSomId = 0, _alertaPrincipalEstaTocando = false, _soundListeners = {};
function cancelarSequenciaSom() {
    _sequenciaSomId++; _alertaPrincipalEstaTocando = false;
    IDS_AUDIOS_ALERTA.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && _soundListeners[id]) { el.removeEventListener('ended', _soundListeners[id]); delete _soundListeners[id]; el.pause(); el.currentTime = 0; }
    });
}
function pararTodosSons() { cancelarSequenciaSom(); _alertaPrincipalEstaTocando = false; IDS_AUDIOS_ALERTA.forEach(function (id) { var el = document.getElementById(id); if (el) { el.pause(); el.currentTime = 0; } }); }

function tocarSomAlerta(tipoAlerta) {
    if (!somAlertaHabilitado) return;
    try { if (typeof window.enviarAlertaSonoroParaAppInventor === 'function') window.enviarAlertaSonoroParaAppInventor(tipoAlerta); } catch (e) {}
    if (_alertaPrincipalEstaTocando) return;
    
    var soundId = 'alert-sound-radar';
    if (tipoAlerta === 'risco') soundId = 'alert-sound-risco';
    else if (tipoAlerta === 'mobilidade') soundId = 'alert-sound-aviso';
    else if (tipoAlerta === 'destaque') soundId = 'alert-sound-destaque';
    else if (tipoAlerta === 'servico') soundId = 'alert-sound-servico';
    
    var sound = document.getElementById(soundId) || document.getElementById('alert-sound-radar');
    if (!sound) return;
    
    _sequenciaSomId++; var meuId = _sequenciaSomId; _alertaPrincipalEstaTocando = true;
    var safetyTimer = setTimeout(function () {
        if (meuId === _sequenciaSomId && _alertaPrincipalEstaTocando) {
            _alertaPrincipalEstaTocando = false;
            if (_soundListeners[soundId]) { sound.removeEventListener('ended', _soundListeners[soundId]); delete _soundListeners[soundId]; }
        }
    }, 8000);
    
    var toques = 0, numToques = 3;
    if (_soundListeners[soundId]) { sound.removeEventListener('ended', _soundListeners[soundId]); delete _soundListeners[soundId]; }
    
    function onEnded() {
        clearTimeout(safetyTimer);
        if (meuId !== _sequenciaSomId) { _alertaPrincipalEstaTocando = false; return; }
        toques++;
        if (toques < numToques) {
            sound.currentTime = 0;
            // CORREÇÃO: Adicionado catch para evitar travamento por NotAllowedError
            sound.play().catch(function (err) {
                if (err.name !== 'NotAllowedError') console.error('[Radar X9] Falha no toque:', err);
                _alertaPrincipalEstaTocando = false;
            });
        } else {
            sound.removeEventListener('ended', onEnded); delete _soundListeners[soundId]; _alertaPrincipalEstaTocando = false;
        }
    }
    _soundListeners[soundId] = onEnded;
    sound.addEventListener('ended', onEnded);
    sound.currentTime = 0;
    
    var playPromise = sound.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function (err) {
            clearTimeout(safetyTimer);
            if (err.name !== 'NotAllowedError') console.error('[Radar X9] Falha ao iniciar áudio:', err);
            sound.removeEventListener('ended', onEnded); delete _soundListeners[soundId]; _alertaPrincipalEstaTocando = false;
        });
    }
}

function animarBotaoRadar(status) {
    const btn = document.getElementById('btn-add-radar');
    if (!btn) return;
    const icon = btn.querySelector('.plus-icon');
    if (!icon) return;
    function restaurar() {
        icon.textContent = '+'; btn.style.background = 'linear-gradient(135deg, #00cc66, #00994d)';
        btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 20px rgba(0, 204, 102, 0.5)'; btn.style.borderColor = 'rgba(0, 255, 136, 0.4)';
    }
    if (status === 'adicionado') {
        icon.textContent = '✓'; btn.style.background = 'linear-gradient(135deg, #ffa500, #ff8c00)';
        btn.style.transform = 'scale(1.15)'; btn.style.boxShadow = '0 0 40px rgba(255, 165, 0, 0.9)'; btn.style.borderColor = '#ffa500';
        setTimeout(restaurar, 2000);
    } else if (status === 'erro') {
        icon.textContent = '✗'; btn.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
        btn.style.transform = 'scale(1.1)'; btn.style.boxShadow = '0 0 40px rgba(255, 0, 0, 0.6)'; btn.style.borderColor = '#ff0000';
        setTimeout(restaurar, 2000);
    }
}

function criarIconeRadar(iconUrl, tamanho, fallbackUrl) {
    return L.icon({ iconUrl: iconUrl, iconSize: [tamanho, tamanho], iconAnchor: [tamanho / 2, tamanho / 2], popupAnchor: [0, -tamanho / 2], className: 'radar-marker-icon' });
}

function criarRadarNoMapa(radarData) {
    if (!map) return null;
    const iconeUrl = getIconUrl(radarData.tipo, radarData.velocidade);
    const radarMarker = L.marker([radarData.latitude, radarData.longitude], { icon: criarIconeRadar(iconeUrl, 40, '/imagens_app/ic_radar_cev_v2.png'), zIndexOffset: 1000 }).addTo(map);
    const tipoExibicao = ajusteNomes[radarData.tipo] || radarData.tipo;
    const seloUsuario = radarData.isUsuario ? '<div style="color:#00cc66;font-size:0.75rem;margin-top:4px;">🧩 Compartilhado por usuários</div>' : '';
    radarMarker.bindPopup(`<div style="color:#222; font-family:'Inter'; text-align:center; min-width:200px;"><b>${tipoExibicao}</b><br><hr style="border:0; border-top:1px solid #ddd; margin:5px 0;">${radarData.endereco || 'Endereço não informado'}<br><div style="color:#d00; font-weight:bold; margin-top:5px;">Máx: ${radarData.velocidade || 'N/A'} km/h</div>${seloUsuario}</div>`);
    radarMarker.radarData = { id: radarData.id || radarMarkers.length, latitude: radarData.latitude, longitude: radarData.longitude, endereco: radarData.endereco, velocidade_maxima: radarData.velocidade, tipoOriginal: radarData.tipo, tipoExibicao: tipoExibicao, isUsuario: !!radarData.isUsuario };
    return radarMarker;
}

function restaurarEstadoCentralizado() {
    mapaCentralizado = true;
    if (recentragemTimeout) { clearTimeout(recentragemTimeout); recentragemTimeout = null; }
    if (speedIconEl) speedIconEl.src = ICONE_VELOCIDADE;
    if (speedWidgetEl) speedWidgetEl.classList.remove('recentralizar');
}

function agendarRecentragemAutomatica() {
    if (recentragemTimeout) clearTimeout(recentragemTimeout);
    recentragemTimeout = setTimeout(recentralizarMapa, TEMPO_RECENTRALIZAR_MS);
}

function desativarCentralizacao() {
    isFollowing = false;
    if (mapaCentralizado) {
        mapaCentralizado = false;
        if (speedIconEl) speedIconEl.src = ICONE_RECENTRALIZAR;
        if (speedWidgetEl) speedWidgetEl.classList.add('recentralizar');
    }
    agendarRecentragemAutomatica();
}

function recentralizarMapa() {
    if (!map) return;
    if (mapaCentralizado && isFollowing) return;
    restaurarEstadoCentralizado(); isFollowing = true;
    var marcador = estaEmNavegacao ? startRouteMarker : userMarker;
    var alvo = marcador ? marcador.getLatLng() : L.latLng(userLat, userLng);
    map.flyTo(alvo, map.getZoom(), { animate: true, duration: 0.6 });
}

function inicializarRecentralizacao() {
    speedWidgetEl = document.getElementById('speedWidget') || document.getElementById('speed-widget') || document.querySelector('.speed-widget');
    speedIconEl = document.getElementById('speedIcon') || document.getElementById('speed-icon') || (speedWidgetEl ? speedWidgetEl.querySelector('img') : null);
    if (speedWidgetEl) {
        if (L.DomEvent) L.DomEvent.disableClickPropagation(speedWidgetEl);
        speedWidgetEl.addEventListener('click', function () { if (!mapaCentralizado || !isFollowing) recentralizarMapa(); });
    }
    if (map) map.on('dragstart', desativarCentralizacao);
}

// ===================================================================
// CORREÇÃO 1 & 2: MENU LATERAL E SIDEBAR DIREITA HARMONIZADOS
// ===================================================================
function fecharTodasBarras() {
    searchActive = false; routeActive = false;
    var barraRadar = document.getElementById('search-bar-radares');
    var barraRota = document.getElementById('search-bar-rota');
    if (barraRadar) barraRadar.classList.remove('active');
    if (barraRota) barraRota.classList.remove('active');
    ajustarBussolaParaBusca(false);
}

function inicializarSidebarToggle() {
    const sidebar = document.getElementById('sidebar-controls');
    // CORREÇÃO: Usar querySelector para pegar a classe .controls-handle, que é o padrão do CSS
    const handle = document.querySelector('.controls-handle') || document.getElementById('btn-controls-handle');
    
    if (!sidebar || !handle) {
        console.warn('[Radar X9] ⚠️ Sidebar ou alça de controle (.controls-handle) não encontrada.');
        return;
    }
    
    handle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation(); // Impede que o clique feche o menu esquerdo se estiver aberto
        sidebar.classList.toggle('controls-hidden');
    });
}

function inicializarMenuToggle() {
    const btnMenu = document.getElementById('btn-menu-toggle');
    const menuLateral = document.getElementById('menu-lateral');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuDropdown = document.getElementById('menu-dropdown');

    if (!btnMenu || !menuLateral) {
        console.warn('[Radar X9] ⚠️ #btn-menu-toggle ou #menu-lateral não encontrado.');
        return;
    }

    function toggleMenu(forcarFechamento = false) {
        const estaAberto = menuLateral.classList.contains('aberto');
        if (estaAberto || forcarFechamento) {
            menuLateral.classList.remove('aberto');
            if (menuOverlay) menuOverlay.classList.remove('aberto');
            btnMenu.classList.remove('active');
        } else {
            menuLateral.classList.add('aberto');
            if (menuOverlay) menuOverlay.classList.add('aberto');
            btnMenu.classList.add('active');
            if (menuDropdown) menuDropdown.style.display = 'none';
        }
    }

    // Clique no botão hambúrguer
    btnMenu.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleMenu();
    });

    // Clique no overlay (fundo escuro)
    if (menuOverlay) {
        menuOverlay.addEventListener('click', function (e) {
            // CORREÇÃO: Só fecha se clicar EXATAMENTE no overlay, não no menu
            if (e.target === menuOverlay) {
                toggleMenu(true);
            }
        });
    }

    // CORREÇÃO CRÍTICA: Impedir que cliques DENTRO do menu lateral (abas, links) o fechem
    menuLateral.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function (e) {
        if (menuDropdown && !menuDropdown.contains(e.target) && e.target !== btnMenu && !btnMenu.contains(e.target)) {
            menuDropdown.style.display = 'none';
        }
    });
}

function atualizarStatusGitHub() {
    var statusText = document.getElementById('status-github-text');
    if (!statusText) return;
    if (RADAR_MODO_OFFLINE) { statusText.textContent = 'Offline'; statusText.style.color = '#ff4444'; } 
    else if (GITHUB_CONFIG.token) { statusText.textContent = 'Conectado'; statusText.style.color = '#00cc66'; } 
    else { statusText.textContent = 'Não configurado'; statusText.style.color = '#ffc107'; }
}

function abrirModalConfigGithub() {
    var modal = document.getElementById('modal-config-github');
    if (!modal) return;
    document.getElementById('github-token').value = GITHUB_CONFIG.token || '';
    document.getElementById('github-owner').value = GITHUB_CONFIG.owner || 'seabhra';
    document.getElementById('github-repo').value = GITHUB_CONFIG.repo || 'radar-speed-alert-api';
    document.getElementById('github-path').value = GITHUB_CONFIG.path || 'radares.json';
    document.getElementById('github-app-path').value = GITHUB_CONFIG.appPath || 'radares_app.json';
    document.getElementById('github-proxy').value = GITHUB_CONFIG.proxyUrl || '';
    modal.classList.add('active');
    
    document.getElementById('modal-config-close').onclick = function () { modal.classList.remove('active'); };
    document.getElementById('btn-save-github-config').onclick = async function () {
        var statusMsg = document.getElementById('config-status-msg');
        var config = {
            token: document.getElementById('github-token').value.trim(),
            owner: document.getElementById('github-owner').value.trim() || 'seabhra',
            repo: document.getElementById('github-repo').value.trim() || 'radar-speed-alert-api',
            path: document.getElementById('github-path').value.trim() || 'radares.json',
            appPath: document.getElementById('github-app-path').value.trim() || 'radares_app.json',
            proxyUrl: document.getElementById('github-proxy').value.trim()
        };
        if (!config.token) { statusMsg.textContent = '❌ Token é obrigatório!'; statusMsg.className = 'config-status erro'; return; }
        salvarConfigGitHub(config);
        statusMsg.textContent = '🔄 Validando credenciais...'; statusMsg.className = 'config-status aviso';
        try {
            const branch = await obterBranchPadrao();
            statusMsg.textContent = `✅ Conectado! (branch: ${branch})`; statusMsg.className = 'config-status ok';
            setTimeout(function () { modal.classList.remove('active'); carregarRadares(); }, 1500);
        } catch (validationError) {
            statusMsg.textContent = '❌ Falha: ' + validationError.message; statusMsg.className = 'config-status erro';
        }
    };
    modal.onclick = function (e) { if (e.target === modal) modal.classList.remove('active'); };
}

function inicializarBotaoRotacaoMapa() {
    const rotateBtn = document.getElementById('btn-rotate-map');
    const rotateBtnIcon = document.getElementById('rotate-btn-icon');
    if (!rotateBtn) return;
    if (rotateBtnIcon) { rotateBtnIcon.src = "/imagens_app/ic_girado_map.png"; }
    if (map && typeof map.setBearing !== 'function') {
        rotateBtn.style.opacity = '0.3'; rotateBtn.style.pointerEvents = 'none'; return;
    }
    rotateBtn.addEventListener('click', async function () {
        if (!map || typeof map.setBearing !== 'function') return;
        if (!bussolaHardwareDisponivel) await solicitarPermissaoBussolaIOS();
        if (!mapaRotacionado) {
            mapaRotacionado = true;
            var anguloRotacao = (currentHeading > 0 && currentHeading < 360) ? currentHeading : 0;
            bearingAlvo = anguloRotacao; bearingAtual = anguloRotacao;
            map.setBearing(anguloRotacao); rotateBtn.classList.add('rotated');
            if (rotateBtnIcon) { rotateBtnIcon.src = "/imagens_app/ic_girar_map.png"; rotateBtnIcon.style.transform = 'rotate(' + anguloRotacao + 'deg)'; }
            showNotification('Mapa rotacionado');
        } else {
            mapaRotacionado = false; bearingAlvo = 0; bearingAtual = 0;
            map.setBearing(0); rotateBtn.classList.remove('rotated');
            if (rotateBtnIcon) { rotateBtnIcon.src = "/imagens_app/ic_girado_map.png"; rotateBtnIcon.style.transform = 'rotate(0deg)'; }
            showNotification('Mapa resetado (Norte para cima)');
        }
    });
}

function inicializarBotaoAddRadar() {
    const btnAddRadar = document.getElementById('btn-add-radar');
    const modalAddRadar = document.getElementById('modal-add-radar');
    if (!btnAddRadar || !modalAddRadar) return;
    
    btnAddRadar.addEventListener('click', async function () {
        modalAddRadar.classList.add('active'); ocultarBussola(true);
        // Lógica simplificada de reset do modal
        document.getElementById('radar-type').value = '';
        document.getElementById('radar-address').value = '';
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('selected'));
        if (document.getElementById('icon-preview-group')) document.getElementById('icon-preview-group').style.display = 'none';
    });
    
    const btnModalClose = document.getElementById('modal-close');
    if (btnModalClose) btnModalClose.addEventListener('click', function () { modalAddRadar.classList.remove('active'); ocultarBussola(false); });
    modalAddRadar.addEventListener('click', function (e) { if (e.target === modalAddRadar) { modalAddRadar.classList.remove('active'); ocultarBussola(false); } });
}

async function initMap() {
    console.log('[Radar X9] 🚀 Inicializando aplicação...');
    const mapElement = document.getElementById('map');
    if (!mapElement) { console.error('[Radar X9] ❌ ERRO: Elemento #map NÃO EXISTE!'); hideFullscreenLoading(); return; }
    if (typeof L === 'undefined') { console.error('[Radar X9] ❌ ERRO: Leaflet não carregou!'); hideFullscreenLoading(); return; }
    
    map = L.map('map', { center: [userLat, userLng], zoom: 18, zoomControl: false, rotate: true, bearing: 0 });
    console.log('[Radar X9] ✅ Mapa criado com sucesso');
    
    executarSeguro('tema do mapa', aplicarTemaMapa);
    setInterval(function () { executarSeguro('tema do mapa', aplicarTemaMapa); }, 300000);
    executarSeguro('recentralizar', inicializarRecentralizacao);
    executarSeguro('botões do mapa', inicializarBotoesMapa);
    executarSeguro('botão de rotação', inicializarBotaoRotacaoMapa);
    executarSeguro('botão de som', inicializarBotaoAlertaToggle);
    executarSeguro('botão adicionar radar', inicializarBotaoAddRadar);
    
    // CORREÇÃO: Chamar as funções de menu corrigidas
    executarSeguro('menu lateral', inicializarMenuToggle);
    executarSeguro('sidebar direita', inicializarSidebarToggle);
    
    executarSeguro('GPS', function () { obterPosicaoInicialRapida(); startGPSTracking(); });
    
    await carregarConfigGitHub();
    await carregarRadares();
    console.log('[Radar X9] ✅ Aplicação inicializada com sucesso!');
}

function mostrarInfoNavegacao(distancia, tempo) {
    var painel = document.getElementById('nav-info');
    if (!painel) return;
    document.getElementById('nav-distance').textContent = '🚗 ' + String(distancia).replace('.', ',') + ' km';
    document.getElementById('nav-time').textContent = tempo + ' min';
    atualizarHorarioChegada(tempo);
    painel.classList.add('visible');
}

function extrairCoordenadasRobustas(record) {
    const camposParaVerificar = [record[8], record[9], record.lat, record.latitude, record.latlng];
    for (let campo of camposParaVerificar) {
        if (!campo) continue;
        const str = String(campo).trim();
        const match = str.match(/(-?\s*\d+\.\d+)\s*,\s*(-?\s*\d+\.\d+)/);
        if (match) {
            const lat = parseFloat(match[1].replace(/\s+/g, '').replace(/--/g, '-'));
            const lng = parseFloat(match[2].replace(/\s+/g, '').replace(/--/g, '-'));
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat: lat, lng: lng, sucesso: true };
        }
    }
    return { sucesso: false, erro: 'Coordenadas ilegíveis' };
}

function renderizarRadaresNoMapa(records) {
    if (!map || !records || records.length === 0) { $("#loading").hide(); return; }
    var contador = 0, contadorErros = 0;
    for (var i = 0; i < records.length; i++) {
        var record = records[i];
        var coords = extrairCoordenadasRobustas(record);
        if (!coords.sucesso) { contadorErros++; continue; }
        if (coords.lat < -34.5 || coords.lat > 6 || coords.lng < -74.5 || coords.lng > -34) { contadorErros++; continue; }
        
        var endereco = record[2] || record.endereco || "Endereço não informado";
        var tipo = String(record[3] || record.tipo || "Não Identificado").trim();
        var velocidade = record[4] || record.velocidade || "0";
        var iconeUrl = getIconUrl(tipo, velocidade);
        var radarMarker = L.marker([coords.lat, coords.lng], { icon: criarIconeRadar(iconeUrl, 40, '/imagens_app/ic_radar_cev_v2.png') }).addTo(map);
        var tipoExibicao = ajusteNomes[tipo] ? ajusteNomes[tipo] : tipo;
        var seloUsuario = record._isUsuario ? '<div style="color:#ff9800; font-size:0.85rem; margin-top:6px; font-weight:bold;">👤 Usuário</div>' : '<div style="color:#4caf50; font-size:0.85rem; margin-top:6px; font-weight:bold;">✅ Oficial</div>';
        
        radarMarker.bindPopup('<div style="color:#222; font-family:\'Inter\'; text-align:center; min-width:200px;"><b>' + tipoExibicao + '</b><br><hr style="border:0; border-top:1px solid #ddd; margin:8px 0;"><div style="font-size:0.9rem; color:#555;">' + endereco + '</div><div style="color:#d32f2f; font-weight:bold; margin-top:8px;">⚠️ Máx: ' + velocidade + ' km/h</div>' + seloUsuario + '</div>');
        radarMarker.radarData = { id: record[0] || record.id || i, latitude: coords.lat, longitude: coords.lng, endereco: endereco, velocidade_maxima: velocidade, tipoOriginal: tipo, tipoExibicao: tipoExibicao, isUsuario: !!record._isUsuario };
        radarMarkers.push(radarMarker); contador++;
    }
    $("#loading").hide();
    if (contadorErros > 0) showNotification(`⚠️ ${contadorErros} alertas sem coordenadas válidas`);
    else showNotification(`✅ Mapa atualizado: ${contador} radares`);
}

async function buscarArquivoRadares(urls) {
    for (var i = 0; i < urls.length; i++) {
        try {
            var r = await fetchComTimeout(urls[i] + '?v=' + Date.now(), { cache: 'no-store' }, 10000);
            if (r.ok) return { ok: true, data: await r.json() };
        } catch (e) {}
    }
    return { ok: false };
}

async function carregarRadares() {
    if (!map) return;
    radarMarkers.forEach(function (marker) { map.removeLayer(marker); });
    radarMarkers = [];
    $("#loading").show().html("<div class='loading-spinner'></div><div>Carregando alertas...</div>");
    try {
        const resultados = await Promise.all([buscarArquivoRadares([GITHUB_CONFIG.cdnUrl, GITHUB_CONFIG.rawUrl]), buscarArquivoRadares([GITHUB_CONFIG.cdnUrlApp, GITHUB_CONFIG.rawUrlApp])]);
        let radaresCurados = resultados[0].ok ? (resultados[0].data.records || []).map(r => ({ ...r, _isUsuario: false })) : [];
        let radaresApp = resultados[1].ok ? (resultados[1].data.records || []).map(r => ({ ...r, _isUsuario: true })) : [];
        const todosOsRadares = radaresCurados.concat(radaresApp);
        if (todosOsRadares.length > 0) { renderizarRadaresNoMapa(todosOsRadares); RADAR_MODO_OFFLINE = false; } 
        else { showNotification('⚠️ Nenhum radar encontrado'); RADAR_MODO_OFFLINE = true; }
    } catch (err) { console.error('[Radar X9] ❌ Erro:', err); showNotification('⚠️ Erro de conexão'); } 
    finally { $("#loading").hide(); }
}

function buscarRadares(query) {
    if (!query || query.length < 2) return;
    var encontrou = false, boundsGroup = L.featureGroup(), q = query.toLowerCase();
    radarMarkers.forEach(function (marker) {
        var d = marker.radarData;
        if (d && (d.endereco + ' ' + d.tipoOriginal + ' ' + d.tipoExibicao).toLowerCase().includes(q)) {
            encontrou = true; boundsGroup.addLayer(marker); marker.openPopup();
        }
    });
    if (encontrou) { if (map) map.fitBounds(boundsGroup.getBounds().pad(0.2)); isFollowing = false; }
    else showNotification("Nenhum radar encontrado para: " + query);
}

function inicializarBussolaHardware() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') return;
    if (typeof DeviceOrientationEvent !== 'undefined') {
        window.addEventListener('deviceorientation', function (event) {
            if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) { currentHeading = event.webkitCompassHeading; bussolaHardwareDisponivel = true; }
            else if (event.alpha !== null && event.absolute === true) { currentHeading = event.alpha; bussolaHardwareDisponivel = true; }
        }, true);
    }
}

async function solicitarPermissaoBussolaIOS() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            var resposta = await DeviceOrientationEvent.requestPermission();
            if (resposta === 'granted') {
                window.addEventListener('deviceorientation', function (event) {
                    if (event.webkitCompassHeading !== undefined) { currentHeading = event.webkitCompassHeading; bussolaHardwareDisponivel = true; }
                }, true);
                return true;
            }
        } catch (erro) { return false; }
    }
    return false;
}

function iniciarApp() {
    executarSeguro('textos', ajustarTextosClima);
    executarSeguro('header', ajustarHeaderResponsivo);
    initMap().catch(function (err) { console.error('[Radar X9] ❌ Falha ao iniciar:', err); hideFullscreenLoading(); });
    setTimeout(function () {
        const l = document.getElementById('loading-fullscreen');
        if (l) { l.classList.add('fade-out'); setTimeout(function () { if (l) l.style.display = 'none'; }, 600); }
    }, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarApp);
else iniciarApp();

window.addEventListener('resize', function () { ajustarTextosClima(); ajustarHeaderResponsivo(); });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function (err) { console.error('Falha no SW:', err); });
    });
}

// EXPORTAÇÃO PARA window
(function exportarParaWindow() {
    var funcoes = { ajustarTextosClima, carregarConfigGitHub, salvarConfigGitHub, obterBranchPadrao, atualizarStatusGPS, criarIconeNavegador, ativarPulsoIntenso, desativarPulsoIntenso, formatarNomeExibicao, criarIconeRadar, getIconUrl, showNotification, hideFullscreenLoading, calcularDistancia, suavizarBearing, aplicarTemaMapa, ajustarPosicaoSpeedWidget, ajustarBussolaParaBusca, ocultarBussola, atualizarHorarioChegada, adicionarMarcadoresRota, atualizarRota, verificarChegadaDestino, finalizarNavegacao, removerRota, criarRota, calcularBearing, buscarCoordenadas, resetarMapa, atualizarBussola, processarNovaPosicao, startGPSTracking, stopGPSTracking, restartGPSTracking, ajustarHeaderResponsivo, classificarAlerta, dispararAlerta, esconderAlertaVisual, verificarProximidadeRadares, tocarSomAlerta, pararTodosSons, animarBotaoRadar, criarRadarNoMapa, recentralizarMapa, fecharTodasBarras, initMap, mostrarInfoNavegacao, openAddRadarModal, capturarPosicaoRadar, obterEndereco: async () => null, atualizarStatusGitHub, abrirModalConfigGithub, salvarRadarNoGitHub: async () => ({}), incluirRadar: async () => {}, sincronizarRadaresPendentes: async () => {}, carregarRadaresPendentes: () => {}, fetchComTimeout, carregarRadares, buscarRadares, solicitarPermissaoBussolaIOS };
    Object.keys(funcoes).forEach(function (nome) { try { window[nome] = funcoes[nome]; } catch (e) {} });
    
    function expor(nome, getter, setter) { try { Object.defineProperty(window, nome, { configurable: true, get: getter, set: setter || function () {} }); } catch (e) {} }
    expor('map', function () { return map; });
    expor('userMarker', function () { return userMarker; });
    expor('startRouteMarker', function () { return startRouteMarker; });
    expor('radarMarkers', function () { return radarMarkers; });
    expor('estaEmNavegacao', function () { return estaEmNavegacao; });
    expor('velocidadeAtual', function () { return velocidadeAtual; });
    expor('currentHeading', function () { return currentHeading; });
    expor('GITHUB_CONFIG', function () { return GITHUB_CONFIG; });
    expor('gpsInitialized', function () { return gpsInitialized; }, function (v) { gpsInitialized = !!v; });
    expor('isFollowing', function () { return isFollowing; }, function (v) { isFollowing = !!v; });
    expor('somAlertaHabilitado', function () { return somAlertaHabilitado; }, function (v) { somAlertaHabilitado = !!v; });
})();
})();
