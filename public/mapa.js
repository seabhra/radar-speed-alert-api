// ==================
// ARQUIVO JS MAPA.JS
// ==================

// VARIÁVEIS GLOBAIS
let map;
let tileLayer;
let radarMarkers = [];
let alertTimeout;

// ⚠️ CORREÇÃO: Removido o 'let' pois essas variáveis JÁ SÃO DECLARADAS no app.js
userLat = -19.919055;
userLng = -43.938641;

// CONTROLE DE BARRAS LATERAIS
let searchActive = false;    // Controla se a barra de RADARES está ativa
let routeActive = false;     // Controla se a barra de ROTA está ativa

// CONTROLE DE GPS - SEPARADO DAS BARRAS
let gpsActive = true;        // Controla o funcionamento do GPS (INDEPENDENTE)

// MENU LATERAL FECHADO COM CONTROLES
let sidebarAberta = false;

var watchId = null;
var gpsInitialized = false;  // GPS INICIALIZADO
var browserGpsTimeout = null; // TIMEOUT GPS BROWSER

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

var destinoNavegacao = null;

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

// Precisão do GPS para o status
let gpsAccuracyAtual = 999;
let gpsLastUpdateTime = 0;

// No início do script, junto com as outras variáveis globais
let iconeCentralizado = false; // Controla se o ícone está no modo centralizado

// ⚠️ CORREÇÃO: Removido o 'let' pois JÁ É DECLARADA no app.js
alertaNormalidadeMostrado = false;

//================================================
// 1. Declare APENAS UMA VEZ no topo do arquivo 
//=================================================
let userMarker = null;

// =============================================
// CONTROLE DE TEXTOS - SITE vs APP
// =============================================
function ajustarTextosClima() {
    const isMobile = window.innerWidth <= 600;
    const cidadeLabel = document.getElementById('cidade-atual');
    
    if (cidadeLabel) {
        cidadeLabel.classList.remove('modo-site', 'modo-app');
        if (isMobile) {
            cidadeLabel.classList.add('modo-app');
        } else {
            cidadeLabel.classList.add('modo-site');
        }
    }
}

// Executa no carregamento e no redimensionamento
document.addEventListener('DOMContentLoaded', ajustarTextosClima);
window.addEventListener('resize', ajustarTextosClima);

// ======================
// CONFIGURAÇÃO DO GITHUB
// ======================

let GITHUB_CONFIG = {
    owner: 'seabhra',
    repo: 'radar-speed-alert-api',
    path: 'radares.json',  // Arquivo curado/manual (somente leitura)
    token: '',
    proxyUrl: '',
    _branchCache: null,
    appPath: 'radares_app.json',
    get cdnUrl() {
        return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@main/${this.path}`;
    },
    get rawUrl() {
        return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/main/${this.path}`;
    },

     //==================================================================== 
    // [ADICIONADO] URLs equivalentes para o arquivo de radares dos usuários
    //======================================================================
    get cdnUrlApp() {
        return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@main/${this.appPath}`;
    },
    get rawUrlApp() {
        return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/main/${this.appPath}`;
    }
};


// Flag para controle de modo offline
let RADAR_MODO_OFFLINE = false;
let RADAR_PENDENTES_SINCRONIZAR = [];
// Radares inseridos nesta sessão que precisam ser preservados no mapa
// até o CDN da jsdelivr/raw.githubusercontent propagar o commit novo
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
            console.log('[Radar X9] ✅ Configuração carregada do backend.');
            return true;
        }
    } catch (err) {
        console.warn('[Radar X9] Backend não disponível.');
    }

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
            console.log('[Radar X9] ✅ Configuração carregada do localStorage.');
            return true;
        }
    } catch (err) {
        console.warn('[Radar X9] localStorage não disponível.');
    }

    console.log('[Radar X9] ⚠️ Usando valores padrão. Configure o GitHub no menu.');
    return false;
}

function salvarConfigGitHub(config) {
    try {
        localStorage.setItem('radarx9_github_config', JSON.stringify(config));
        GITHUB_CONFIG._branchCache = null;
        Object.assign(GITHUB_CONFIG, config);
        console.log('[Radar X9] ✅ Configuração salva.');
        return true;
    } catch (err) {
        console.error('[Radar X9] Erro ao salvar config:', err);
        return false;
    }
}

// ===================================================================
// [CORREÇÃO] Descobrir o branch padrão real do repositório
// ===================================================================
async function obterBranchPadrao() {
    if (GITHUB_CONFIG._branchCache) return GITHUB_CONFIG._branchCache;
    if (!GITHUB_CONFIG.token) {
        throw new Error('Token do GitHub não configurado.');
    }
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`, {
        method: 'GET',
        headers: {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    if (!resp.ok) {
        const detalhe = await resp.text().catch(function () { return ''; });
        throw new Error(`Não foi possível ler o repositório (${resp.status}): ${detalhe.slice(0, 200)}`);
    }
    const info = await resp.json();
    GITHUB_CONFIG._branchCache = info.default_branch || 'main';
    console.log('[Radar X9] 🔎 Branch padrão detectado:', GITHUB_CONFIG._branchCache);
    return GITHUB_CONFIG._branchCache;
}


// ===================================================================
// CONFIGURAÇÃO DE ALERTAS
// ===================================================================
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
let ultimaAtualizacaoRotacao = 0;

var posicaoSuavizada = { lat: null, lng: null };
var historicoPosicoes = [];
var historicoDistanciasRadar = {};
var ultimaPosicaoMarcador = { lat: null, lng: null };
var animacaoMarcadorAtiva = false;
var tipoAlertaAtivo = null;

// ===================================================================
// GPS STATUS INDICATOR - CORRIGIDO
// ===================================================================
function atualizarStatusGPS(position) {
    const dot = document.getElementById('gps-status-dot');
    const wrapper = document.getElementById('gps-status-wrapper');
    const label = document.getElementById('gps-status-label');
    if (!dot || !wrapper || !label) return;
    
   // Segurança: se os elementos não existirem ainda, sai da função
    if (!dot || !wrapper || !label) return;
    
    // Se não tem posição, mostra vermelho
    if (!position || !position.coords) {
        dot.className = 'gps-status-dot err';
        wrapper.className = 'gps-status-wrapper gps-err';
        label.textContent = 'SEM GPS';
        wrapper.title = 'GPS: Sem sinal ou bloqueado';
        return;
    }
    
    const acc = position.coords.accuracy || 999;

    // 🔍 ADICIONE ESTES LOGS:
    console.log('📊 DEBUG GPS:');
    console.log('  - Precisão (accuracy):', acc, 'metros');
    console.log('  - Latitude:', position.coords.latitude);
    console.log('  - Longitude:', position.coords.longitude);
    console.log('  - Classe aplicada:', acc <= 100 ? 'OK' : acc <= 300 ? 'WARN' : 'ERR');
    
 // ---> ADICIONE ESTA LINHA PARA DEBUGAR <---
    console.log("📡 PRECISÃO DO GPS RECEBIDA:", acc, "metros | Lat:", position.coords.latitude); 
    
    gpsAccuracyAtual = acc;
    gpsLastUpdateTime = Date.now(); // Atualiza o timestamp do último sucesso

 // 🔧 LIMITES AJUSTADOS PARA NAVEGADOR/WEBVIEW
    if (acc <= 150) {
        // 🟢 VERDE: Alta precisão (GPS de hardware ou Wi-Fi muito bom)
        dot.className = 'gps-status-dot ok';
        wrapper.className = 'gps-status-wrapper gps-ok';
        label.textContent = 'GPS OK';
        wrapper.title = 'GPS: Alta precisão (' + Math.round(acc) + 'm)';
    } else if (acc <= 500) {
        // 🟡 AMARELO: Precisão média (Normal para navegadores em áreas urbanas)
        dot.className = 'gps-status-dot warn';
        wrapper.className = 'gps-status-wrapper gps-warn';
        label.textContent = 'GPS IRREGULAR'; 
        wrapper.title = 'GPS: Precisão média (' + Math.round(acc) + 'm)';
    } else {
        // 🔴 VERMELHO: Precisão muito baixa ou erro real
        dot.className = 'gps-status-dot err';
        wrapper.className = 'gps-status-wrapper gps-err';
        label.textContent = 'GPS FRACO';
        wrapper.title = 'GPS: Baixa precisão (' + Math.round(acc) + 'm)';
    }
}

// ===================================================================
// MONITOR DE TIMEOUT (Cai para vermelho se o GPS parar de responder)
// ===================================================================
setInterval(function() {
    // Se passou mais de 15 segundos sem atualizar a posição, força o vermelho
    if (gpsLastUpdateTime > 0 && (Date.now() - gpsLastUpdateTime) > 15000) {
        atualizarStatusGPS(null);
    }
}, 5000); // Verifica a cada 5 segundos

// ===================================================================
// CRIAR ICONE NAVEGADOR PULSANTE
// ===================================================================

function criarIconeNavegador(pulsarIntenso) {
    var haloClass = 'nav-pulse-halo' + (pulsarIntenso ? ' intenso' : '');
    var htmlStr = 
        '<div class="nav-pulse-wrap">' +
            '<div class="' + haloClass + '"></div>' +
            '<img src="/imagens_app/ic_navigator_map.png"' +
                 ' onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'"' +
                 ' style="width:70px;height:70px;">' +
        '</div>';
    
    return L.divIcon({
        html: htmlStr,
        className: 'user-gps-marker',
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -50]
    });
}

function ativarPulsoIntenso() {
    var halo = document.querySelector('.nav-pulse-halo');
    if (halo) halo.classList.add('intenso');
}

function desativarPulsoIntenso() {
    var halo = document.querySelector('.nav-pulse-halo');
    if (halo) halo.classList.remove('intenso');
}

// ===================================================================
// MAPEAMENTO DE ÍCONES
// ===================================================================
const iconMap = {
    'Controlador Eletrônico de Velocidade':'/imagens_app/ic_radar_cev_v2.png',
    'Controlador Eletrônico de Velocidade (CEV)':'/imagens_app/ic_radar_cev_v2.png',

    // RADARES MISTOS
    'Controlador Eletrônico Misto (DAS) + (CEV)':'/imagens_app/ic_radar_cem_cev.png',
    'Controlador Eletrônico Misto (DAS) + (DCP)':'/imagens_app/ic_radar_cem_dcp.png',
    'Controlador Eletrônico Misto (DAS) + (DIF)':'/imagens_app/ic_radar_cem_move.png',
   
    // RADARES SINGULARES

    'Detector de Avanço de Semáforo (DAS)':'/imagens_app/ic_radar_das_v2.png',
    'Detector de Avanço de Semáforo':'/imagens_app/ic_radar_das_v2.png',
    'Detector de Tráfego em Local Proibido':'/imagens_app/ic_radar_dtlp_v2.png',
    'Detector de Tráfego em Local Proibido (DTLP)':'/imagens_app/ic_radar_dtlp_v2.png',
    'Detector de Conversão em Local Proibido':'/imagens_app/ic_radar_rcp_v2.png',
    'Detector de Conversão em Local Proibido (DCP)':'/imagens_app/ic_radar_rcp_v2.png',
    'Detector de Invasão de Faixa Exclusiva - MOVE':'/imagens_app/ic_radar_dife_v2.png',
    'Detector de Invasão de Faixa Exclusiva (DIFEX)':'/imagens_app/ic_radar_difex_v2.png',
    'Detector de Invasão de Faixa Exclusiva':'/imagens_app/ic_radar_difex_v2.png',
    'Detector de Parada sobre Faixa de Pedestres (DPFP)':'/imagens_app/ic_radar_dpfp_v2.png',
    'Detector de Parada sobre Faixa de Pedestres':'/imagens_app/ic_radar_dpfp_v2.png',
    'Detector de Faixa Preferencial de Ônibus (BUS)':'/imagens_app/ic_radar_fpref_v2.png',
    'Detector de Faixa Preferencial de Ônibus':'/imagens_app/ic_radar_fpref_v2.png',
    'Zona Verde de Trânsito (ZVT)':'/imagens_app/ic_zona_verde.png',
    'Zona Verde de Trânsito (ZVC)':'/imagens_app/ic_zona_verde.png',
    'Zona Verde de Trânsito':'/imagens_app/ic_zona_verde.png',
    'Zona de Risco de Inundações Recorrentes (ZIR)':'/imagens_app/ic_zona_inunda.png',
    'Zona de Risco de Inundações Recorrentes':'/imagens_app/ic_zona_inunda.png',
    'Detector de Uso de Celular': '/imagens_app/ic_radar_duc_v2.png',
    'Detector de Uso de Celular (DUC)': '/imagens_app/ic_radar_duc_v2.png',
    'Controle de Redução de Velocidade (CRV)':'/imagens_app/ic_radar_rev_v2.png',
    'Controle de Redução de Velocidade':'/imagens_app/ic_radar_rev_v2.png',
    'Verificador de Cinto de Segurança (VCS)':'/imagens_app/ic_radar_cinto_v2.png',
    'Verificador de Cinto de Segurança':'/imagens_app/ic_radar_cinto_v2.png',
    'Leitor Inteligente de Placas (OCR-P)':'/imagens_app/ic_radar_ocr_v2.png',
    'Leitor Inteligente de Placas':'/imagens_app/ic_radar_ocr_v2.png',
    'Leitor de Reconhecimento Facial (OCR-F)':'/imagens_app/ic_radar_facial_v2.png',
    'Leitor de Reconhecimento Facial':'/imagens_app/ic_radar_facial_v2.png',
    'Câmera Olho Vivo (COV)': '/imagens_app/ic_olho_v2.png',
    'Câmera Olho Vivo': '/imagens_app/ic_olho_v2.png',
    'Zona de Perigo e Violência (ZPV)':'/imagens_app/ic_radar_perigo_v2.png',
    'Zona de Perigo e Violência':'/imagens_app/ic_radar_perigo_v2.png',
    'Alerta de Alto Índice de Acidente (AIA)':'/imagens_app/ic_radar_acidente_v2.png',
    'Alerta de Alto Índice  de Acidente (AIA)':'/imagens_app/ic_radar_acidente_v2.png',
    'Alerta de Alto Índice de Acidente':'/imagens_app/ic_radar_acidente_v2.png',
    'Alerta de Caminhão na Faixa Esquerda (CFE)':'/imagens_app/ic_radar_truck_v2.png',
    'Zona de Estudo Nuclear (ZEN)':'/imagens_app/ic_radar_nuclear_v2.png',
    'Área de Escape Caminhões (ARE)':'/imagens_app/ic_area_escape.png',
    'Apenas Trânsito Local (ATL)':'/imagens_app/ic_local_traffic_v2.png',
    'Radar Inteligente de Velocidade Média (RIV)':'/imagens_app/ic_cam_video_v2.png',
    'Radar Inteligente de Velocidade Média':'/imagens_app/ic_cam_video_v2.png',
    'Passagem Sob Túnel Viário (TUV)':'/imagens_app/ic_tunel_v2.png',
    'Passagem Sob Túnel Viário':'/imagens_app/ic_tunel_v2.png',
    'Alerta de Poluição Elevada (APE)':'/imagens_app/ic_radar_poluido_v2.png',
    'Semáforo Inteligente (SEI)': '/imagens_app/ic_semaforo_inteligente.png', 



     //=== ALERTA DESCUBRA A CIDADE (ALE) ===
    // As chaves continuam completas para garantir que o getIconUrl funcione
    'Descubra a Cidade - Mercado Central - Arte e Gastronomia': '/imagens_app/ic_mercado_central.png',
    'Descubra a Cidade - Mirante do Mangabeiras - Panorama': '/imagens_app/ic_mirante_mangabeiras.png',
    'Descubra a Cidade - Parque Mangabeiras - Natureza': '/imagens_app/ic_parque_mangabeiras.png',
    'Descubra a Cidade - Mercado Novo - Arte e Gastronomia': '/imagens_app/ic_mercado_novo.png',
    'Descubra a Cidade - Santa Tereza - Circuito Boêmio': '/imagens_app/ic_santa_tereza.png',
    'Descubra a Cidade - Rua Sapucaí - Panorama e Gastronomia': '/imagens_app/ic_rua_sapucai.png',
    'Descubra a Cidade - Praça da Liberdade - Arte e Cultura': '/imagens_app/ic_praca_liberdade.png',
    'Descubra a Cidade - Edifício Maletta - Arte e Gastronomia': '/imagens_app/ic_edificio_maletta.png',
    'Descubra a Cidade - Praça do Papa - Panorama': '/imagens_app/ic_praca_papa.png',
    'Descubra a Cidade - Museu do Futebol - Arte e Cultura': '/imagens_app/ic_museu_futebol.png',
    'Descubra a Cidade - Igreja da Pampulha - Arte e Cultura': '/imagens_app/ic_igreja_pampulha.png',
    'Descubra a Cidade - Parque Ecológico da Pampulha - Ecoturismo': '/imagens_app/ic_parque_ecologico_pampulha.png',
    'Descubra a Cidade - Parque de Diversões Guanabara - Diversão e Lazer': '/imagens_app/ic_parque_guanabara.png',
    'Descubra a Cidade - Parque da Serra do Curral - Ecoturismo': '/imagens_app/ic_parque_serra_curral.png',
    'Descubra a Cidade - Feira de Artesanato da Afonso Pena - Compra (Aos domingos)': '/imagens_app/ic_feira_afonso_pena.png',
    'Descubra a Cidade - Palácio das Artes - Arte e Cultura': '/imagens_app/ic_palacio_artes.png',
    'Descubra a Cidade - Parque Municipal - Parque e Diversão': '/imagens_app/ic_parque_municipal.png',
    'Descubra a Cidade - Praça da Savassi - Gastronomia': '/imagens_app/ic_praca_savassi.png',
    'Descubra a Cidade - Museu de Artes e Ofícios - História': '/imagens_app/ic_museu_artes_oficios.png',
    'Descubra a Cidade - Museu Abílio Barreto - História': '/imagens_app/ic_museu_abilio_barreto.png',
    'Descubra a Cidade - Polo de Artesanato de Nações Unidas - Arte Mineira': '/imagens_app/ic_polo_artesanato.png',
    
    
     //=== ALERTA DE SERVIÇO ===
    'Rede de Serviços - Recarga Carro Elétrico (REC)': '/imagens_app/ic_recarga.png',
    'Rede de Serviços - WC Público Autolimpante (AUT)': '/imagens_app/ic_autolimpante.png',
    'Rede de Serviços - WC Público Comum (COM)': '/imagens_app/ic_banheiro.png',
    'Rede de Serviços - Ponto Abrigo Amigo (PAA)': '/imagens_app/ic_amigo.png',
    'default': '/imagens_app/ic_radar_cev_v2.png'
};

const TIPOS_ALERTA_RADAR = [
    'Detector de Parada sobre Faixa de Pedestres (DPFP)',
    'Detector de Conversão em Local Proibido (DCP)',
    'Detector de Redução de Velocidade (REV)',
    'Verificador de Cinto de Segurança (VCS)',
    'Detector de Uso de Celular (DUC)',
    
     //=== ALERTA DE RADARES MISTOS ===

    'Controlador Eletrônico Misto (DAS) + (CEV)',
    'Controlador Eletrônico Misto (DAS) + (DCP)',
    'Controlador Eletrônico Misto (DAS) + (DIF)',

    'Controlador Eletrônico de Velocidade (CEV)',
    'Detector de Avanço de Semáforo (DAS)',
    'Detector de Tráfego em Local Proibido (DTLP)',
    'Detector de Invasão de Faixa Exclusiva (MOVE)',
    'Detector de Invasão de Faixa Exclusiva (DIFEX)',
    'Controle Inteligente de Velocidade (CIV)'
    
];

const TIPOS_ALERTA_RISCO = [
    'Zona de Perigo e Violência (ZPV)',
    'Zona de Perigo e Violência',
    'Alerta de Alto Índice de Acidente (AIA)',
    'Alerta de Alto Índice de Acidente',
    'Zona de Risco de Inundações Recorrentes (ZIR)',
    'Área de Escape Caminhões (ARE)',
    'Alerta de Poluição Elevada (APE)',
    'Zona de Estudo Nuclear (ZEN)'
];

const TIPOS_ALERTA_MOBILIDADE = [
    'Detector de Faixa Preferencial de Ônibus (BUS)',
    'Detector de Faixa Preferencial de Ônibus',
    'Alerta de Caminhão na Faixa Esquerda (CFE)',
    'Apenas Trânsito Local (ATL)',
    'Faixa Preferencial de Ônibus (BUS)',
    'Faixa Preferencial de Ônibus',
    'Leitor de Reconhecimento Facial (OCR-F)',
    'Leitor de Reconhecimento Facial',
    'Leitor Inteligente de Placas (OCR-P)',
    'Leitor Inteligente de Placas',
    'Zona Verde de Trânsito (ZVT)',
    'Zona Verde de Trânsito (ZVC)',
    'Zona Verde de Trânsito',
    'Câmera Olho Vivo (COV)',
    'Câmera Olho Vivo',
    'Semáforo Inteligente (SEI)',
    'Passagem Sob Túnel Viário (TUV)',
    'Passagem Sob Túnel Viário'
];

const TIPOS_ALERTA_DESTAQUE = [
    'Mercado Central - Arte e Gastronomia', 
    'Mercado Novo - Arte e Gastronomia', 
    'Mirante do Mangabeiras - Panorama',
    'Parque Mangabeiras - Natureza',
    'Santa Tereza - Circuito Boêmio',
    'Rua Sapucaí - Panorama e Gastronomia',
    'Praça da Liberdade - Arte e Cultura', 
    'Edifício Maletta - Arte e Gastronomia', 
    'Praça do Papa - Panorama',
    'Museu do Futebol - Arte e Cultura',
    'Igreja da Pampulha - Arte e Cultura',
    'Parque Ecológico da Pampulha - Ecoturismo',
    'Parque da Serra do Curral - Ecoturismo',
    'Feira de Artesanato da Afonso Pena - Compra (Aos domingos)', 
    'Palácio das Artes - Arte e Cultura',
    'Parque Municipal - Parque e Diversão',
    'Praça da Savassi - Gastronomia',
    'Museu de Artes e Ofícios - História',
    'Museu Abílio Barreto - História',
    'Polo de Artesanato de Nações Unidas - Arte Mineira'
];


const TIPOS_ALERTA_SERVIÇO = [
    'Ponto Abrigo Amigo', 
    'WC Público Comum',
    'WC Público Autolimpante',
    'Recarga Carro Elétrico'
];


const TIPOS_SEM_ALERTA = [];

const ajusteNomes = {
  

//=== ALERTA DE RADARES MISTOS ===
    'Controlador Eletrônico Misto (DAS + CEV)': 'Radar Misto Velocidade+Semáforo (CEM)',
    'Controlador Eletrônico Misto (DAS + DCP)': 'Radar Misto Semáforo+Conversão (CEM)',
    'Controlador Eletrônico Misto (DAS + DIF)': 'Radar Misto Semáforo+Faixa (CEM)',

    'Controlador Eletrônico Misto (CEM)': 'Radar Misto Velocidade+Semáforo (CEM)',
    'Controlador Eletrônico Misto': 'Radar Misto Velocidade+Semáforo (CEM)',

    //=== ALERTA DE RADARES SINGULARES ===

    'Controlador Eletrônico de Velocidade': 'Radar de Velocidade (CEV)',
    'Controlador Eletrônico de Velocidade (CEV)': 'Radar de Velocidade (CEV)',

    'Controle de Redução de Velocidade (CRV)': 'Painel de Redução de Velocidade (PRV)',
    'Controle de Redução de Velocidade': 'Painel de Redução de Velocidade (PRV)',
    'Detector de Parada sobre Faixa de Pedestres (DPFP)': 'Detector de Parada sobre Faixa de Pedestres (DPFP)',
    'Detector de Parada sobre Faixa de Pedestres': 'Detector de Parada sobre Faixa de Pedestres (DPFP)',
    'Detector de Avanço de Semáforo (DAS)': 'Radar de Avanço de Semáforo (DAS)',
    'Detector de Avanço de Semáforo': 'Radar de Avanço de Semáforo (DAS)',
    'Detector de Conversão em Local Proibido': 'Detector de Conversão em Local Proibido (DCP)',
    'Detector de Conversão em Local Proibido (DCP)': 'Detector de Conversão em Local Proibido (DCP)',
    'Detector de Tráfego em Local Proibido': 'Zona de Tráfego Proibido (ZTP)',
    'Detector de Tráfego em Local Proibido (DTLP)': 'Zona de Tráfego Proibido (ZTP)',
    'Detector de Invasão de Faixa Exclusiva (DIFEX)': 'Faixa Exclusiva de Ônibus e Táxis (FOT)',
    'Detector de Invasão de Faixa Exclusiva - MOVE': 'Faixa Exclusiva MOVE (FOT)',
    'Detector de Invasão de Faixa Exclusiva': 'Faixa Exclusiva de Ônibus e Táxis (FOT)',
    'Detector de Faixa Preferencial de Ônibus (BUS)': 'Faixa Preferencial de Ônibus (BUS)',
    'Detector de Faixa Preferencial de Ônibus': 'Faixa Preferencial de Ônibus (BUS)',
    'Zona Verde de Trânsito (ZVC)': 'Zona Verde de Trânsito (ZVT)',
    'Zona Verde de Trânsito': 'Zona Verde de Trânsito (ZVT)',
    'Zona de Risco de Inundações Recorrentes (ZIR)':'Zona de Risco - Inundações Recorrentes (ZIR)',
    'Zona de Risco de Inundações Recorrentes':'Zona de Risco - Inundações Recorrentes (ZIR)',
    'Detector de Uso de Celular': 'Radar de Uso de Celular (DUC)',
    'Detector de Uso de Celular (DUC)': 'Radar de Uso de Celular (DUC)',
    'Verificador de Cinto de Segurança (VCS)': 'Radar de Uso de Cinto de Segurança (RCS)',
    'Verificador de Cinto de Segurança': 'Radar de Uso de Cinto de Segurança (RCS)',
    'Leitor Inteligente de Placas': 'Leitor de Placas (OCR-P)',
    'Leitor Inteligente de Placas (OCR-P)': 'Leitor de Placas (OCR-P)',
    'Leitor de Reconhecimento Facial': 'Reconhecimento Facial (OCR-F)',
    'Apenas Trânsito Local (ATL)': 'Apenas Trânsito Local (ATL)',
    'Passagem Sob Túnel Viário (TUV)':'Passagem Sob Túnel Viário (TUV)',
    'Radar Inteligente de Velocidade Média (RIV)': 'Radar Inteligente de Velocidade Média (RIV)',
    'Radar Inteligente de Velocidade Média': 'Radar Inteligente de Velocidade Média (RIV)',
    'Leitor de Reconhecimento Facial (OCR-F)': 'Reconhecimento Facial (OCR-F)',
    'Alerta de Poluição Elevada (APE)': 'Área com Poluição Elevada (APE)'
};

// ===================================================================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO
// ===================================================================

/**
 * Remove o prefixo "Descubra a Cidade - " do nome para exibição na UI,
 * mantendo apenas o local e a descrição.
 */
function formatarNomeExibicao(nomeOriginal) {
    if (!nomeOriginal) return "";
    
    const prefixo = "Descubra a Cidade - ";
    
    // Se começar com o prefixo, remove-o
    if (nomeOriginal.startsWith(prefixo)) {
        return nomeOriginal.substring(prefixo.length);
    }
    
    // Retorna original se não tiver o prefixo
    return nomeOriginal;
}
// ===================================================================
// FUNÇÕES AUXILIARES
// ===================================================================
function criarIconeRadar(iconUrl, tamanho, fallbackUrl) {
    return L.icon({
        iconUrl: iconUrl,
        iconSize: [tamanho, tamanho],
        iconAnchor: [tamanho / 2, tamanho / 2],
        popupAnchor: [0, -tamanho / 2],
        className: 'radar-marker-icon',
        iconUrlFallback: fallbackUrl || '/imagens_app/ic_radar_cev_v2.png'
    });
}

function getIconUrl(tipo, velocidade) {
    const tipoLimpo = tipo ? tipo.trim() : "";
    if (!tipoLimpo) return iconMap['default'];


    // === Matching parcial para SERVIÇOS ===
    if (tipoLimpo.includes('Recarga') || tipoLimpo.includes('Elétrico') || tipoLimpo.includes('REC')) {
        return iconMap['Rede de Serviços - Recarga Carro Elétrico (REC)'];
    }
    if (tipoLimpo.includes('Autolimpante') || tipoLimpo.includes('AUT')) {
        return iconMap['Rede de Serviços - WC Público Autolimpante (AUT)'];
    }
    if (tipoLimpo.includes('WC Público Comum') || tipoLimpo.includes('COM')) {
        return iconMap['Rede de Serviços - WC Público Comum (COM)'];
    }
    if (tipoLimpo.includes('Abrigo Amigo') || tipoLimpo.includes('PAA')) {
        return iconMap['Rede de Serviços - Ponto Abrigo Amigo (PAA)'];
    }


    // === Matching parcial para DESCUBRA A CIDADE ===
    var discoverCitySubstrings = [
        { keys: ['Mercado Central'],        icon: iconMap['Descubra a Cidade - Mercado Central - Arte e Gastronomia'] },
        { keys: ['Mercado Novo'],           icon: iconMap['Descubra a Cidade - Mercado Novo - Arte e Gastronomia'] },
        { keys: ['Mirante do Mangabeiras'], icon: iconMap['Descubra a Cidade - Mirante do Mangabeiras - Panorama'] },
        { keys: ['Parque Mangabeiras'],     icon: iconMap['Descubra a Cidade - Parque Mangabeiras - Natureza'] },
        { keys: ['Santa Tereza'],           icon: iconMap['Descubra a Cidade - Santa Tereza - Circuito Boêmio'] },
        { keys: ['Rua Sapucaí'],            icon: iconMap['Descubra a Cidade - Rua Sapucaí - Panorama e Gastronomia'] },
        { keys: ['Praça da Liberdade'],     icon: iconMap['Descubra a Cidade - Praça da Liberdade - Arte e Cultura'] },
        { keys: ['Edifício Maletta'],       icon: iconMap['Descubra a Cidade - Edifício Maletta - Arte e Gastronomia'] },
        { keys: ['Praça do Papa'],          icon: iconMap['Descubra a Cidade - Praça do Papa - Panorama'] },
        { keys: ['Museu do Futebol'],       icon: iconMap['Descubra a Cidade - Museu do Futebol - Arte e Cultura'] },
        { keys: ['Igreja da Pampulha'],     icon: iconMap['Descubra a Cidade - Igreja da Pampulha - Arte e Cultura'] },
        { keys: ['Parque Ecológico da Pampulha'], icon: iconMap['Descubra a Cidade - Parque Ecológico da Pampulha - Ecoturismo'] },
        { keys: ['Parque de Diversões Guanabara'], icon: iconMap['Descubra a Cidade - Parque de Diversões Guanabara - Diversão e Lazer'] },
        { keys: ['Parque da Serra do Curral'], icon: iconMap['Descubra a Cidade - Parque da Serra do Curral - Ecoturismo'] },
        { keys: ['Feira de Artesanato da Afonso Pena'], icon: iconMap['Descubra a Cidade - Feira de Artesanato da Afonso Pena - Compra (Aos domingos)'] },
        { keys: ['Palácio das Artes'],      icon: iconMap['Descubra a Cidade - Palácio das Artes - Arte e Cultura'] },
        { keys: ['Parque Municipal'],       icon: iconMap['Descubra a Cidade - Parque Municipal - Parque e Diversão'] },
        { keys: ['Praça da Savassi'],       icon: iconMap['Descubra a Cidade - Praça da Savassi - Gastronomia'] },
        { keys: ['Museu de Artes e Ofícios'], icon: iconMap['Descubra a Cidade - Museu de Artes e Ofícios - História'] },
        { keys: ['Museu Abílio Barreto'],   icon: iconMap['Descubra a Cidade - Museu Abílio Barreto - História'] },
        { keys: ['Polo de Artesanato'],     icon: iconMap['Descubra a Cidade - Polo de Artesanato de Nações Unidas - Arte Mineira'] }
    ];
    for (var d = 0; d < discoverCitySubstrings.length; d++) {
        var entryD = discoverCitySubstrings[d];
        for (var kd = 0; kd < entryD.keys.length; kd++) {
            if (tipoLimpo.includes(entryD.keys[kd])) return entryD.icon;
        }
    }


      // === RADARES MISTOS — verificar PRIMEIRO, antes do genérico ===
    if (tipoLimpo.includes('Misto') && tipoLimpo.includes('CEV')) {
        return iconMap['Controlador Eletrônico Misto (DAS) + (CEV)'];
    }
    if (tipoLimpo.includes('Misto') && tipoLimpo.includes('DCP')) {
        return iconMap['Controlador Eletrônico Misto (DAS) + (DCP)'];
    }
    if (tipoLimpo.includes('Misto') && tipoLimpo.includes('DIF')) {
        return iconMap['Controlador Eletrônico Misto (DAS) + (DIF)'];
    }

         // === VERIFICAR DEPOIS RADARES GENÉRICOS ===

    if (tipoLimpo.includes('Média') || tipoLimpo.includes('(RIV)') || tipoLimpo.includes('RIV')) {
        return iconMap['Radar Inteligente de Velocidade Média (RIV)'];
    }
    if (tipoLimpo.includes('Túnel') || tipoLimpo.includes('TUV')) {
        return iconMap['Passagem Sob Túnel Viário (TUV)'];
    }
    if (tipoLimpo.includes('Zona Verde') || tipoLimpo.includes('ZVT') || tipoLimpo.includes('ZVC'))
        return iconMap['Zona Verde de Trânsito (ZVT)'];

    if (tipoLimpo.includes('Parada sobre Faixa de Pedestres') || tipoLimpo.includes('DPFP'))
        return iconMap['Detector de Parada sobre Faixa de Pedestres (DPFP)'];

     // ✅ CORREÇÃO: Verifica SEI antes da regra genérica de "Semáforo"
    if (tipoLimpo.includes('SEI') || tipoLimpo.includes('Semáforo Inteligente')) {
        return iconMap['Semáforo Inteligente (SEI)'];
    }
    if (tipoLimpo.includes('Semáforo') || tipoLimpo.includes('(DAS)'))
        return iconMap['Detector de Avanço de Semáforo (DAS)'];

    if (tipoLimpo === 'Controle de Redução de Velocidade (CRV)' ||
        tipoLimpo === 'Controle de Redução de Velocidade')
        return iconMap['Controle de Redução de Velocidade (CRV)'];

    var isRadarVelocidade = (tipoLimpo.includes('Velocidade') || 
                         tipoLimpo.includes('CEV') || 
                         tipoLimpo.includes('CEM') || 
                         tipoLimpo.includes('Controlador Eletrônico')) 
                         && !tipoLimpo.includes('Misto');


    if (isRadarVelocidade) {
        var velStr = String(velocidade || '').trim();
        var velNum = parseInt(velStr.replace(/[^0-9]/g, ''), 10);
        if (velNum === 30) return '/imagens_app/ic_radar_cev_30_v2.png';
        if (velNum === 40) return '/imagens_app/ic_radar_cev_40_v2.png';
        if (velNum === 50) return '/imagens_app/ic_radar_cev_50_v2.png';
        if (velNum === 60) return '/imagens_app/ic_radar_cev_60_v2.png';
        if (velNum === 70) return '/imagens_app/ic_radar_cev_70_v2.png';
        if (velNum === 80) return '/imagens_app/ic_radar_cev_80_v2.png';
        if (velNum === 100) return '/imagens_app/ic_radar_cev_100_v2.png'; 
        if (velNum === 110) return '/imagens_app/ic_radar_cev_110_v2.png';
        return '/imagens_app/ic_radar_cev_v2.png';
    }

    if (iconMap[tipoLimpo]) return iconMap[tipoLimpo];

    var substrings = [
        { keys: ['Olho Vivo', 'COV'],               icon: iconMap['Câmera Olho Vivo (COV)'] },
        { keys: ['Poluição', 'APE'],                icon: iconMap['Alerta de Poluição Elevada (APE)'] },
        { keys: ['Semáforo', 'SEI'],                icon: iconMap['Semáforo Inteligente (SEI)'] },
        { keys: ['Facial'],                         icon: iconMap['Leitor de Reconhecimento Facial (OCR-F)'] },
        { keys: ['OCR-P', 'Placas'],                icon: iconMap['Leitor Inteligente de Placas (OCR-P)'] },
        { keys: ['Celular', 'DUC'],                 icon: iconMap['Detector de Uso de Celular'] },
        { keys: ['Cinto', 'VCS'],                   icon: iconMap['Verificador de Cinto de Segurança (VCS)'] },
        { keys: ['Acidente', 'AIA'],                icon: iconMap['Alerta de Alto Índice de Acidente (AIA)'] },
        { keys: ['Média', 'RIV'],                   icon: iconMap['Radar Inteligente de Velocidade Média (RIV)'] },
        { keys: ['Apenas', 'ATL'],                  icon: iconMap['Apenas Trânsito Local (ATL)'] },
        { keys: ['Perigo', 'ZPV'],                  icon: iconMap['Zona de Perigo e Violência (ZPV)'] },
        { keys: ['Inundaç', 'ZIR'],                 icon: iconMap['Zona de Risco de Inundações Recorrentes (ZIR)'] },
        { keys: ['Redução', 'Redutor', 'DRV', 'CRV'],icon: iconMap['Controle de Redução de Velocidade (CRV)'] },
        { keys: ['Conversão'],                      icon: iconMap['Detector de Conversão em Local Proibido'] },
        { keys: ['Invasão', 'DIFEX', 'Faixa Exclusiva', 'MOVE'], icon: iconMap['Detector de Invasão de Faixa Exclusiva (DIFEX)'] },
        { keys: ['Tráfego Proibido', 'DTLP'],       icon: iconMap['Detector de Tráfego em Local Proibido'] },
        { keys: ['BUS', 'Faixa Preferencial'],      icon: iconMap['Detector de Faixa Preferencial de Ônibus (BUS)'] },
        { keys: ['Túnel', 'TUV'],                   icon: iconMap['Passagem Sob Túnel Viário (TUV)'] },
    ];
    for (var s = 0; s < substrings.length; s++) {
        var entry = substrings[s];
        for (var k = 0; k < entry.keys.length; k++) {
            if (tipoLimpo.includes(entry.keys[k])) return entry.icon;
        }
    }
    return iconMap['default'];
}

document.addEventListener('error', function(e) {
    var target = e.target;
    if (target && target.tagName === 'IMG') {
        var parent = target.closest('.radar-marker-icon');
        if (parent) {
            var fallback = target.getAttribute('data-fallback');
            if (fallback) { target.src = fallback; e.preventDefault(); e.stopPropagation(); }
        }
    }
}, true);

function showNotification(message) {
    var $toast = $("#toast-msg");
    $toast.text(message).addClass("show");
    setTimeout(function() { $toast.removeClass("show"); }, 3500);
}

function hideFullscreenLoading() {
    var el = document.getElementById('loading-fullscreen');
    if (el) { el.classList.add('fade-out'); setTimeout(function() { el.remove(); }, 600); }
}

//===============================
// CALCULAR DISTANCIA COORDENADAS
//===============================

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

function calcularCentroMapaComOffset(lat, lng, bearing) {
    if (!estaEmNavegacao || !mapaRotacionado) return { lat: lat, lng: lng };
    var offsetDist = 0.0003;
    var rad = (bearing - 90) * Math.PI / 180;
    return {
        lat: lat - Math.cos(rad) * offsetDist,
        lng: lng - Math.sin(rad) * offsetDist
    };
}

// ============================================================
// ENCONTRA O PONTO DA ROTA MAIS PRÓXIMO DO GPS
// ============================================================
function encontrarPontoMaisProximoDaRota(lat, lng) {

    if (!coordenadasRotaNavegacao || coordenadasRotaNavegacao.length < 2) {
        return {
            lat: lat,
            lng: lng,
            distancia: Infinity,
            segmento: -1,
            heading: null
        };
    }

    let melhor = null;
    let menorDistancia = Infinity;

    // Escala aproximada para transformar lat/lng em plano local
    const cosLat = Math.cos(lat * Math.PI / 180);

    const xGPS = lng * cosLat;
    const yGPS = lat;

    for (let i = 0; i < coordenadasRotaNavegacao.length - 1; i++) {

        const a = coordenadasRotaNavegacao[i];
        const b = coordenadasRotaNavegacao[i + 1];

        const ax = a.lng * cosLat;
        const ay = a.lat;

        const bx = b.lng * cosLat;
        const by = b.lat;

        const dx = bx - ax;
        const dy = by - ay;

        const comprimento2 = dx * dx + dy * dy;

        let t = 0;

        if (comprimento2 > 0) {
            t = ((xGPS - ax) * dx + (yGPS - ay) * dy) / comprimento2;
            t = Math.max(0, Math.min(1, t));
        }

        const px = ax + t * dx;
        const py = ay + t * dy;

        const diferencaX = xGPS - px;
        const diferencaY = yGPS - py;

        const distancia2 =
            diferencaX * diferencaX +
            diferencaY * diferencaY;

        if (distancia2 < menorDistancia) {

            menorDistancia = distancia2;

            const pontoLat = py;
            const pontoLng = px / cosLat;

            melhor = {
                lat: pontoLat,
                lng: pontoLng,
                distancia: calcularDistancia(
                    lat,
                    lng,
                    pontoLat,
                    pontoLng
                ),
                segmento: i,
                heading: calcularBearing(
                    a.lat,
                    a.lng,
                    b.lat,
                    b.lng
                )
            };
        }
    }

    return melhor;
}

// ============================================================
// AJUSTA O GPS PARA A LINHA DA ROTA
// ============================================================
function ajustarPosicaoNaVia(lat, lng) {

    const resultado = encontrarPontoMaisProximoDaRota(lat, lng);

    if (!resultado) {
        return {
            lat: lat,
            lng: lng
        };
    }

    distanciaDaRota = resultado.distancia;

    // Se o GPS estiver muito longe da rota,
    // NÃO força o marcador para a via.
    // Isso evita erros em ruas paralelas.
    const LIMITE_AJUSTE_VIA = 30;

    if (resultado.distancia > LIMITE_AJUSTE_VIA) {
        return {
            lat: lat,
            lng: lng,
            heading: null,
            ajustado: false
        };
    }

    ultimoSegmentoRota = resultado.segmento;

    return {
        lat: resultado.lat,
        lng: resultado.lng,
        heading: resultado.heading,
        ajustado: true
    };
}
//===============
//SUAVIZAR POSIÇÃO
//================
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

//=========================
//MOVER MARCADOR SUAVEMENTE
//=========================
function moverMarcadorSuavemente(targetLat, targetLng) {

//AJUSTR POSIÇÃO NA VIA
if (estaEmNavegacao && coordenadasRotaNavegacao.length >= 2) {

    const posicaoCorrigida = ajustarPosicaoNaVia(
        targetLat,
        targetLng
    );

    targetLat = posicaoCorrigida.lat;
    targetLng = posicaoCorrigida.lng;

    if (
        posicaoCorrigida.heading !== null &&
        posicaoCorrigida.heading !== undefined
    ) {

        headingIconeNavegacao =
            posicaoCorrigida.heading;

        atualizarIconeNavegacaoVia(
            headingIconeNavegacao
        );
    }
}
//==================
//MARCADOR PARA MOVER
//===================


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

function limparHistoricoDistancia(radarId) {
    if (historicoDistanciasRadar[radarId]) delete historicoDistanciasRadar[radarId];
}

function verificarDirecaoMelhorada(uLat, uLng, uHeading, radarLat, radarLng, radarId, distanciaAtual) {
    if (!uHeading || uHeading === -1 || isNaN(uHeading)) {
        var t = calcularTendenciaDistancia(radarId, distanciaAtual);
        return { estaAproximando: t.estaAproximando, estaAfastando: t.estaAfastando };
    }
    var deltaX = radarLng - uLng;
    var deltaY = radarLat - uLat;
    var anguloRadar = (Math.atan2(deltaY, deltaX) * 180 / Math.PI + 360) % 360;
    var diff = Math.abs(uHeading - anguloRadar);
    diff = Math.min(diff, 360 - diff);
    var tendencia = calcularTendenciaDistancia(radarId, distanciaAtual);
    return {
        estaAproximando: (diff < ALERT_CONFIG.ANGULO_APROXIMACAO) || tendencia.estaAproximando,
        estaAfastando: (diff > ALERT_CONFIG.ANGULO_AFASTANDO) && tendencia.estaAfastando
    };
}

// =================================
// TEMA DO MAPA MATRIX (DIA E NOITE)
// =================================
function aplicarTemaMapa() {
    if (typeof map === 'undefined' || !map) return;

    var hora = new Date().getHours();
    var mapContainer = map.getContainer(); 
    
    // Define se é dia (6h às 18h) ou noite (19h às 5h)
    var isNight = (hora >= 19 || hora < 6);

    // CORREÇÃO: Sintaxe correta. Usando OpenStreetMap (100% gratuito, sem API Key)
    var urlTema = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    // Troca a classe CSS que aplica o filtro Matrix
    if (isNight) {
        mapContainer.classList.remove('matrix-day');
        mapContainer.classList.add('matrix-night');
    } else {
        mapContainer.classList.remove('matrix-night');
        mapContainer.classList.add('matrix-day');
    }

    // Atualiza o tile do mapa
    if (typeof tileLayer !== 'undefined' && tileLayer) {
        tileLayer.setUrl(urlTema);
    } else {
        tileLayer = L.tileLayer(urlTema, {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
    }
}

// =================================
// AJUSTAR POSIÇÃO DO SPEED WIDGET
// =================================

function ajustarPosicaoSpeedWidget(subir) {
    var speedWidget = document.querySelector('.speed-widget');
    if (subir) {
        speedWidget.classList.add('alerta-ativo');
    } else {
        speedWidget.classList.remove('alerta-ativo');
    }
}

function ajustarBussolaParaBusca(ativo) {
    var compassWidget = document.querySelector('.compass-widget');
    if (ativo) {
        if(compassWidget) compassWidget.classList.add('busca-ativo');
    } else {
        if(compassWidget) compassWidget.classList.remove('busca-ativo');
    }
}

function ocultarBussola(ocultar) {
    var compassWidget = document.querySelector('.compass-widget');
    if (ocultar) {
        compassWidget.classList.add('hidden');
    } else {
        compassWidget.classList.remove('hidden');
    }
}

// ========================================
// CALCULAR HORÁRIO DE CHEGADA
// ========================================

function atualizarHorarioChegada(minutos) {

    minutos = parseInt(minutos);

    if (isNaN(minutos) || minutos < 0) {
        $("#nav-arrival").text("🏁 Chegada: --:--");
        return;
    }

    const agora = new Date();

    agora.setMinutes(agora.getMinutes() + minutos);

    const horas = String(agora.getHours()).padStart(2, "0");
    const minutosChegada = String(agora.getMinutes()).padStart(2, "0");

    $("#nav-arrival").text(
        "🏁 Chegada: " + horas + ":" + minutosChegada
        
    );
}


// ===================================================================
// FUNÇÕES DE NAVEGAÇÃO
// ===================================================================
function adicionarMarcadoresRota(originLat, originLng, destLat, destLng) {
  
 
    destinoNavegacao = {lat: destLat, lng: destLng};
    
  
    if (startRouteMarker) { map.removeLayer(startRouteMarker); startRouteMarker = null; }
    if (endRouteMarker) { map.removeLayer(endRouteMarker); endRouteMarker = null; }
    
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
   
    estaEmNavegacao = true;
    ultimaPosicaoMarcador = { lat: null, lng: null };
    var startIcon = L.divIcon({
        html: '<img id="nav-icon-img" src="/imagens_app/ic_navigator_map.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'" style="width:70px;height:70px;transform-origin:center center;transition:transform 0.3s ease-out;">',
        className: 'route-start-marker user-navigator-marker',
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -25]
    });
    startRouteMarker = L.marker([originLat, originLng], { icon: startIcon, zIndexOffset: 2000, pane: 'markerPane' }).addTo(map);
    startRouteMarker.bindTooltip("Navegando para destino", { permanent: false, direction: "top", offset: [0, -30] });
    
    var endIcon = L.divIcon({
        html: '<img src="/imagens_app/ic_icon_chegada.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/684/684908.png\'" style="width:45px;height:45px;">',
        className: 'route-end-marker',
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -50]
    });
    endRouteMarker = L.marker([destLat, destLng], { icon: endIcon, zIndexOffset: 900 }).addTo(map);
    endRouteMarker.bindPopup("<b>DESTINO</b><br>Você chegou ao seu destino!", { closeButton: false, autoClose: true, closeOnClick: true });
}

//==============
//ATUALIZAR ROTA
//==============
function atualizarRota() {
    if (!destinoAtual || !userLat || !userLng || !routingControl) return;
    routingControl.setWaypoints([L.latLng(userLat, userLng), L.latLng(destinoAtual.lat, destinoAtual.lng)]);
    routingControl.route();
}

//===================================
//FUNÇÃO DE VERIFICAR CHAGADA DESTINO
//===================================

function verificarChegadaDestino() {

    if (!destinoAtual || !userLat || !userLng) return;

    var distanciaDestino = calcularDistancia(
        userLat,
        userLng,
        destinoAtual.lat,
        destinoAtual.lng
    );

    if (distanciaDestino <= 30) {

        showNotification("Você chegou ao seu destino!");

        if (endRouteMarker) endRouteMarker.openPopup();

        setTimeout(function() {
            finalizarNavegacao();
        }, 4000);
    }
}

//FUNÇÃO FINALIZAR NAVEGAÇÃO

function finalizarNavegacao() {
    if (!map) return;
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    destinoAtual = null;
    destinoNavegacao = null;  // ⬅️ ADICIONAR ESTA LINHA
    estaEmNavegacao = false;
    estaEmMovimento = false;
    velocidadeAtual = 0;
    if (startRouteMarker) { map.removeLayer(startRouteMarker); startRouteMarker = null; }
    if (endRouteMarker) { map.removeLayer(endRouteMarker); endRouteMarker = null; }
    
    if (_navAnim.rafId) { cancelAnimationFrame(_navAnim.rafId); _navAnim.rafId = null; }
    _navAnim.fromLat = null; _navAnim.fromLng = null;

    ultimaPosicaoMarcador = { lat: null, lng: null };
    posicaoSuavizadaGPS = { lat: null, lng: null };
    ultimaAtualizacaoCamera = 0;
    zoomAtualEfetivo = 18;
    centroAtualEfetivo = { lat: null, lng: null };
    zoomAlvo = 18;
    bearingAlvo = 0;
    bearingAtual = 0;
    bearingAlvoAnterior = null;
    headingIconeNavegacao = 0;
    headingIconeSuavizado = 0;
    if (typeof map.setBearing === 'function') map.setBearing(0);
    mapaRotacionado = false;
    var ri = document.getElementById('rotate-btn-icon');
    if (ri) {
        ri.src = "/imagens_app/ic_girado_map.png";
        ri.onerror = function() { this.src = 'https://cdn-icons-png.flaticon.com/512/3089/3089803.png'; };
        ri.style.transform = 'rotate(0deg)';
    }
    var rb = document.getElementById('btn-rotate-map');
    if (rb) rb.classList.remove('rotated');
    
    // VOLTA PARA O ÍCONE DE NAVEGADOR
    if (userLat && userLng) {
        atualizarMarcadorUsuario(userLat, userLng, 'navegador');
    }
    
    var sidebar = document.getElementById('sidebar-controls');
    var btnMenu = document.getElementById('btn-menu-toggle');
    if (sidebar && sidebar.classList.contains('retracted')) {
        sidebarAberta = true;
        sidebar.classList.remove('retracted');
        if (btnMenu) btnMenu.classList.remove('active');
    }
    map.flyTo([userLat, userLng], 17, { duration: 1 });
    showNotification("Navegação encerrada");
}

function removerRota() { finalizarNavegacao(); }

//==================
//FUNÇÃO CRIAR ROTA
//==================

function criarRota(destLat, destLng) {
    if (!userLat || !userLng) { showNotification("Aguardando posição GPS..."); return; }
    if (routingControl) { map.removeControl(routingControl); routingControl = null; }
    destinoAtual = { lat: destLat, lng: destLng };
   
    adicionarMarcadoresRota(userLat, userLng, destLat, destLng);
    routingControl = L.Routing.control({
        waypoints: [L.latLng(userLat, userLng), L.latLng(destLat, destLng)],
        routeWhileDragging: false, addWaypoints: false, draggableWaypoints: false,
        fitSelectedRoutes: false, show: false, autoRoute: true,
        lineOptions: {
            styles: [
                { color: '#4A148C', weight: 16, opacity: 0.4, lineCap: 'round', lineJoin: 'round' },
                { color: '#6A1B9A', weight: 12, opacity: 0.9, lineCap: 'round', lineJoin: 'round' },
                { color: '#8E24AA', weight: 8, opacity: 0.95, lineCap: 'round', lineJoin: 'round' },
                { color: '#FF9800', weight: 5, opacity: 1.0, lineCap: 'round', lineJoin: 'round' },
                { color: '#FFB74D', weight: 2, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }
            ],
            addWaypoints: false
        },
        createMarker: function() { return null; },
        showAlternatives: false
    }).addTo(map);
    
    routingControl.on('routesfound', function(e) {
        let route = e.routes[0];
        if (route.coordinates && route.coordinates.length >= 2) {
            coordenadasRotaNavegacao = route.coordinates;
            var p1 = route.coordinates[0];
            var p2 = route.coordinates[1];
            var headingInicial = calcularBearing(p1.lat, p1.lng, p2.lat, p2.lng);
            headingIconeNavegacao = headingInicial;
            headingIconeSuavizado = headingInicial;
            _navAnim.headingAlvo = headingInicial;
            _navAnim.headingSuavizado = headingInicial;
            bearingAlvo = headingInicial;
            bearingAtual = headingInicial;
            ultimoSegmentoRota = 0;
        }

        let dk = (route.summary.totalDistance / 1000).toFixed(1);
        let tm = Math.round(route.summary.totalTime / 60);

        // ✅ CHAMADA CORRETA AQUI
        mostrarInfoNavegacao(dk, tm);

        $("#loading").hide();
        iniciarModoNavegacaoSuave();
    });
}




//CALCULANDO DE ORIENTAÇÃO 

function calcularBearing(lat1, lng1, lat2, lng2) {
    var dLon = (lng2 - lng1) * Math.PI / 180;
    var lat1Rad = lat1 * Math.PI / 180;
    var lat2Rad = lat2 * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2Rad);
    var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    var brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

function iniciarModoNavegacaoSuave() {
    estaEmNavegacao = true;
    isFollowing = true;
    var sidebar = document.getElementById('sidebar-controls');
    var btnMenu = document.getElementById('btn-menu-toggle');
    if (sidebar && !sidebar.classList.contains('retracted')) {
        sidebarAberta = false;
        sidebar.classList.add('retracted');
        if (btnMenu) btnMenu.classList.add('active');
    }
    if (currentHeading > 0 && typeof map.setBearing === 'function') {
        mapaRotacionado = true;
        bearingAlvo = currentHeading;
        bearingAtual = currentHeading;
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
    let mudancaZoom = Math.abs(zoomArredondado - zoomAtualEfetivo);
    let mudancaPos = 0;
    if (centroAtualEfetivo.lat !== null) {
        mudancaPos = calcularDistancia(c.lat, c.lng, centroAtualEfetivo.lat, centroAtualEfetivo.lng);
    }
    if (mapaRotacionado && typeof map.setBearing === 'function') {
        bearingAtual = suavizarBearing(bearingAlvo, bearingAtual, FATOR_SUAVIZACAO_BEARING);
        map.setBearing(bearingAtual);
        var rotateBtnIcon = document.getElementById('rotate-btn-icon');
        if (rotateBtnIcon) rotateBtnIcon.style.transform = 'rotate(' + bearingAtual + 'deg)';
    }
    if (mudancaPos < 2 && mudancaZoom < 0.3 && centroAtualEfetivo.lat !== null) return;
    centroAtualEfetivo = { lat: c.lat, lng: c.lng };
    zoomAtualEfetivo = zoomArredondado;
    map.setView([c.lat, c.lng], zoomArredondado, { animate: false, duration: 0 });
}

async function buscarCoordenadas(endereco){
    try{var response=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(endereco));
    var data=await response.json();
    if(data&&data.length>0)
    return{lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon)};
    response=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(endereco+', Belo Horizonte, Minas Gerais, Brasil'));
    data=await response.json();
    if(data&&data.length>0)
    return{lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon)};
    return null}
    catch(e){console.error("Erro ao buscar coordenadas:",e);
    return null}}

    //FUNÇÃO RESETAR MAPA

function resetarMapa() {
    if (!map) return;
    mapaRotacionado = false;
    bearingAlvo = 0;
    bearingAtual = 0;
    if (typeof map.setBearing === 'function') map.setBearing(0);
    var rotateBtnIcon = document.getElementById('rotate-btn-icon');
    if (rotateBtnIcon) {
        rotateBtnIcon.src = "/imagens_app/ic_girado_map.png";
        rotateBtnIcon.onerror = function() { this.src = 'https://cdn-icons-png.flaticon.com/512/3089/3089803.png'; };
        rotateBtnIcon.style.transform = 'rotate(0deg)';
    }
    var rotateBtn = document.getElementById('btn-rotate-map');
    if (rotateBtn) rotateBtn.classList.remove('rotated');
    map.setView([posicaoCentralOriginal.lat, posicaoCentralOriginal.lng], posicaoCentralOriginal.zoom, { animate: true, duration: 0.5 });
    isFollowing = false;
    
    // RESETA O ALERTA DE NORMALIDADE
    alertaNormalidadeMostrado = false;
    
    // REMOVE E RECRIA O MARCADOR COM ÍCONE DE NAVEGADOR
    if (!estaEmNavegacao && userMarker) {
        var pos = userMarker.getLatLng();
        map.removeLayer(userMarker);
        
       var navIcon = criarIconeNavegador(false); // pulso normal
        
        userMarker = L.marker([pos.lat, pos.lng], { 
            icon: navIcon, 
            zIndexOffset: 1000 
        }).addTo(map);
        userMarker.bindTooltip('Você está aqui', { permanent: false, direction: 'top', offset: [0, -25] });
        iconeCentralizado = false;
    }
    
    if (refreshDelayTimer) clearTimeout(refreshDelayTimer);
    refreshDelayTimer = setTimeout(function() {
        var marcadorAtivo = estaEmNavegacao ? startRouteMarker : userMarker;
        if (marcadorAtivo && !isFollowing) {
            isFollowing = true;
            map.flyTo(marcadorAtivo.getLatLng(), 20, { duration: 0.8 });
            showNotification("Retornando à sua posição atual");
        }
        refreshDelayTimer = null;
    }, TEMPO_REFRESH_DELAY);
    
    removerRota();
    esconderAlertaVisual();
    showNotification("Mapa resetado");
    historicoDistanciasRadar = {};
}

// FUNÇÃO EXTRAIR COORDENADAS

function extrairCoordenadas(record, index) {
    if (!record || record.length < 9) return null;
    let geomIndex = (record.length >= 10) ? 9 : 8;
    let s = String(record[geomIndex]).trim();
    if (!s || s === '' || s === 'null' || s === 'undefined') {
        geomIndex = (geomIndex === 9) ? 8 : 7;
        s = String(record[geomIndex]).trim();
    }
    if (!s || s === '') return null;
    let lat = null, lng = null;
    
    if (lat === null && s.includes('.')) {
        let parts = s.split(',').map(function(p) { return p.trim(); });
        if (parts.length >= 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[parts.length - 1]); }
    }
    if ((lat === null || isNaN(lat)) && s.includes(';')) {
        let parts = s.split(';').map(function(p) { return p.trim().replace(',', '.'); });
        if (parts.length >= 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[1]); }
    }
    if ((lat === null || isNaN(lat)) && (s.match(/,/g) || []).length >= 3) {
        let match = s.match(/(-?\d+,\d+),\s*(-?\d+,\d+)/);
        if (match) { lat = parseFloat(match[1].replace(',', '.')); lng = parseFloat(match[2].replace(',', '.')); }
    }
    if ((lat === null || isNaN(lat))) {
        let parts = s.split(',').map(function(p) { return p.trim().replace(',', '.'); });
        if (parts.length === 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[1]); }
    }
    if (lat === null || isNaN(lat) || lng === null || isNaN(lng)) {
        for (var f = Math.max(0, geomIndex - 2); f < Math.min(record.length, geomIndex + 3); f++) {
            if (f === geomIndex) continue;
            var campo = String(record[f]).trim();
            if (campo.includes('.') && campo.includes(',')) {
                let parts = campo.split(',').map(function(p) { return p.trim(); });
                if (parts.length === 2) {
                    var tLat = parseFloat(parts[0]); var tLng = parseFloat(parts[1]);
                    if (!isNaN(tLat) && !isNaN(tLng) && tLat >= -90 && tLat <= 90) { lat = tLat; lng = tLng; break; }
                }
            }
        }
    }
    if (isNaN(lat) || isNaN(lng) || lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: lat, lng: lng };
}

//=================
// ATUALIZAR BÚSSOLA
//=================
function atualizarBussola(headingDegrees) {

    // =========================================================
    // BÚSSOLA = A bússola continua obedecendo ao heading do dispositivo/GPS
    // =========================================================
   

    var needle =
        document.getElementById('compass-needle-img');

    if (
        needle &&
        headingDegrees != null &&
        !isNaN(headingDegrees)
    ) {
        needle.style.transform =
            'rotate(' + headingDegrees + 'deg)';
    }
}


    // =========================================================
    // ÍCONE DE NAVEGAÇÃO
    // NÃO usar headingDegrees aqui.
    //
    // O ícone deve seguir a direção da VIA/ROTA.
    // A função ajustarPosicaoNaVia() fornece essa direção.
    // =========================================================

    if (
        estaEmNavegacao &&
        coordenadasRotaNavegacao &&
        coordenadasRotaNavegacao.length >= 2 &&
        userLat != null &&
        userLng != null
    ) {

        var posicaoVia = ajustarPosicaoNaVia(
            userLat,
            userLng
        );

        if (
            posicaoVia &&
            posicaoVia.heading != null &&
            !isNaN(posicaoVia.heading)
        ) {

            headingIconeNavegacao = posicaoVia.heading;

            atualizarIconeNavegacaoVia(
                headingIconeNavegacao
            );
        }
    }
//======================================
// FUNÇÃO ATUALIZAR NAVEGAÇÃO NA VIA
//=====================================
    function atualizarIconeNavegacaoVia(headingVia) {

    var navIcon =
        document.querySelector('.nav-pulse-wrap img');

    if (
        !navIcon ||
        headingVia == null ||
        isNaN(headingVia)
    ) {
        return;
    }

    if (mapaRotacionado) {
        navIcon.style.transform = 'rotate(0deg)';
    } else {
        navIcon.style.transform =
            'rotate(' + headingVia + 'deg)';
    }
}

// =========================
// GPS / ÍCONE DE ROTA FLUIDO
// ==========================
var _navAnim = {
    rafId: null,
    fromLat: null,
    fromLng: null,
    toLat: null,
    toLng: null,
    startTime: null,
    duration: 600,
    headingAlvo: 0,
    headingSuavizado: 0
};

function _animarIconeNavegacao() {
    if (!estaEmNavegacao || !startRouteMarker) return;

    var agora = performance.now();
    var progresso = Math.min((agora - _navAnim.startTime) / _navAnim.duration, 1);
    var t = 1 - Math.pow(1 - progresso, 3);

    var latAtual = _navAnim.fromLat + (_navAnim.toLat - _navAnim.fromLat) * t;
    var lngAtual = _navAnim.fromLng + (_navAnim.toLng - _navAnim.fromLng) * t;

    // Suavização do heading com fator baixo para evitar tremores
    _navAnim.headingSuavizado = suavizarBearing(
        _navAnim.headingAlvo,
        _navAnim.headingSuavizado,
        0.12
    );

    startRouteMarker.setLatLng([latAtual, lngAtual]);

    var imgNav = document.getElementById('nav-icon-img');
    if (imgNav) {
        imgNav.style.transform = 'rotate(' + _navAnim.headingSuavizado + 'deg)';
    }

    posicaoSuavizadaGPS = { lat: latAtual, lng: lngAtual };
    ultimaPosicaoMarcador = { lat: latAtual, lng: lngAtual };

    if (progresso < 1) {
        _navAnim.rafId = requestAnimationFrame(_animarIconeNavegacao);
    } else {
        _navAnim.rafId = null;
        ultimaPosicaoMarcador = { lat: _navAnim.toLat, lng: _navAnim.toLng };
    }
}

function _iniciarAnimacaoNavegacao(toLat, toLng, novoHeading) {
    if (_navAnim.rafId) {
        cancelAnimationFrame(_navAnim.rafId);
        _navAnim.rafId = null;
    }

    var pos = startRouteMarker ? startRouteMarker.getLatLng() : null;
    _navAnim.fromLat = pos ? pos.lat : toLat;
    _navAnim.fromLng = pos ? pos.lng : toLng;
    _navAnim.toLat = toLat;
    _navAnim.toLng = toLng;
    _navAnim.startTime = performance.now();

    if (novoHeading !== null && !isNaN(novoHeading)) {
        _navAnim.headingAlvo = novoHeading;
        headingIconeNavegacao = novoHeading;
    }

    _navAnim.rafId = requestAnimationFrame(_animarIconeNavegacao);
}

//================================
// FUNÇÃO PROCESSAR NOVA POSIÇÃO
//================================
function processarNovaPosicao(newLat, newLng, speedKmh, hardwareHeading, accuracy) {
    if (!map) return;

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

    prevLat = newLat;
    prevLng = newLng;
    prevTime = currentTime;
    userLat = newLat;
    userLng = newLng;

    // [CORREÇÃO] Usa a precisão real recebida (fallback 999 se ausente)
    var accReal = (accuracy !== undefined && accuracy !== null && !isNaN(accuracy)) ? accuracy : 999;
    atualizarStatusGPS({ coords: { latitude: newLat, longitude: newLng, accuracy: accReal } });

    // =============================================
    // [CORREÇÃO PRINCIPAL] Atualiza marcador SEMPRE
    // =============================================
    if (estaEmNavegacao) {
        // Se o startRouteMarker não existir, recria ele
        if (!startRouteMarker) {
            console.warn("⚠️ startRouteMarker ausente durante navegação. Recriando...");
            adicionarMarcadoresRota(userLat, userLng, destinoAtual.lat, destinoAtual.lng);
        }
        
        // Agora atualiza a posição (com ou sem animação)
        if (startRouteMarker) {
            _iniciarAnimacaoNavegacao(smoothLat, smoothLng, novoHeading);
        }

        if (!gpsInitialized) {
            gpsInitialized = true;
            hideFullscreenLoading();
        }

    } else {
        // MODO NORMAL (não está navegando)
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
            // Se está em movimento e o ícone está como GPS, volta para NAVEGADOR
            if (iconeCentralizado && speedKmh > 3) {
                console.log("🚶 Usuário em movimento - voltando para ícone de navegador");
                var pos = userMarker.getLatLng();
                map.removeLayer(userMarker);

                var navIcon = L.divIcon({
                    html: '<img src="/imagens_app/ic_navigator_map.png" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/7892/7892059.png\'" style="width:50px;height:50px;">',
                    className: 'user-gps-marker',
                    iconSize: [50, 50],
                    iconAnchor: [25, 50],
                    popupAnchor: [0, -50]
                });

                userMarker = L.marker([pos.lat, pos.lng], {
                    icon: navIcon,
                    zIndexOffset: 1000
                }).addTo(map);
                userMarker.bindTooltip('Você está aqui', { permanent: false, direction: 'top', offset: [0, -25] });

                iconeCentralizado = false;
                showNotification("🧭 Modo navegação ativado");
            }

            moverMarcadorSuavemente(smoothLat, smoothLng);
        }
    }

    //=========================================
    // VERIFICAÇÃO DE DESTINO, ROTA E NAVEGAÇÃO
    //=========================================
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

//===========================================
// FUNÇÃO INICIAR NAVEGAÇÃO GPS E CIDADE ATUAL
//===========================================
const cidadeLabel = document.getElementById("cidade-atual");
let ultimaCidade = "";


function startGPSTracking() {
    // Limpa timeout anterior se existir para evitar conflitos
    if (browserGpsTimeout) {
        clearTimeout(browserGpsTimeout);
        browserGpsTimeout = null;
    }

    // Sua verificação do GPS:
    if (!navigator.geolocation) {
        hideFullscreenLoading();
        showNotification("GPS não suportado.");
        return;
    }
    
    // Se já existe um watch, para ele primeiro (limpeza segura)
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}
    //=============================================
    // Inicia o tracking GPS - ÚNICO watchPosition
   //===============================================    
     
    watchId = navigator.geolocation.watchPosition(
        function(position) {
            // Dados da posição
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            var accuracy = position.coords.accuracy; // <-- ADICIONADO: Captura a precisão
            var speedKmh = 0;
                        
            if (position.coords.speed !== null && position.coords.speed >= 0) {
                speedKmh = Math.round(position.coords.speed * 3.6);

   // 👈 ADICIONE ISSO: Atualiza o header em tempo real com a nova precisão
    atualizarInterfaceCabecalho({
        precisaoGPS: precisao
    });
            }

            // =================================================================
            // MONITORAMENTO DE PRECISÃO (Para você entender o "ERR")
            // =================================================================
            if (accuracy > 100) {
                console.warn(`⚠️ Sinal de GPS FRACO: ${accuracy}m de margem de erro. Classe ERR aplicada corretamente.`);
            } else if (accuracy > 50) {
                console.log(`⚠️ Sinal de GPS ACEITÁVEL: ${accuracy}m de margem de erro.`);
            } else {
                console.log(`✅ Sinal de GPS EXCELENTE: ${accuracy}m de margem de erro.`);
            }

            atualizarStatusGPS(position); 

            // Verifica chegada ao destino se estiver em navegação
            if (typeof estaEmNavegacao !== 'undefined' && estaEmNavegacao && typeof destinoNavegacao !== 'undefined' && destinoNavegacao) {
                verificarChegadaDestino();
            }

            // Define fonte do GPS
            if (typeof gpsSource !== 'undefined' && gpsSource !== 'appinventor') {
                gpsSource = 'browser';
            }

            // ATUALIZA CIDADE E CLIMA
            if (typeof atualizarCidade === 'function') atualizarCidade(lat, lng);
            if (typeof atualizarTemperatura === 'function') atualizarTemperatura();

            // Processa a nova posição
            processarNovaPosicao(lat, lng, speedKmh, position.coords.heading, accuracy);

            // Marca GPS como inicializado
            if (!gpsInitialized) {
                gpsInitialized = true;
                if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
            }

        }, 
        function(error) {
            console.error("❌ Erro GPS:", error.message, "(Código:", error.code, ")");
            // Garante que o indicador fique vermelho em caso de erro real
            if (typeof atualizarStatusGPS === 'function') atualizarStatusGPS(null); 
            if (typeof showNotification === 'function') showNotification("Erro ao obter localização: " + error.message);
            if (!gpsInitialized) {
                if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
            }
        }, 
        { 
            enableHighAccuracy: true,
            maximumAge: 0,          // <-- ALTERADO: 0 força leitura fresca do sensor de hardware
            timeout: 30000          // <-- Mantido: 30s é ótimo para dar tempo do satélite travar
        }
    );

    console.log("✅ GPS iniciado com watchId:", watchId);

    // Timeout de segurança
    browserGpsTimeout = setTimeout(function() {
        if (!gpsInitialized && (typeof gpsSource === 'undefined' || gpsSource !== 'appinventor')) { 
            if (typeof showNotification === 'function') showNotification("Aguardando sinal de GPS... Verifique se está em local aberto."); 
            if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading(); 
        }
    }, 8000);

//===========================================
// FUNÇÃO PARAR GPS
//===========================================

function stopGPSTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        gpsInitialized = false;
        console.log("GPS parado");
    }
    
    if (browserGpsTimeout) {
        clearTimeout(browserGpsTimeout);
        browserGpsTimeout = null;
    }
}

//===========================================
// FUNÇÃO REINICIAR GPS (SE PRECISAR)
//===========================================

function restartGPSTracking() {
    stopGPSTracking();
    // Pequeno delay para reiniciar
    setTimeout(function() {
        startGPSTracking();
    }, 500);
}
//=====================================
// FUNÇÃO ACCURACY DISTANCIA METROS
//=====================================
function distanciaMetros(lat1, lon1, lat2, lon2){

    const R = 6371000;

    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;

    const a =
        Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2)**2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

}

//=====================================
// FUNÇÃO INTEGRAÇÃO ACCURACY GPS
//=====================================

let melhorPrecisao = Infinity;
const historico = [];

function sucesso(position){
    const acc = position.coords.accuracy;
    const newLat = position.coords.latitude;
    const newLng = position.coords.longitude;

    // 1. Registra a melhor precisão obtida (apenas para estatística)
    if(acc < melhorPrecisao){
        melhorPrecisao = acc;
    }

    // 2. Guarda histórico para suavizar (apenas para cálculos de média local, se necessário)
    historico.push({ lat: newLat, lng: newLng });
    if(historico.length > 5){
        historico.shift();
    }

    // 3. NÃO interrompa o fluxo com 'return' baseado em accuracy.
    // A lógica de ignorar saltos absurdos já é feita no suavizarPosicao() dentro de processarNovaPosicao.
    
    console.log(
        "Leitura GPS Recebida - Lat:", newLat, 
        "Lng:", newLng, 
        "Precisão:", acc.toFixed(1) + " m",
        "Melhor:", melhorPrecisao.toFixed(1) + " m"
    );
    
    // IMPORTANTE: Se você estiver chamando esta função 'sucesso' de algum outro lugar 
    // além do watchPosition nativo, você deve passar os dados para a função principal:
    if (typeof processarNovaPosicao === 'function' && gpsSource !== 'browser') {
        let speedKmh = (position.coords.speed !== null && position.coords.speed >= 0) 
            ? Math.round(position.coords.speed * 3.6) : 0;
            
        processarNovaPosicao(
            newLat, 
            newLng, 
            speedKmh, 
            position.coords.heading, 
            acc
        );
    }
}


// =============================================
// CONTROLE RESPONSIVO DO HEADER
// =============================================
function ajustarHeaderResponsivo() {
    const width = window.innerWidth;
    const gpsLabel = document.getElementById('gps-status-label');
    const cidadeLabel = document.getElementById('cidade-atual');
    
    if (width < 400) {
        if (gpsLabel) gpsLabel.textContent = '';
        if (cidadeLabel) {
            cidadeLabel.classList.add('tela-muito-pequena');
            cidadeLabel.classList.remove('modo-app', 'modo-site');
        }
    } else if (width < 600) {
        if (gpsLabel) gpsLabel.textContent = 'GPS';
        if (cidadeLabel) {
            cidadeLabel.classList.remove('tela-muito-pequena');
            cidadeLabel.classList.add('modo-app');
            cidadeLabel.classList.remove('modo-site');
        }
    } else {
        if (gpsLabel) gpsLabel.textContent = 'GPS';
        if (cidadeLabel) {
            cidadeLabel.classList.remove('tela-muito-pequena', 'modo-app');
            cidadeLabel.classList.add('modo-site');
        }
    }
}




//=============================
// PRECISÃO ATUALIZAÇÃO DO GPS DENTRO DO MAPA.JS, NA FUNÇÃO DE SUCESSO DO GPS
//=============================

navigator.geolocation.getCurrentPosition(
    function(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        console.log('✅ [MAPA.JS] GPS obtido com sucesso:', lat, lng);

        // ⚠️ ESTA LINHA É O SEGREDO: Ela avisa o app.js para atualizar tudo!
        if (typeof window.setUserLocation === 'function') {
            window.setUserLocation(lat, lng);
        }
      inicializarMapa(lat, lng); 
    },

  // 2. FUNÇÃO DE ERRO (CRUCIAL para mobile/PWA)
      function(error) {
        console.error('❌ [MAPA.JS] Erro no GPS:', error);
        // Fallback para Belo Horizonte se o GPS falhar
        if (typeof window.setUserLocation === 'function') {
            window.setUserLocation(-19.9167, -43.9345);
        }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
);

// =============================================
// NORMALIZAÇÃO E CLASSIFICAÇÃO DE AUDIO ALERTAS
// =============================================
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .toLowerCase()
        .trim();
}

// =============================================
// CLASSIFICAÇÃO DE AUDIO ALERTAS
// =============================================
function classificarAlerta(tipoOriginal) {
    var tipoNorm = normalizarTexto(tipoOriginal);

    // DESTAQUE (pontos turísticos) — verifica pelo nome do lugar
    for (var d = 0; d < TIPOS_ALERTA_DESTAQUE.length; d++) {
        if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_DESTAQUE[d]))) return 'destaque';
    }
    if (tipoNorm.includes('alerta de lugares em destaque') || tipoNorm.includes('(ale)')) return 'destaque';

    for (var r = 0; r < TIPOS_ALERTA_RISCO.length; r++) {
        if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_RISCO[r]))) return 'risco';
    }

    for (var m = 0; m < TIPOS_ALERTA_MOBILIDADE.length; m++) {
        if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_MOBILIDADE[m]))) return 'mobilidade';
        
    }

    for (var rr = 0; rr < TIPOS_ALERTA_SERVIÇO.length; rr++) {
    if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_SERVIÇO[rr]))) return 'servico';
}

    for (var rr = 0; rr < TIPOS_ALERTA_RADAR.length; rr++) {
        if (tipoNorm.includes(normalizarTexto(TIPOS_ALERTA_RADAR[rr]))) return 'radar';
    }

    // Fallback: se não bateu em nenhuma lista, trata como radar padrão
    return 'radar';
}

function deveAlertaRadar(tipoOriginal) {
    var tipoNorm = normalizarTexto(tipoOriginal);
    for (var i = 0; i < TIPOS_SEM_ALERTA.length; i++) {
        if (tipoNorm.includes(normalizarTexto(TIPOS_SEM_ALERTA[i]))) return false;
    }
    return true;
}

// ===================================================================
// DISPARAR ALERTA (mostra tarja + som)
// ===================================================================

function dispararAlerta(radarData, distancia) {
    var tipo = classificarAlerta(radarData.tipoOriginal);
    tipoAlertaAtivo = tipo;
    ultimoRadarAlertado = radarData.id;
    contagemTocarSom = 0;

    var $container = $("#alert-container");
    var $bar = $container.find(".alert-bar");
    var $icon = $("#alert-icon");
    var $title = $("#alert-title");
    var $text = $("#alert-text");

    $bar.removeClass('alert-bar-radar alert-bar-risco alert-bar-mobilidade alert-bar-destaque alert-bar-servico ' +
                  'alert-bar-critico alert-bar-risco-critico alert-bar-mobilidade-critico alert-bar-destaque-critico alert-bar-servico-critico');
    $bar.addClass('alert-bar-' + tipo);

    var tipoExibicao = ajusteNomes[radarData.tipoOriginal] || radarData.tipoOriginal;
    $icon.attr('src', getIconUrl(radarData.tipoOriginal, radarData.velocidade_maxima));

    // O título já estava correto no seu código original!
    var titulos = { radar: 'ALERTA DE RADAR', risco: 'ALERTA DE RISCO', mobilidade: 'AVISO MOBILIDADE', destaque: 'DESCUBRA A CIDADE', servico: 'REDE DE SERVIÇOS' };
    $title.text(titulos[tipo] || 'ATENÇÃO!');
 
    /* ── TEXTO ÚNICO: tipo + velocidade + distância ── */
    var vel = radarData.velocidade_maxima || '';
    
    // ============================================================
    // 🛠️ CORREÇÃO: Limpar a descrição se for "Descubra a Cidade"
    // ============================================================
    var textoParaExibir = tipoExibicao;
    if (tipo === 'destaque' || tipoExibicao.indexOf('Descubra a Cidade') === 0) {
        // Remove "Descubra a Cidade - " do início da string (ignora espaços extras)
        textoParaExibir = tipoExibicao.replace(/^Descubra a Cidade\s*-\s*/i, '').trim();
    }
    // ============================================================

    var base = textoParaExibir + (vel ? ' — ' + vel + ' km' : '');
    
    $text.data('alert-base', base);               // guarda a base completa (agora limpa)
    $text.text(base + ' - ' + Math.round(distancia) + ' m');
    /* ─────────────────────────────────────────────── */

    if (distancia <= ALERT_CONFIG.DISTANCIA_CRITICA) {
        $bar.addClass('alert-bar-' + tipo + '-critico');
    }

    $container.stop(true, true).show();
    ajustarPosicaoSpeedWidget(true);

    tocarSomAlerta(tipo);

    if (alertTimeout) clearTimeout(alertTimeout);
    alertTimeout = setTimeout(function () { esconderAlertaVisual(); }, ALERT_CONFIG.TEMPO_ALERTA);
}

// ===================================================================
// ATUALIZAR DISTÂNCIA (mesmo radar, sem re-disparar do zero)
// ===================================================================
function atualizarDistanciaAlerta(distancia) {
    var $text = $("#alert-text");
    /* pega tudo antes do " - " final (preserva "tipo — 60 km") */
    var base = $text.data('alert-base') || $text.text().split(' - ')[0];
    $text.text(base + ' - ' + Math.round(distancia) + ' m');
    

    if (alertTimeout) clearTimeout(alertTimeout);
    alertTimeout = setTimeout(function () { esconderAlertaVisual(); }, ALERT_CONFIG.TEMPO_ALERTA);
}

// ===================================================================
// FECHAR IMEDIATAMENTE (usuário se afastou / mudou de direção)
// ===================================================================
function fecharAlertaImediatamente() {
    if (alertTimeout) { clearTimeout(alertTimeout); alertTimeout = null; }
    $("#alert-container").stop(true, true).hide();
    ajustarPosicaoSpeedWidget(false);
    pararTodosSons();
    cancelarSequenciaSom();
    tipoAlertaAtivo = null;
}

// ===================================================================
// ESCONDER COM ANIMAÇÃO (fim do tempo / passou pelo radar)
// ===================================================================
function esconderAlertaVisual() {
    if (alertTimeout) { clearTimeout(alertTimeout); alertTimeout = null; }
    var tipoAnterior = tipoAlertaAtivo;

    $("#alert-container").fadeOut(200, function () {
        $(this).find(".alert-bar").removeClass(
            'alert-bar-critico alert-bar-risco-critico alert-bar-mobilidade-critico alert-bar-destaque-critico alert-bar-servico-critico'
        );
    });
    ajustarPosicaoSpeedWidget(false);
    pararTodosSons();
    cancelarSequenciaSom();

    if (tipoAnterior && somAlertaHabilitado) {
        silenciarAlertaComBeep(tipoAnterior);
    }
    tipoAlertaAtivo = null;
}

//======================================
// Nova variável — controla APENAS o som
//======================================


var somAlertaHabilitado = true;
//=====================================
// FUNÇÃO VERIFICAR PROXIMIDADE RADARES (sem depender de alertaHabilitado)
//=====================================
function verificarProximidadeRadares() {
    if (radarMarkers.length === 0) return;   // <-- removido "!alertaHabilitado ||"
    let radarMaisProximo = null;
    let menorDistancia = Infinity;
    radarMarkers.forEach(function(marker) {
        const rData = marker.radarData;
        if (!deveAlertaRadar(rData.tipoOriginal)) return;
        const dist = calcularDistancia(userLat, userLng, rData.latitude, rData.longitude);
        if (dist < menorDistancia) { menorDistancia = dist; radarMaisProximo = rData; }
    });
    if (radarMaisProximo && menorDistancia <= ALERT_CONFIG.DISTANCIA_MAXIMA) {
        const direcao = verificarDirecaoMelhorada(userLat, userLng, currentHeading, radarMaisProximo.latitude, radarMaisProximo.longitude, radarMaisProximo.id, menorDistancia);
        if (menorDistancia <= ALERT_CONFIG.DISTANCIA_PASSAR_RADAR) { esconderAlertaVisual(); ultimoRadarAlertado = radarMaisProximo.id; limparHistoricoDistancia(radarMaisProximo.id); return; }
        if (direcao.estaAfastando) { fecharAlertaImediatamente(); limparHistoricoDistancia(radarMaisProximo.id); if (menorDistancia > ALERT_CONFIG.DISTANCIA_MAXIMA - 30) ultimoRadarAlertado = null; return; }
        if (direcao.estaAproximando) {
            if (ultimoRadarAlertado !== radarMaisProximo.id) { dispararAlerta(radarMaisProximo, menorDistancia); }
            else { atualizarDistanciaAlerta(menorDistancia); if (menorDistancia <= ALERT_CONFIG.DISTANCIA_CRITICA) $(".alert-bar").addClass("alert-bar-critico"); }
        }
    } else {
        if ($("#alert-container").is(":visible")) esconderAlertaVisual();
        if (menorDistancia > ALERT_CONFIG.DISTANCIA_MAXIMA + 80) { ultimoRadarAlertado = null; historicoDistanciasRadar = {}; }
    }
}

//============================================
// BOTÃO SILENCIAR — versão única, consolidada
//============================================
function inicializarBotaoAlertaToggle() {
    var alertBtn  = document.getElementById('btn-alert-toggle');
    var alertIcon = document.getElementById('alert-toggle-icon');
    if (!alertBtn) return;

    alertBtn.addEventListener('click', function () {
        somAlertaHabilitado = !somAlertaHabilitado;
        alertaHabilitado = somAlertaHabilitado; // Mantém compatibilidade

        if (somAlertaHabilitado) {
            alertBtn.classList.remove('alert-off');
            if (alertIcon) {
                alertIcon.src = '/imagens_app/ic_sound_on.png';
                alertIcon.onerror = function () { this.src = 'https://cdn-icons-png.flaticon.com/512/727/727245.png'; };
            }
            // Religou o som: se já tem alerta visível na tela, deixa o som voltar a tocar
            // no próximo ciclo, sem esconder a tarja
            if ($("#alert-container").is(":visible")) {
                contagemTocarSom = 0;
            }
            tocarBeepConfirmacao('on');
            showNotification('Som LIGADO');
        } else {
            alertBtn.classList.add('alert-off');
            if (alertIcon) {
                alertIcon.src = '/imagens_app/ic_sound_off.png';
                alertIcon.onerror = function () { this.src = 'https://cdn-icons-png.flaticon.com/512/3398/3398405.png'; };
            }
            // Desligou o som: apenas para o áudio corrente, a tarja continua visível
            pararTodosSons();
            cancelarSequenciaSom();
            tocarBeepConfirmacao('off');
            showNotification('Som DESLIGADO');
        }
        // Nota: propositalmente NÃO chama esconderAlertaVisual() nem
        // esconderAlertaVisualSemBeep() aqui — a tarja não deve ser afetada.
    });
}

// =================================
// BEEPS DE CONFIRMAÇÃO E SILENCIAR 
// =================================

function tocarBeepConfirmacao(estado) {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (estado === 'on') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch(e) {
        console.warn("Beep de confirmação falhou:", e);
    }
}

function silenciarAlertaComBeep(tipoAlerta) {
    cancelarSequenciaSom();

    var ctx;
    try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        _tocarBeep(ctx, tipoAlerta);
        setTimeout(function() {
            if (ctx && ctx.state !== 'closed') {
                ctx.close().catch(function(){});
            }
        }, 600);
    } catch(e) {
        console.warn('[Radar X9] Áudio não suportado para o beep:', e);
        if (ctx) ctx.close().catch(function(){});
    }
}

function _tocarBeep(ctx, tipoAlerta) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipoAlerta === 'risco') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
        osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);

    } else if (tipoAlerta === 'mobilidade') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
        osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.32);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);

    } else if (tipoAlerta === 'destaque') {
        // Som de silêncio específico para DESTAQUE (Mais agudo e contínuo)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    }
        else if (tipoAlerta === 'servico') {
        // Som de silêncio específico para SERVICO (Mais agudo e contínuo)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);

    } else {
        // Som de silêncio padrão para RADAR
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1050, ctx.currentTime);
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
        
        var osc2 = ctx.createOscillator();
        var gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1050, ctx.currentTime + 0.25);
        gain2.gain.setValueAtTime(0.6, ctx.currentTime + 0.25);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.43);
        osc2.start(ctx.currentTime + 0.25);
        osc2.stop(ctx.currentTime + 0.43);
    }
}

// =====================================
// AUDIO ENGINE DESBLOQUEAR AUDIO MOBILE
// =====================================
var _audioCtx = null;
var _audioDesbloqueado = false;

function getAudioCtx() {
    if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return _audioCtx;
}

function desbloquearAudioMobile() {
    if (_audioDesbloqueado) return;
    try {
        var ctx = getAudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume().then(function () {
                _audioDesbloqueado = true;
                console.log('[Radar X9] ✅ AudioContext desbloqueado');
            });
        } else {
            _audioDesbloqueado = true;
        }
    } catch (e) {
        console.error('[Radar X9] Falha ao desbloquear AudioContext:', e);
    }
}

['click', 'touchstart', 'touchend', 'keydown'].forEach(function (evt) {
    document.addEventListener(evt, desbloquearAudioMobile, { once: false, passive: true });
});


//===================================
// ==================================
// DESBLOQUEIO DOS  AUDIOS DE ALERTA 
// ==================================
var _alertSoundsDesbloqueados = false;


function desbloquearAudiosDeAlerta() {
    var ids = ['alert-sound-radar', 'alert-sound-risco', 'alert-sound-aviso', 'alert-sound-destaque', 'alert-sound-servico'];
    var algumDesbloqueado = false;

    ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;

        // Se já está desbloqueado, pula
        if (el._desbloqueado) return;

        el.muted = true;
        el.play().then(function () {
            el.pause();
            el.currentTime = 0;
            el.muted = false;
            el._desbloqueado = true;
            console.log('[Radar X9] Áudio desbloqueado:', id);
        }).catch(function () {
            el.muted = false;
            // Não marcou como desbloqueado → tentará de novo no próximo toque
        });
    });

    // Só considera globalmente desbloqueado se todos existentes já foram
    _alertSoundsDesbloqueados = ids.every(function(id) {
        var el = document.getElementById(id);
        return !el || el._desbloqueado;
    });
}

['click', 'touchstart', 'touchend', 'keydown'].forEach(function (evt) {
    document.addEventListener(evt, desbloquearAudiosDeAlerta, { once: false, passive: true });
});

var _sequenciaSomId = 0;
var _alertaPrincipalEstaTocando = false;
var _soundListeners = {};
var contagemTocarSom = 0;

function cancelarSequenciaSom() {
    _sequenciaSomId++;
    _alertaPrincipalEstaTocando = false;
    ['alert-sound-radar', 'alert-sound-risco', 'alert-sound-aviso', 'alert-sound-destaque', 'alert-sound-servico'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el && _soundListeners[id]) {
            el.removeEventListener('ended', _soundListeners[id]);
            delete _soundListeners[id];
            el.pause();
            el.currentTime = 0;
        }
    });
}

function pararTodosSons() {
    cancelarSequenciaSom();
    _alertaPrincipalEstaTocando = false; // ← ADICIONAR ISSO
    ['alert-sound-radar', 'alert-sound-risco', 'alert-sound-aviso', 'alert-sound-destaque', 'alert-sound-servico'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.pause();
            el.currentTime = 0;
        }
    });
}

//=============================
// PORTA DE DISPARO DOS ÁUDIOS 
//=============================
function tocarSomAlerta(tipoAlerta) {
    if (!somAlertaHabilitado) return;

    // App Inventor (não quebra se der erro)
    try {
        if (typeof enviarAlertaSonoroParaAppInventor === 'function') {
            enviarAlertaSonoroParaAppInventor(tipoAlerta);
        }
    } catch(e) {}

    if (_alertaPrincipalEstaTocando) {
        console.log('[Radar X9] Som já tocando, ignorando...');
        return;
    }

    var soundId = 'alert-sound-radar';
    if (tipoAlerta === 'risco')      soundId = 'alert-sound-risco';
    else if (tipoAlerta === 'mobilidade') soundId = 'alert-sound-aviso';
    else if (tipoAlerta === 'destaque') soundId = 'alert-sound-destaque';
    else if (tipoAlerta === 'servico') soundId = 'alert-sound-servico';

    var sound = document.getElementById(soundId)
             || document.getElementById('alert-sound-radar');

    if (!sound) {
        console.error('[Radar X9] ERRO: Elemento <audio> não encontrado:', soundId);
        return;
    }

    // Se o áudio não carregou, loga mas tenta mesmo assim
    if (sound.readyState === 0) {
        console.warn('[Radar X9] Áudio ainda não carregou (readyState=0):', soundId);
    }

    _sequenciaSomId++;
    var meuId = _sequenciaSomId;
    _alertaPrincipalEstaTocando = true;

    // SAFETY TIMEOUT: se travar, libera em 8 segundos
    var safetyTimer = setTimeout(function() {
        if (meuId === _sequenciaSomId && _alertaPrincipalEstaTocando) {
            console.warn('[Radar X9] Safety timeout liberou áudio travado');
            _alertaPrincipalEstaTocando = false;
            if (_soundListeners[soundId]) {
                sound.removeEventListener('ended', _soundListeners[soundId]);
                delete _soundListeners[soundId];
            }
        }
    }, 8000);

    var toques = 0;
    var numToques = 3;

    // Limpa listener anterior do mesmo elemento
    if (_soundListeners[soundId]) {
        sound.removeEventListener('ended', _soundListeners[soundId]);
        delete _soundListeners[soundId];
    }

    function onEnded() {
        clearTimeout(safetyTimer);
        if (meuId !== _sequenciaSomId) {
            _alertaPrincipalEstaTocando = false;
            return;
        }
        toques++;
        if (toques < numToques) {
            sound.currentTime = 0;
            sound.play().catch(function(err) {
                console.error('[Radar X9] Falha no toque', toques+1, ':', err);
                _alertaPrincipalEstaTocando = false;
            });
        } else {
            sound.removeEventListener('ended', onEnded);
            delete _soundListeners[soundId];
            _alertaPrincipalEstaTocando = false;
        }
    }

    _soundListeners[soundId] = onEnded;
    sound.addEventListener('ended', onEnded);

    sound.currentTime = 0;
    sound.play().catch(function(err) {
        clearTimeout(safetyTimer);
        console.error('[Radar X9] Falha ao iniciar áudio:', err);
        sound.removeEventListener('ended', onEnded);
        delete _soundListeners[soundId];
        _alertaPrincipalEstaTocando = false;
    });
}

//====================================================================
// ===================================================================
// FUNÇÃO PARA ANIMAR O BOTÃO ADICIONAR RADAR
// ===================================================================
function animarBotaoRadar(status) {
    const btn = document.getElementById('btn-add-radar');
    const icon = btn.querySelector('.plus-icon');

    if (status === 'adicionado') {
        icon.textContent = '✓';
        btn.style.background = 'linear-gradient(135deg, #ffa500, #ff8c00)';
        btn.style.transform = 'scale(1.15)';
        btn.style.boxShadow = '0 0 40px rgba(255, 165, 0, 0.9)';
        btn.style.borderColor = '#ffa500';
        btn.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

        setTimeout(() => {
            icon.textContent = '+';
            btn.style.background = 'linear-gradient(135deg, #00cc66, #00994d)';
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 20px rgba(0, 204, 102, 0.5)';
            btn.style.borderColor = 'rgba(0, 255, 136, 0.4)';
        }, 2000);
    } else if (status === 'erro') {
        icon.textContent = '✗';
        btn.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
        btn.style.transform = 'scale(1.1)';
        btn.style.boxShadow = '0 0 40px rgba(255, 0, 0, 0.6)';
        btn.style.borderColor = '#ff0000';
        btn.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

        setTimeout(() => {
            icon.textContent = '+';
            btn.style.background = 'linear-gradient(135deg, #00cc66, #00994d)';
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 20px rgba(0, 204, 102, 0.5)';
            btn.style.borderColor = 'rgba(0, 255, 136, 0.4)';
        }, 2000);
    }
}

// ===================================================================
// CRIAR TARJA RADARES CURADOS NO MAPA
// ===================================================================
function criarRadarNoMapa(radarData) {
    if (!map) {
        console.warn('[Radar X9] ⚠️ Mapa não inicializado ao criar radar');
        return null;
    }

    console.log('[Radar X9] 📍 Criando radar no mapa:', radarData);

    const iconeUrl = getIconUrl(radarData.tipo, radarData.velocidade);
    const fallbackUrl = '/imagens_app/ic_radar_cev_v2.png';
    const iconeRadar = criarIconeRadar(iconeUrl, 40, fallbackUrl);

    const radarMarker = L.marker([radarData.latitude, radarData.longitude], {
        icon: iconeRadar,
        zIndexOffset: 1000
    }).addTo(map);

    const tipoExibicao = ajusteNomes[radarData.tipo] || radarData.tipo;
    const velInfo = radarData.velocidade ? ` | ${radarData.velocidade} km/h` : '';

    // >>> ADICIONADO: selo de origem, igual ao que renderizarRadaresNoMapa já faz
    const seloUsuario = radarData.isUsuario
        ? '<div style="color:#00cc66;font-size:0.75rem;margin-top:4px;">🧩 Compartilhado por usuários</div>'
        : '';

    const popupContent = `
        <div style="color:#222; font-family:'Inter'; text-align:center; min-width:200px;">
            <b>${tipoExibicao}</b><br>
            <hr style="border:0; border-top:1px solid #ddd; margin:5px 0;">
            ${radarData.endereco || 'Endereço não informado'}<br>
            <div style="color:#d00; font-weight:bold; margin-top:5px;">Máx: ${radarData.velocidade || 'N/A'} km/h</div>
            ${seloUsuario}
        </div>
    `;
    radarMarker.bindPopup(popupContent);

    radarMarker.radarData = {
        id: radarData.id || radarMarkers.length,
        latitude: radarData.latitude,
        longitude: radarData.longitude,
        endereco: radarData.endereco,
        velocidade_maxima: radarData.velocidade,
        tipoOriginal: radarData.tipo,
        tipoExibicao: tipoExibicao,
        isIA: tipoExibicao.includes('OCR') || tipoExibicao.includes('FACIAL'),
        isUsuario: !!radarData.isUsuario   // >>> ADICIONADO
    };

    console.log('[Radar X9] ✅ Radar criado no mapa com sucesso!');
    return radarMarker;
}
    

// ===================================================================
// INICIALIZAÇÃO DO MAPA E CONTROLES
// ===================================================================
async function initMap() {
    console.log('[Radar X9] 🚀 Inicializando aplicação...');
    
    // Carregar configuração do GitHub
    await carregarConfigGitHub();
    console.log("CONFIG:", GITHUB_CONFIG);
    // Carregar pendentes salvos localmente (se existirem)
    carregarRadaresPendentes();
    
    if (typeof L === 'undefined') { 
        hideFullscreenLoading(); 
        showNotification("Erro de conexão. Os mapas não puderam carregar."); 
        return; 
    }

    // No seu código HTML
    function updateMap(lat, lon) {
    // Atualiza o mapa aqui
    console.log("Nova localização:", lat, lon);

}
    //=============================
    // CONFIGURAÇÃO INICIAL DO MAPA
    //=============================
    map = L.map('map', {
     center: [userLat, userLng],
      zoom: 18,
       zoomControl: false,
        rotate: true,
         bearing: 0 });
    if (typeof map.setBearing !== 'function') console.warn('[Radar X9] AVISO: leaflet-rotate pode não ter carregado.');
    aplicarTemaMapa();
    setInterval(aplicarTemaMapa, 300000);
    inicializarBussolaHardware();

// ==========================
// RECENTRALIZAR MAPA
// ==========================

let mapaCentralizado = true;
let recentragemTimeout = null; // timer da recentragem automática

const speedWidget = document.getElementById("speedWidget");
const speedIcon = document.getElementById("speedIcon");

// Função chamada quando o usuário arrasta o mapa com o mouse ou dedo
function desativarCentralizacao(){
    if (mapaCentralizado) {
        console.log("ARRASTOU O MAPA - Desativando centralização");
        mapaCentralizado = false;

        // Troca o ícone para o botão de recentralizar
        speedIcon.src = "/imagens_app/ic_recentralizar.png";

        // Adiciona a classe visual (caso tenha animação de pulse no CSS)
        speedWidget.classList.add("recentralizar");
    }

    // Toda vez que o usuário arrasta, (re)inicia a contagem dos 5s.
    // Se ele arrastar de novo antes do tempo acabar, o timer reinicia.
    agendarRecentragemAutomatica();
}

// Agenda a recentralização automática após 5s sem novo arraste
function agendarRecentragemAutomatica(){
    if (recentragemTimeout) clearTimeout(recentragemTimeout);

    recentragemTimeout = setTimeout(function () {
        recentralizarMapa();
    }, 10000);
}

// Função chamada quando o usuário clica no botão OU quando o timer de 5s dispara
function recentralizarMapa(){
    if (mapaCentralizado) return; // Já está centralizado, não faz nada

    // Cancela qualquer timer pendente (evita chamada dupla se o botão for clicado antes do timeout)
    if (recentragemTimeout) {
        clearTimeout(recentragemTimeout);
        recentragemTimeout = null;
    }

    console.log("RECENTRALIZANDO MAPA");
    mapaCentralizado = true;

    // Volta para a posição do usuário
    map.flyTo(
        [userLat, userLng],
        map.getZoom(),
        {
            animate: true,
            duration: 0.6
        }
    );

    // Troca o ícone de volta para o padrão
    speedIcon.src = "/imagens_app/ic_speed_limit.png";

    // Remove a classe visual
    speedWidget.classList.remove("recentralizar");
}

// ==========================================
// EVENTOS DO LEAFLET (APENAS ARRASTAR)
// ==========================================

// O usuário ARRASTOU o mapa com mouse ou toque
map.on("dragstart", desativarCentralizacao);

// Clique no botão de recentralizar
speedWidget.addEventListener("click", () => {
    if (!mapaCentralizado) {
        recentralizarMapa();
    }
});


// ========================================
// OCULTAR BÚSSOLA NATIVA DO LEAFLET
// ========================================

function ocultarBussolaLeaflet() {
    $(".leaflet-control-compass").css("display", "none");
}

// Executa após o carregamento
setTimeout(ocultarBussolaLeaflet, 100);

// Reforça depois
setTimeout(ocultarBussolaLeaflet, 500);
setTimeout(ocultarBussolaLeaflet, 1000);

ocultarBussolaLeaflet();

//============================
// BOTÃO DE CRIAÇÃO DE ROTA
//============================
// Variáveis globais
var gpsActive = true;        // Controla o GPS
var routeSearchActive = false; // Controla a barra de pesquisa

//============================
// BOTÃO DE CRIAÇÃO DE ROTA
//============================

$("#btn-calc-route").click(async function() {

    var endereco = $("#route-query").val().trim();

    if (endereco.length < 5) {
        showNotification("Digite um endereço válido.");
        return;
    }

    $("#loading").show().html(
        "<div class='loading-spinner'></div><div>Calculando rota...</div>"
    );

    var coords = await buscarCoordenadas(endereco);

    if (coords) {

        esconderAlertaVisual();

        // Recolhe a barra de pesquisa de rota (NÃO afeta o GPS)
        routeSearchActive = false;  // ← variável separada
        $("#search-bar-rota").removeClass("active");

        // Retira o foco do campo
        $("#route-query").blur();

        // MOSTRA AS INFORMAÇÕES DA ROTA
        $("#nav-info").css("display", "flex");

        // Cria a rota
        criarRota(coords.lat, coords.lng);

    } else {

        $("#loading").hide();
        showNotification("Endereço não encontrado.");
    }
});

//============================
// ENTER = CRIAR ROTA
//============================

$("#route-query").keypress(function(e) {
    if (e.which == 13) {
        // Executa o cálculo da rota
        $("#btn-calc-route").click();
    }
});


    //=======================
    //FECHAR TODAS AS BARRAS
    //======================

   function fecharTodasBarras() {

    searchActive = false;
    routeActive = false;

    var barraRadar =
        document.getElementById('search-bar-radares');

    var barraRota =
        document.getElementById('search-bar-rota');

    if (barraRadar) {
        barraRadar.classList.remove('active');
    }

    if (barraRota) {
        barraRota.classList.remove('active');
    }

    ajustarBussolaParaBusca(false);
}

//==========================
//BOTÃO DE BUSCA RADAR BARRA
//==========================
    $("#btn-search-radar").click(function() { 
        buscarRadares(            
            $("#query").val()); 
            $("#nav-info").css("display", "none");
        });

    $("#query").keypress(function(e) { 
        if (e.which == 13) buscarRadares(
            $("#query").val()); 
            
        });


    $("#btn-search-bar").click(function() {
        if (searchActive) { 
            fecharTodasBarras(); 
            return; 
        }
        if (routeActive) routeActive = false; 
        searchActive = true;
        $("#search-bar-rota").removeClass('active'); 
        $("#search-bar-radares").addClass('active');
        if (!sidebarAberta) { sidebarAberta = true; document.getElementById('sidebar-controls').classList.remove('retracted'); document.getElementById('btn-menu-toggle').classList.remove('active'); }
        setTimeout(function() { $("#query").focus(); }, 300);
        ajustarBussolaParaBusca(true);
    });
    
  //====================
//BOTÃO LATERAL DE ROTA
//=====================

    $("#btn-route-bar").click(function() {

    if (routeActive) {
        fecharTodasBarras();
        return;
    }

    if (searchActive) {
        searchActive = false;
    }

    routeActive = true;

    $("#search-bar-radares").removeClass("active");
    $("#search-bar-rota").addClass("active");

    if (!sidebarAberta) {
        sidebarAberta = true;

        document
            .getElementById('sidebar-controls')
            .classList.remove('retracted');

        document
            .getElementById('btn-menu-toggle')
            .classList.remove('active');
    }

    setTimeout(function() {
        $("#route-query").focus();
    }, 300);

    ajustarBussolaParaBusca(true);
});

//===================================================================================
// BOTÃO CENTRALIZAR = CENTRALIZA + MOSTRA GPS MARKER + DEPOIS MUDA PARA NAVIGATOR MAP
//====================================================================================
$("#btn-center").click(function() {

    fecharTodasBarras();
    isFollowing = true;

    if (!userMarker) {
        showNotification("Aguardando sinal GPS...");
        return;
    }
    $("#nav-info").css("display", "none");
    // Centraliza o mapa na posição atual
    map.flyTo(userMarker.getLatLng(), 18, {
        duration: 0.5
    });

    showNotification("Centralizando na sua posição");


    //==============================================================
    // REMOVE E RECRIA O MARCADOR COM GPS MARKER
    //==============================================================
    if (!estaEmNavegacao && userMarker) {

        // Guarda a posição atual
        var pos = userMarker.getLatLng();

        // Remove marcador atual
        map.removeLayer(userMarker);


        //==========================================================
        // 1º PASSO — ÍCONE GPS MARKER
        //==========================================================
     

// 1. Verifica se as coordenadas são válidas (NÃO são undefined)
if (pos.lat === undefined || pos.lng === undefined || isNaN(pos.lat) || isNaN(pos.lng)) {
    console.error("❌ Coordenadas inválidas para o marcador!", pos);
    return; // Interrompe a execução para não quebrar o mapa
}

console.log("✅ Coordenadas válidas recebidas:", pos.lat, pos.lng);

var gpsIcon = L.divIcon({
    html: '<img src="/imagens_app/ic_gps_marker.png" ' +
          'onerror="this.onerror=null; this.src=\'https://cdn-icons-png.flaticon.com/512/684/684908.png\';" ' +
          'style="width:50px; height:50px; display:block;">', // display:block evita espaços fantasmas

    className: 'user-gps-marker',
    iconSize: [50, 50],
    iconAnchor: [25, 25],      // ← ALTERADO: Centro exato da imagem 50x50 é mais seguro
    popupAnchor: [0, -25]      // ← ALTERADO: Ajustado para o novo anchor
});

// 2. Cria e adiciona o marcador
userMarker = L.marker(
    [pos.lat, pos.lng],
    {
        icon: gpsIcon,
        zIndexOffset: 1000
    }
).addTo(map);

userMarker.bindTooltip('Você está aqui', {
    permanent: false,
    direction: 'top',
    offset: [0, -25]
});

iconeCentralizado = true;
console.log("📍 GPS MARKER inserido no mapa com sucesso!");


//==========================================================
// 2º PASSO — APÓS INSERIR O GPS MARKER, MUDA PARA NAVIGATOR MAP
//==========================================================
setTimeout(function() {
    // Garante que ainda existe marcador e não estamos em modo navegação
    if (!userMarker || estaEmNavegacao) {
        console.log("⏭️ Ignorando troca de ícone (sem marcador ou em navegação)");
        return;
    }

    try {
        // Guarda novamente a posição
        var posAtual = userMarker.getLatLng();

        // Remove GPS MARKER antigo
        map.removeLayer(userMarker);

        // Cria o ícone do navegador
        var navIcon = criarIconeNavegador(false);

        // Cria novamente o marcador com o novo ícone
        userMarker = L.marker(
            [posAtual.lat, posAtual.lng],
            {
                icon: navIcon,
                zIndexOffset: 1000
            }
        ).addTo(map);

        userMarker.bindTooltip('Você está aqui', {
            permanent: false,
            direction: 'top',
            offset: [0, -25]
        });

        iconeCentralizado = false;
        console.log("🧭 GPS MARKER → NAVIGATOR MAP (Troca realizada)");
        
    } catch (error) {
        console.error("❌ Erro ao trocar para Navigator Map:", error);
    }

}, 1500); // ← ALTERADO: De 600ms para 1500ms. Dá tempo do ícone aparecer antes de trocar!
    }
});

     //==============
    // BOTÃO REFRESH
    //=============== 
$("#btn-refresh").click(function() { 
    resetarMapa(); 
    carregarRadares(); 
    $("#nav-info").css("display", "none");
    
    // RESETA O ALERTA DE NORMALIDADE PARA APARECER NO REFRESH
    alertaNormalidadeMostrado = false;
    
    // REMOVE E RECRIA O MARCADOR COM ÍCONE DE NAVEGADOR
    if (!estaEmNavegacao && userMarker) {
        // Guarda a posição atual
        var pos = userMarker.getLatLng();
        
        // Remove o marcador antigo
        map.removeLayer(userMarker);
        
        //marcador com o ícone de navegador pulsante
        var navIcon = criarIconeNavegador(false);
        
        userMarker = L.marker([pos.lat, pos.lng], { 
            icon: navIcon, 
            zIndexOffset: 1000 
        }).addTo(map);
        userMarker.bindTooltip('Você está aqui', { permanent: false, direction: 'top', offset: [0, -25] });
        
        iconeCentralizado = false;
        console.log("🔄 Ícone voltou para NAVIGATOR MAP (refresh)");
    }

    //=====================================================
    // Força a verificação do clima novamente após o refresh
    //======================================================
    setTimeout(() => {
        atualizarTemperatura();
    }, 1000);
});
    
    
    $("#btn-zoom-in").click(function() { if (map) map.zoomIn(); });
    $("#btn-zoom-out").click(function() { if (map) map.zoomOut(); });
    
    


// ===================================================================
// INICIALIÇÃO GERAL E CARREGAMENTOS DE FUNÇÕES
// ===================================================================
    inicializarBotaoRotacaoMapa();
    inicializarBotaoAlertaToggle();
    inicializarBotaoAddRadar();
    inicializarMenuToggle();
    startGPSTracking();
    carregarRadares();
    
    console.log('[Radar X9] ✅ Aplicação inicializada com sucesso!');
}



// ============================================================
// MOSTRAR INFORMAÇÕES DA NAVEGAÇÃO
// ============================================================
function mostrarInfoNavegacao(distancia, tempo) {
    var painel = document.getElementById('nav-info');
    var distanciaEl = document.getElementById('nav-distance');
    var tempoEl = document.getElementById('nav-time');
    var chegadaEl = document.getElementById('nav-arrival');

    if (!painel || !distanciaEl || !tempoEl) {
        console.error('[Radar X9] Elementos da navegação não encontrados');
        return;
    }

    // Formata distância com vírgula
    distanciaEl.textContent = '🚗 ' + String(distancia).replace('.', ',') + ' km';
    tempoEl.textContent = tempo + ' min';

    // Calcula horário previsto de chegada
    if (chegadaEl && tempo > 0) {
        var chegada = new Date(Date.now() + (tempo * 60 * 1000));
        var horas = String(chegada.getHours()).padStart(2, '0');
        var minutos = String(chegada.getMinutes()).padStart(2, '0');
        chegadaEl.textContent = '🏁 Chegada: ' + horas + ':' + minutos;
    }

    // Torna visível
    painel.classList.add('visible');
    console.log('[Radar X9] Painel navegação atualizado:', distancia, 'km |', tempo, 'min');
}

// ============================================================
// OCULTAR INFORMAÇÕES DA NAVEGAÇÃO
// ============================================================
function ocultarInfoNavegacao() {

    var painel = document.getElementById('nav-info');

    if (painel) {
        painel.classList.remove('visible');
    }
}

// ===================================================================
// MODAL ADICIONAR RADAR E CAPTURA DE POSIÇÃO 
// ===================================================================
function openAddRadarModal() {
    document.getElementById('modal-add-radar').classList.add('active');
    selectedSpeed=''; selectedType=''; radarLat=null; radarLng=null; 
    document.getElementById('radar-type').value='';
    document.getElementById('radar-address').value='';
    document.getElementById('icon-preview-group').style.display='none';
    document.querySelectorAll('.speed-btn').forEach(b=>b.className='speed-btn');
    
    // Reset do botão e lacunas de captura
    const btnCap = document.getElementById('btn-capture-location');
    btnCap.textContent = '📍 Capturar Posição Atual';
    btnCap.classList.remove('captured');
    
    document.getElementById('coords-inputs-container').style.display = 'none';
    document.getElementById('pos-lat').value = '';
    document.getElementById('pos-lng').value = '';
    document.getElementById('pos-status').textContent = 'Clique acima para inserir as coordenadas.';
}

// ===================================================================
// CAPTURAR POSIÇÃO 
// ===================================================================
function capturarPosicaoRadar() {
    // 1. Mostra as lacunas IMEDIATAMENTE ao clicar
    document.getElementById('coords-inputs-container').style.display = 'flex';
    
    const btnCap = document.getElementById('btn-capture-location');
    btnCap.classList.add('captured');

    // 2. Se o GPS ainda não pegou a posição, avisa e para aqui
    if (!gpsInitialized) { 
        showNotification('Aguardando sinal GPS...'); 
        document.getElementById('pos-lat').value = '';
        document.getElementById('pos-lng').value = '';
        document.getElementById('pos-status').textContent = 'Aguardando sinal GPS...';
        btnCap.textContent = '⏳ Aguardando GPS...';
        return; 
    }
    
    // 3. Captura a posição exata do momento do clique (usando userLat/userLng globais)
    const lat = userLat;
    const lng = userLng;

    // 4. Preenche os valores dentro dos inputs
    document.getElementById('pos-lat').value = lat.toFixed(6);
    document.getElementById('pos-lng').value = lng.toFixed(6);
    
    // 5. Atualiza o status de precisão
    document.getElementById('pos-status').textContent = 'Precisão: ' + Math.round(gpsAccuracyAtual || 0) + 'm';

    // 6. Muda o visual do botão para "Capturado"
    btnCap.textContent = '✅ Posição Capturada!';

    // 7. Busca endereço automaticamente
    document.getElementById('radar-address').value = 'Buscando endereço...';
    obterEndereco(lat, lng).then(end => {
        document.getElementById('radar-address').value = end || 'Endereço não encontrado';
    });
}

// Função para obter endereço via reverse geocoding
async function obterEndereco(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'RadarX9/1.0' } }
        );
        if (!response.ok) throw new Error('Erro na geocodificação');
        const data = await response.json();
        if (data && data.display_name) {
            const partes = data.display_name.split(',');
            return partes.slice(0, 3).join(',').trim();
        }
        return null;
    } catch (error) {
        console.warn('[Radar X9] Erro na geocodificação reversa:', error);
        return null;
    }
}

// ===================================================================
// MENU TOGGLE
// ===================================================================
function inicializarMenuToggle() {
    var btnMenu = document.getElementById('btn-menu-toggle');
    var sidebar = document.getElementById('sidebar-controls');
    var menuDropdown = document.getElementById('menu-dropdown');

    btnMenu.addEventListener('click', function(e) {
        e.stopPropagation();

        // Toggle do menu dropdown
        if (menuDropdown) {
            var isVisible = menuDropdown.style.display === 'block';
            menuDropdown.style.display = isVisible ? 'none' : 'block';
            btnMenu.classList.toggle('active', !isVisible);

            // Atualizar status do GitHub
            if (!isVisible) {
                atualizarStatusGitHub();
            }
        }

        // Também controla a sidebar
        sidebarAberta = !sidebarAberta;
        if (sidebarAberta) {
            sidebar.classList.remove('retracted');
        } else {
            sidebar.classList.add('retracted');
            if (searchActive || routeActive) {
                searchActive = false;
                routeActive = false;
                document.getElementById('search-bar-radares').classList.remove('active');
                document.getElementById('search-bar-rota').classList.remove('active');
                ajustarBussolaParaBusca(false);
            }
        }
    });

    // Fechar menu ao clicar fora
    document.addEventListener('click', function(e) {
        if (menuDropdown && !menuDropdown.contains(e.target) && e.target !== btnMenu && !btnMenu.contains(e.target)) {
            menuDropdown.style.display = 'none';
            btnMenu.classList.remove('active');
        }
    });}

function atualizarStatusGitHub() {
    var statusText = document.getElementById('status-github-text');
    if (!statusText) return;

    if (RADAR_MODO_OFFLINE) {
        statusText.textContent = 'Offline';
        statusText.style.color = '#ff4444';
    } else if (GITHUB_CONFIG.token) {
        statusText.textContent = 'Conectado';
        statusText.style.color = '#00cc66';
    } else {
        statusText.textContent = 'Não configurado';
        statusText.style.color = '#ffc107';
    }
}


function abrirModalConfigGithub() {
    var modal = document.getElementById('modal-config-github');
    if (!modal) return;

    // Preencher campos com valores atuais
    document.getElementById('github-token').value = GITHUB_CONFIG.token || '';
    document.getElementById('github-owner').value = GITHUB_CONFIG.owner || 'seabhra';
    document.getElementById('github-repo').value = GITHUB_CONFIG.repo || 'radar-speed-alert-api';
    document.getElementById('github-path').value = GITHUB_CONFIG.path || 'radares.json';
    document.getElementById('github-app-path').value = GITHUB_CONFIG.appPath || 'radares_app.json';
    document.getElementById('github-proxy').value = GITHUB_CONFIG.proxyUrl || '';

    modal.classList.add('active');

    // Fechar modal
    document.getElementById('modal-config-close').addEventListener('click', function() {
        modal.classList.remove('active');
    });

    // Salvar configuração
    document.getElementById('btn-save-github-config').addEventListener('click', async function() {
        var config = {
            token: document.getElementById('github-token').value.trim(),
            owner: document.getElementById('github-owner').value.trim() || 'seabhra',
            repo: document.getElementById('github-repo').value.trim() || 'radar-speed-alert-api',
            path: document.getElementById('github-path').value.trim() || 'radares.json',
            appPath: document.getElementById('github-app-path').value.trim() || 'radares_app.json',
            proxyUrl: document.getElementById('github-proxy').value.trim()
        };

        if (!config.token) {
            document.getElementById('config-status-msg').textContent = '❌ Token é obrigatório!';
            document.getElementById('config-status-msg').className = 'config-status erro';
            return;
        }

        salvarConfigGitHub(config);

        document.getElementById('config-status-msg').textContent = '🔄 Validando credenciais no GitHub...';
        document.getElementById('config-status-msg').className = 'config-status aviso';

        try {
            const branch = await obterBranchPadrao();
            document.getElementById('config-status-msg').textContent =
                `✅ Conectado! Repositório encontrado (branch: ${branch}).`;
            document.getElementById('config-status-msg').className = 'config-status ok';

            setTimeout(function() {
                modal.classList.remove('active');
                carregarRadares(); // Recarregar do GitHub
            }, 1500);
        } catch (validationError) {
            document.getElementById('config-status-msg').textContent =
                '❌ Falha ao validar: ' + validationError.message;
            document.getElementById('config-status-msg').className = 'config-status erro';
            console.error('[Radar X9] Validação de config GitHub falhou:', validationError);
        }
    });

    // Fechar ao clicar fora
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('active');
    });
}

// ===================================================================
// INICIALIZAR BOTÃO ROTAÇÃO
// ===================================================================
function inicializarBotaoRotacaoMapa() {
    const rotateBtn = document.getElementById('btn-rotate-map');
    const rotateBtnIcon = document.getElementById('rotate-btn-icon');
    if (!rotateBtn) return;
    
    if (rotateBtnIcon) {
        rotateBtnIcon.src = "/imagens_app/ic_girado_map.png";
        rotateBtnIcon.onerror = function() { this.src = 'https://cdn-icons-png.flaticon.com/512/3089/3089803.png'; };
    }
    
    if (typeof map !== 'undefined' && map && typeof map.setBearing !== 'function') {
        console.error('[Radar X9] ERRO: leaflet-rotate NÃO carregou!');
        rotateBtn.style.opacity = '0.3'; rotateBtn.style.pointerEvents = 'none';
        rotateBtn.title = 'Rotação indisponível'; showNotification('Plugin de rotação não carregou.'); return;
    }
    
    rotateBtn.addEventListener('click', async function () {
        if (!map || typeof map.setBearing !== 'function') return;
        if (!bussolaHardwareDisponivel) { await solicitarPermissaoBussolaIOS(); }
        
        if (!mapaRotacionado) {
            mapaRotacionado = true;
            var anguloRotacao = (currentHeading > 0 && currentHeading < 360) ? currentHeading : 0;
            bearingAlvo = anguloRotacao; bearingAtual = anguloRotacao;
            map.setBearing(anguloRotacao); rotateBtn.classList.add('rotated');
            
            if (rotateBtnIcon) {
                rotateBtnIcon.src = "/imagens_app/ic_girar_map.png";
                rotateBtnIcon.onerror = function() { this.src = 'https://cdn-icons-png.flaticon.com/512/3089/3089803.png'; };
                rotateBtnIcon.style.transform = 'rotate(' + anguloRotacao + 'deg)';
            }
            
            if (bussolaHardwareDisponivel) showNotification('Mapa rotacionado — bússola ativa');
            else if (currentHeading > 0) showNotification('Mapa rotacionado ' + Math.round(currentHeading) + '° (GPS)');
            else showNotification('Mapa rotacionado — aguardando direção...');
        } else {
            mapaRotacionado = false; bearingAlvo = 0; bearingAtual = 0;
            map.setBearing(0); rotateBtn.classList.remove('rotated');
            
            if (rotateBtnIcon) {
                rotateBtnIcon.src = "/imagens_app/ic_girado_map.png";
                rotateBtnIcon.onerror = function() { this.src = 'https://cdn-icons-png.flaticon.com/512/3089/3089803.png'; };
                rotateBtnIcon.style.transform = 'rotate(0deg)';
            }
            showNotification('Mapa resetado (Norte para cima)');
        }
    });
}

// ===================================================================
// INICIALIZAR BOTÃO ADICIONAR RADAR - CORRIGIDO
// ===================================================================
function inicializarBotaoAddRadar() {
    const btnAddRadar = document.getElementById('btn-add-radar');
    const modalAddRadar = document.getElementById('modal-add-radar');
    const btnModalClose = document.getElementById('modal-close');
    const btnSubmitRadar = document.getElementById('btn-submit-radar');
    const radarType = document.getElementById('radar-type');
    const radarAddress = document.getElementById('radar-address');
    const posLat = document.getElementById('pos-lat');
    const posLng = document.getElementById('pos-lng');
    const posStatus = document.getElementById('pos-status');
    const iconPreviewGroup = document.getElementById('icon-preview-group');
    const iconPreviewImg = document.getElementById('icon-preview-img');
    const iconPreviewName = document.getElementById('icon-preview-name');
    const speedButtons = document.querySelectorAll('.speed-btn');
    const btnCaptureLocation = document.getElementById('btn-capture-location');
     const btnMenuToggle = document.getElementById('btn-menu-toggle');


    let currentPosition = { lat: null, lng: null };
    let gpsObtido = false;
    let tipoAtual = '';

    // [CORREÇÃO] Listener do botão de captura de posição
    btnCaptureLocation.addEventListener('click', function() {
        // Mostra as lacunas IMEDIATAMENTE
        document.getElementById('coords-inputs-container').style.display = 'flex';
        btnCaptureLocation.classList.add('captured');

        if (!gpsInitialized) {
            showNotification('Aguardando sinal GPS...');
            document.getElementById('pos-lat').value = '';
            document.getElementById('pos-lng').value = '';
            posStatus.textContent = 'Aguardando sinal GPS...';
            btnCaptureLocation.textContent = '⏳ Aguardando GPS...';
            return;
        }

        // Usa a posição global atual
        const lat = userLat;
        const lng = userLng;

        document.getElementById('pos-lat').value = lat.toFixed(6);
        document.getElementById('pos-lng').value = lng.toFixed(6);
        posStatus.textContent = 'Precisão: ' + Math.round(gpsAccuracyAtual || 0) + 'm';
        btnCaptureLocation.textContent = '✅ Posição Capturada!';

        currentPosition.lat = lat;
        currentPosition.lng = lng;
        gpsObtido = true;

        // Busca endereço automaticamente
        document.getElementById('radar-address').value = 'Buscando endereço...';
        obterEndereco(lat, lng).then(end => {
            document.getElementById('radar-address').value = end || 'Endereço não encontrado';
        });
    });

    // Configurar botões de velocidade
    speedButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const velocidade = this.dataset.speed;
            speedButtons.forEach(b => {
                b.classList.remove('selected', 'selected-30', 'selected-40', 'selected-50', 'selected-60',
                                  'selected-70', 'selected-80', 'selected-100', 'selected-110');
            });
            this.classList.add('selected', `selected-${velocidade}`);
            atualizarPreviewIcone(tipoAtual, velocidade);
        });
    });

    function atualizarPreviewIcone(tipo, velocidade) {
        if (!tipo) {
            iconPreviewGroup.style.display = 'none';
            return;
        }
        const iconUrl = getIconUrl(tipo, velocidade || '');
        if (iconUrl) {
            iconPreviewImg.src = iconUrl;
            iconPreviewImg.onerror = function() {
                this.src = '/imagens_app/ic_radar_cev_v2.png';
            };
            const speedBtnAtual = document.querySelector('.speed-btn.selected');
            const vel = velocidade || (speedBtnAtual ? speedBtnAtual.dataset.speed : '') || '';
            iconPreviewName.textContent = vel ? `${tipo} - ${vel} km/h` : tipo;
            iconPreviewGroup.style.display = 'block';
        } else {
            iconPreviewGroup.style.display = 'none';
        }
    }

    async function buscarEnderecoPorCoordenadas(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { headers: { 'User-Agent': 'RadarX9/1.0' } }
            );
            if (!response.ok) throw new Error('Erro na geocodificação');
            const data = await response.json();
            if (data && data.display_name) {
                const partes = data.display_name.split(',');
                return partes.slice(0, 3).join(',').trim();
            }
            return null;
        } catch (error) {
            console.warn('[Radar X9] Erro na geocodificação reversa:', error);
            return null;
        }
    }


// =====================================
// RECEBER GPS ATUALIZALIÇÃO LOCALIZAÇÃO
// =====================================

function atualizarLocalizacao(lat, lon) {
    // Valida os dados
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
        console.warn("⚠️ Coordenadas inválidas recebidas:", lat, lon);
        return false;
    }
    
    // Evita coordenadas padrão (ex: Belo Horizonte)
    if (lat === -19.919055 && lon === -43.938641) {
        console.log("⏳ Coordenadas padrão, aguardando GPS real...");
        return false;
    }
    
    console.log("📡 GPS Atualizado:", lat, lon);
    
    // Atualiza variáveis globais
    window.userLat = lat;
    window.userLng = lon;
    window.gpsInitialized = true;
    window.ultimaAtualizacao = Date.now();
    
    // Atualiza UI se existir
    const posStatus = document.getElementById('posStatus');
    if (posStatus) {
        posStatus.textContent = `✅ GPS: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        posStatus.style.color = '#00ff00';
    }
    
    // Atualiza campos de entrada
    const posLat = document.getElementById('posLat');
    const posLng = document.getElementById('posLng');
    if (posLat) posLat.value = lat.toFixed(6);
    if (posLng) posLng.value = lon.toFixed(6);
    
    // Chama a função existente
    if (typeof atualizarPosicaoAtual === 'function') {
        atualizarPosicaoAtual();
    }
    
    // Chama outras funções se existirem
    if (typeof obterCidade === 'function') {
        obterCidade(lat, lon);
    }
    if (typeof obterClima === 'function') {
        obterClima(lat, lon);
    }
    
    return true;
}

//======================
//ATUALIZAR POSIÇÃO ATUAL
//=======================
async function atualizarPosicaoAtual() {
    let lat = userLat;
    let lng = userLng;

    // Se ainda não recebemos nenhuma posição real do App Inventor, aguarda
    if (!gpsInitialized || !lat || !lng || (lat === -19.919055 && lng === -43.938641)) {
        posStatus.textContent = '🔄 Aguardando GPS do app...';

        const posicaoRecebida = await new Promise((resolve) => {
            const inicioEspera = Date.now();
            const TIMEOUT_ESPERA = 15000;

            const intervalo = setInterval(() => {
                if (gpsInitialized && userLat && userLng &&
                    !(userLat === -19.919055 && userLng === -43.938641)) {
                    clearInterval(intervalo);
                    resolve({ lat: userLat, lng: userLng });
                } else if (Date.now() - inicioEspera > TIMEOUT_ESPERA) {
                    clearInterval(intervalo);
                    resolve(null);
                }
            }, 300);
        });

        if (!posicaoRecebida) {
            posStatus.textContent = '⚠️ GPS do app não respondeu. Verifique se o LocationSensor está ativo.';
            return false;
        }

        lat = posicaoRecebida.lat;
        lng = posicaoRecebida.lng;
        posStatus.textContent = '✅ GPS obtido via App Inventor!';
    }

    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        currentPosition.lat = lat;
        currentPosition.lng = lng;
        posLat.value = lat.toFixed(6);
        posLng.value = lng.toFixed(6);
        gpsObtido = true;
        posStatus.textContent = '🔄 Buscando endereço...';

        try {
            const endereco = await buscarEnderecoPorCoordenadas(lat, lng);
            if (endereco) {
                radarAddress.value = endereco;
                posStatus.textContent = '✅ Endereço encontrado!';
            } else {
                posStatus.textContent = '⚠️ Endereço não encontrado. Preencha manualmente.';
            }
        } catch (e) {
            posStatus.textContent = '⚠️ Erro ao buscar endereço. Preencha manualmente.';
            console.warn('[Radar X9] Erro ao buscar endereço:', e);
        }
        return true;
    } else {
        posStatus.textContent = '❌ Coordenadas inválidas';
        return false;
    }
}

//=====================    
//BOTÃO MENU TOGLE
//=====================
document.addEventListener('DOMContentLoaded', () => {
    
    // Pega o botão pelo ID
    const btnMenuToggle = document.getElementById('btn-menu-toggle');

    // Verifica se o botão existe na página para evitar erros
    if (btnMenuToggle) {
        
        // Adiciona o evento de clique
        btnMenuToggle.addEventListener('click', () => {
            
            // Adiciona ou remove a classe 'active' a cada clique
            btnMenuToggle.classList.toggle('active');

            // OPCIONAL: Se você tiver um menu lateral para abrir/fechar, adicione a lógica aqui
            // Exemplo:
            // const menuLateral = document.getElementById('menu-lateral');
            // menuLateral.classList.toggle('open');
        });
    }
});


//=====================    
//BOTÃO ADICIONAR RADAR
//=====================

    btnAddRadar.addEventListener('click', async () => {
        modalAddRadar.classList.add('active');
        ocultarBussola(true);

        radarType.value = '';
        radarAddress.value = '';
        tipoAtual = '';
        iconPreviewGroup.style.display = 'none';

        speedButtons.forEach(b => {
            b.classList.remove('selected', 'selected-30', 'selected-40', 'selected-50', 'selected-60',
                              'selected-70', 'selected-80', 'selected-100', 'selected-110');
        });

        posLat.value = '🔄 Buscando GPS...';
        posLng.value = '';
        posStatus.textContent = '🔄 Aguardando coordenadas...';
        
        // Reset do botão de captura
        const btnCap = document.getElementById('btn-capture-location');
        btnCap.textContent = '📍 Capturar Posição Atual';
        btnCap.classList.remove('captured');
        document.getElementById('coords-inputs-container').style.display = 'none';

        await atualizarPosicaoAtual();
        if (!gpsObtido) {
            setTimeout(async () => {
                await atualizarPosicaoAtual();
            }, 2000);
        }
    });

    function fecharModal() {
        modalAddRadar.classList.remove('active');
        ocultarBussola(false);
        const btn = document.getElementById('btn-add-radar');
        const icon = btn.querySelector('.plus-icon');
        icon.textContent = '+';
        btn.style.background = 'linear-gradient(135deg, #00cc66, #00994d)';
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 20px rgba(0, 204, 102, 0.5)';
        btn.style.borderColor = 'rgba(0, 255, 136, 0.4)';
    }

    btnModalClose.addEventListener('click', fecharModal);
    modalAddRadar.addEventListener('click', (e) => {
        if (e.target === modalAddRadar) fecharModal();
    });

    radarType.addEventListener('change', function() {
        tipoAtual = this.value;
        const speedBtnAtual = document.querySelector('.speed-btn.selected');
        const velocidade = speedBtnAtual ? speedBtnAtual.dataset.speed : '';
        atualizarPreviewIcone(tipoAtual, velocidade);
    });

    btnSubmitRadar.addEventListener('click', function() {
        incluirRadar(currentPosition, fecharModal);
    });
}

// ===================================================================
// SALVAR RADAR LOCALMENTE (fallback honesto)
// ===================================================================
async function salvarRadarLocalmente(novoRadar, proximoId) {
    console.warn('[Radar X9] ⚠️ Radar NÃO foi salvo no GitHub — ficará somente nesta sessão até ser sincronizado.');
    showNotification(`⚠️ Radar #${proximoId} adicionado só nesta sessão (não persistido). Configure/corrija o GitHub e sincronize depois.`);
    return { success: true, id: proximoId, persistido: false };
}

// ===================================================================
// [CORREÇÃO] SALVAR RADAR NO GITHUB - COM BRANCH DINÂMICO E SEPARAÇÃO
// ===================================================================
async function salvarRadarNoGitHub(novoRadar, proximoId, arquivoPath) {
    const path = arquivoPath || GITHUB_CONFIG.appPath || 'radares_app.json';
    console.log('[Radar X9] 📤 Salvando radar no GitHub em:', path, novoRadar);

    if (!GITHUB_CONFIG.token) {
        throw new Error('Token do GitHub não configurado. Configure no menu (🔑 Configurar GitHub).');
    }

    const branch = await obterBranchPadrao();

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

    let apiUrl = url;
    let useProxy = false;
    if (GITHUB_CONFIG.proxyUrl) {
        apiUrl = GITHUB_CONFIG.proxyUrl + '/github';
        useProxy = true;
    }

    const getHeaders = {
        'Accept': 'application/vnd.github.v3+json'
    };
    if (!useProxy) {
        getHeaders['Authorization'] = `token ${GITHUB_CONFIG.token}`;
    }

    const getResponse = await fetch(
        useProxy
            ? apiUrl + '?path=' + encodeURIComponent(path) + '&ref=' + encodeURIComponent(branch)
            : `${url}?ref=${encodeURIComponent(branch)}`,
        { method: 'GET', headers: getHeaders }
    );

    if (!getResponse.ok) {
        const detalheErro = await getResponse.text().catch(function () { return ''; });
        throw new Error(`Erro ao buscar arquivo (${getResponse.status}): ${detalheErro.slice(0, 300)}`);
    }

    const data = await getResponse.json();
    let jsonData;

    try {
        const content = atob(data.content.replace(/\s/g, ''));
        jsonData = JSON.parse(content);
    } catch (e) {
        throw new Error('Erro ao parsear o conteúdo do arquivo: ' + e.message);
    }

    if (!jsonData.records) {
        jsonData.records = [];
    }

    const idFiscalizacao = String(proximoId);
    const novoRegistro = [
        proximoId,
        idFiscalizacao,
        novoRadar.endereco,
        novoRadar.tipo,
        String(novoRadar.velocidade),
        "Único",
        "Único",
        `M${String(proximoId).padStart(6, '0')}`,
        `KBH${String(proximoId).padStart(6, '0')}`,
        `${novoRadar.latitude.toFixed(6)}, ${novoRadar.longitude.toFixed(6)}`
    ];

    jsonData.records.push(novoRegistro);

    const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify(jsonData, null, 2))));

    let updateResponse;
    if (useProxy) {
        updateResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: path,
                message: `Adicionado radar #${proximoId}: ${novoRadar.tipo} em ${novoRadar.endereco}`,
                content: updatedContent,
                sha: data.sha,
                branch: branch,
                token: GITHUB_CONFIG.token
            })
        });
    } else {
        updateResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Adicionado radar #${proximoId}: ${tipo} em ${endereco}`,
                content: updatedContent, // O base64 do novo conteúdo
                sha: data.sha,
                branch: branch
            })
        });
    }

    if (!updateResponse.ok) {
        const erro = await updateResponse.text().catch(function () { return ''; });
        throw new Error(`Erro ao salvar (${updateResponse.status}): ${erro.slice(0, 300)}`);
    }

    console.log('[Radar X9] ✅ Radar salvo no GitHub! ID:', proximoId, '| branch:', branch, '| arquivo:', path);
    RADAR_MODO_OFFLINE = false;
    return { success: true, id: proximoId, persistido: true };
}
 
// ===================================================================
// INCLUIR RADAR - CORRIGIDO
// ===================================================================
async function incluirRadar(currentPosition, fecharModal) {
    const tipo = document.getElementById('radar-type').value;
    const endereco = document.getElementById('radar-address').value.trim();
    const speedBtnSelected = document.querySelector('.speed-btn.selected');
    const velocidade = speedBtnSelected ? speedBtnSelected.dataset.speed : '';

    if (!tipo) {
        showNotification('❌ Selecione o tipo de radar.');
        document.getElementById('radar-type').focus();
        return;
    }
    if (!endereco) {
        showNotification('❌ Informe o endereço.');
        document.getElementById('radar-address').focus();
        return;
    }
    if (endereco.length < 5) {
        showNotification('❌ Endereço muito curto. Seja mais específico.');
        document.getElementById('radar-address').focus();
        return;
    }
    if (!currentPosition || !currentPosition.lat || !currentPosition.lng) {
        showNotification('❌ Aguardando posição GPS. Aguarde ou feche e reabra o formulário.');
        return;
    }
    if (!velocidade) {
        showNotification('❌ Selecione a velocidade máxima.');
        return;
    }

    const btnSubmitRadar = document.getElementById('btn-submit-radar');
    btnSubmitRadar.disabled = true;
    btnSubmitRadar.textContent = '⏳ Salvando...';

    try {
        const novoRadar = {
            tipo: tipo,
            endereco: endereco,
            velocidade: velocidade,
            latitude: currentPosition.lat,
            longitude: currentPosition.lng
        };

        let proximoId = 541;
        if (radarMarkers.length > 0) {
            const idsExistentes = radarMarkers.map(m => m.radarData.id);
            proximoId = Math.max(...idsExistentes) + 1;
        }
//// SALVAR RADAR INSERIDO SEM PASSAR NAVEGADOR
let resultado = null;
let salvouNoGitHub = false;

// Salvar via backend seguro (token nunca passa pelo navegador)
try {
    const resp = await fetch('/api/save-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoRadar)
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
        resultado = data;
        proximoId = data.id;
        salvouNoGitHub = true;
        console.log('[Radar X9] ✅ Salvo no GitHub via backend, ID:', data.id);
    } else {
        throw new Error(data.error || 'Erro desconhecido do backend');
    }
} catch (backendError) {
    console.error('[Radar X9] ❌ Falha ao salvar via backend:', backendError.message);
    showNotification('❌ Falha ao salvar: ' + backendError.message);
}

        // Fallback apenas de sessão (não persiste)
        if (!salvouNoGitHub) {
            resultado = await salvarRadarLocalmente(novoRadar, proximoId);
            RADAR_PENDENTES_SINCRONIZAR.push({
                radar: novoRadar,
                id: proximoId,
                timestamp: Date.now()
            });
            try {
                localStorage.setItem('radarx9_pendentes', JSON.stringify(RADAR_PENDENTES_SINCRONIZAR));
            } catch (e) {}
        }
         //========================
         // Criar marcador no mapa
         //=======================
               
     animarBotaoRadar(salvouNoGitHub ? 'adicionado' : 'erro');

        // Criar marcador no mapa
        const novoMarker = criarRadarNoMapa({
            ...novoRadar,
            id: proximoId,
            tipoOriginal: tipo,
            isUsuario: true
        });
        if (novoMarker) {
            radarMarkers.push(novoMarker);
            if (salvouNoGitHub) {
                showNotification(`✅ Radar #${proximoId} salvo no GitHub!`);

                // [ADICIONADO] Registra na lista de sessão para sobreviver
                // a um possível carregarRadares() antes do CDN propagar o commit
                radaresAdicionadosNestaSessao.push({
                    radar: { ...novoRadar },
                    id: proximoId
                });
            }
            novoMarker.openPopup();
        }
         //================================
        // Fechar modal e limpar formulário
        //=================================
        if (typeof fecharModal === 'function') fecharModal();
        document.getElementById('radar-type').value = '';
        document.getElementById('radar-address').value = '';
        document.querySelectorAll('.speed-btn').forEach(b => {
            b.classList.remove('selected', 'selected-30', 'selected-40', 'selected-50', 'selected-60',
                              'selected-70', 'selected-80', 'selected-100', 'selected-110');
        });
        document.getElementById('icon-preview-group').style.display = 'none';

       // Recarregar radares do GitHub após alguns segundos
       // if (salvouNoGitHub) {
       //     setTimeout(() => {
       //       carregarRadares();
       //  }, 3000);
       // }

    } catch (error) {
        animarBotaoRadar('erro');
        showNotification('❌ Erro ao salvar: ' + (error.message || error));
        console.error('[Radar X9] Erro ao incluir radar:', error);
    } finally {
        btnSubmitRadar.disabled = false;
        btnSubmitRadar.textContent = '✅ Incluir Radar';
    }
}

// ===================================================================
// SINCRONIZAR RADARES PENDENTES COM GITHUB
// ===================================================================
async function sincronizarRadaresPendentes() {
    if (RADAR_PENDENTES_SINCRONIZAR.length === 0) {
        showNotification('✅ Nenhum radar pendente de sincronização.');
        return;
    }

    if (!GITHUB_CONFIG.token) {
        showNotification('❌ Configure o token do GitHub primeiro.');
        return;
    }

    showNotification(`🔄 Sincronizando ${RADAR_PENDENTES_SINCRONIZAR.length} radares pendentes...`);

    let sucessos = 0;
    let falhas = 0;
    const aindaPendentes = [];

    for (const pendente of RADAR_PENDENTES_SINCRONIZAR) {
        try {
            await salvarRadarNoGitHub(pendente.radar, pendente.id, GITHUB_CONFIG.appPath || 'radares_app.json');
            sucessos++;
            console.log(`[Radar X9] ✅ Radar #${pendente.id} sincronizado.`);
        } catch (error) {
            falhas++;
            aindaPendentes.push(pendente);
            console.warn(`[Radar X9] ❌ Radar #${pendente.id} ainda pendente:`, error.message);
        }
    }

    RADAR_PENDENTES_SINCRONIZAR = aindaPendentes;
    try {
        localStorage.setItem('radarx9_pendentes', JSON.stringify(RADAR_PENDENTES_SINCRONIZAR));
    } catch (e) {}

    if (sucessos > 0) {
        showNotification(`✅ ${sucessos} radar(es) sincronizado(s)!`);
        carregarRadares(); 
    }
    if (falhas > 0) {
        showNotification(`⚠️ ${falhas} radar(es) ainda pendente(s).`);
    }
}

// ===================================================================
// CARREGAR RADARES PENDENTES DO LOCALSTORAGE AO INICIAR
// ===================================================================
function carregarRadaresPendentes() {
    try {
        const pendentes = localStorage.getItem('radarx9_pendentes');
        if (pendentes) {
            RADAR_PENDENTES_SINCRONIZAR = JSON.parse(pendentes);
            console.log('[Radar X9] 📦 Radares pendentes carregados:', RADAR_PENDENTES_SINCRONIZAR.length);
        }
    } catch (e) {
        console.warn('[Radar X9] Erro ao carregar pendentes:', e);
    }
}


// =====================================================================
// FETCH COM TIMEOUT (evita travamento silencioso em WebViews restritos)
// =====================================================================
function fetchComTimeout(url, opcoes, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return Promise.race([
        fetch(url, opcoes),
        new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('Timeout: ' + url)); }, timeoutMs);
        })
    ]);
}

// ===================================================================
// FUNÇÃO PARA LIMPAR O TEXTO DA TARJA (Remove a repetição)
// ===================================================================
function formatarTextoTarja(tipoAlerta) {
    if (!tipoAlerta) return "Alerta";
    
    const prefixo = "Descubra a Cidade - ";
    let textoLimpo = tipoAlerta.trim();
    
    // Remove o prefixo se existir para não ficar repetitivo na descrição
    if (textoLimpo.startsWith(prefixo)) {
        textoLimpo = textoLimpo.substring(prefixo.length);
    }
    
    return textoLimpo;
}

// ===================================================================
// FUNÇÃO AUXILIAR ROBUSTA PARA EXTRAIR COORDENADAS
// ===================================================================
function extrairCoordenadasRobustas(record) {
    // Verifica múltiplos campos possíveis onde as coordenadas podem estar escondidas
    const camposParaVerificar = [
        record[8], 
        record[9], 
        record.lat, 
        record.latitude, 
        record.latlng
    ];

    for (let campo of camposParaVerificar) {
        if (!campo) continue;
        
        const str = String(campo).trim();
        if (!str) continue;

        // Regex robusto: encontra dois números (com ou sem sinal negativo e decimais) separados por vírgula
        // Lida com espaços extras e sinais duplicados (ex: "- -19.88, -43.92")
        const match = str.match(/(-?\s*\d+\.\d+)\s*,\s*(-?\s*\d+\.\d+)/);

        if (match) {
            // Limpeza agressiva: remove todos os espaços e corrige "--" para "-"
            const latStr = match[1].replace(/\s+/g, '').replace(/--/g, '-');
            const lngStr = match[2].replace(/\s+/g, '').replace(/--/g, '-');

            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);

            // Validação final básica de geolocalização
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return { lat, lng, sucesso: true };
            }
        }
    }

    return { 
        sucesso: false, 
        erro: `Coordenadas ausentes ou ilegíveis. Campos verificados: [8]:${record[8]}, [9]:${record[9]}` 
    };
}

// ===================================================================
// FUNÇÃO UNIFICADA DE RENDERIZAÇÃO (ATUALIZADA)
// ===================================================================
function renderizarRadaresNoMapa(records) {
    console.table(errosDetalhados);
    if (!map || !records || records.length === 0) {
        $("#loading").hide();
        return;
    }

    var contador = 0;
    var contadorCurados = 0;
    var contadorUsuarios = 0;
    var contadorErros = 0;
    var errosDetalhados = [];

    for (var i = 0; i < records.length; i++) {
        var record = records[i];
        var isUsuario = record._isUsuario === true;
        
        if (isUsuario) contadorUsuarios++;
        else contadorCurados++;

        // 1. Tenta extrair com a nova função robusta
        var coords = extrairCoordenadasRobustas(record);
        
        // 2. Se falhar, registra o erro
        if (!coords.sucesso) {
            contadorErros++;
            if (errosDetalhados.length < 15) {
                errosDetalhados.push({
                    indice: i,
                    isUsuario: isUsuario,
                    tipo: record[3] || record.tipo || "Desconhecido",
                    erro: coords.erro,
                    record: record
                });
            }
            continue; // Pula para o próximo radar
        }

        // 3. Validação de limites do Brasil (com margem de segurança)
        if (coords.lat < -34.5 || coords.lat > 6 || coords.lng < -74.5 || coords.lng > -34) {
            contadorErros++;
            if (errosDetalhados.length < 15) {
                errosDetalhados.push({
                    indice: i,
                    isUsuario: isUsuario,
                    tipo: record[3] || record.tipo,
                    erro: `Fora do Brasil: ${coords.lat}, ${coords.lng}`,
                    record: record
                });
            }
            continue;
        }

        // 4. Extração dos demais dados
        var endereco = record[2] || record.endereco || "Endereço não informado";
        var tipo = (record[3] || record.tipo || "Não Identificado").trim();
        var velocidade = record[4] || record.velocidade || "0";

        var iconeUrl = getIconUrl(tipo, velocidade);
        var fallbackUrl = '/imagens_app/ic_radar_cev_v2.png'; 
        var iconeRadar = criarIconeRadar(iconeUrl, 40, fallbackUrl);

        var radarMarker = L.marker([coords.lat, coords.lng], { icon: iconeRadar }).addTo(map);

        var tipoExibicao = (typeof ajusteNomes !== 'undefined' && ajusteNomes[tipo]) ? ajusteNomes[tipo] : tipo;
        
        var seloUsuario = isUsuario 
            ? '<div style="color:#ff9800; font-size:0.85rem; margin-top:6px; font-weight:bold;">👤 Compartilhado por Usuário</div>' 
            : '<div style="color:#4caf50; font-size:0.85rem; margin-top:6px; font-weight:bold;">✅ Oficial / Curado</div>';

        radarMarker.bindPopup(
            '<div style="color:#222; font-family:\'Inter\', sans-serif; text-align:center; min-width:200px;">' +
            '<b style="font-size:1.1rem;">' + tipoExibicao + '</b><br>' +
            '<hr style="border:0; border-top:1px solid #ddd; margin:8px 0;">' +
            '<div style="font-size:0.9rem; color:#555;">' + endereco + '</div>' +
            '<div style="color:#d32f2f; font-weight:bold; margin-top:8px; font-size:1rem;">⚠️ Máx: ' + velocidade + ' km/h</div>' +
            seloUsuario + 
            '</div>'
        );

        radarMarker.radarData = {
            id: record[0] || record.id || i, 
            latitude: coords.lat, 
            longitude: coords.lng,
            endereco: endereco, 
            velocidade_maxima: velocidade,
            tipoOriginal: tipo, 
            tipoExibicao: tipoExibicao,
            isUsuario: isUsuario
        };
        radarMarkers.push(radarMarker);
        contador++;
    }

    $("#loading").hide();
    
    console.log(`[Radar X9] ✅ Renderização: ${contadorCurados} curados, ${contadorUsuarios} usuários`);
    console.log(`[Radar X9] ❌ Total de erros: ${contadorErros}`);
    
    if (errosDetalhados.length > 0) {
        console.warn('[Radar X9] ⚠️ AMOSTRA DE ERROS (Primeiros 15):');
        console.table(errosDetalhados.map(e => ({
            Índice: e.indice,
            Tipo: e.tipo,
            Origem: e.isUsuario ? 'Usuário' : 'Oficial',
            Erro: e.erro
        })));
        
        showNotification(`⚠️ ${contadorErros} alertas sem coordenadas válidas`);
    } else {
        showNotification(`✅ Mapa atualizado: ${contador} radares`);
    }
}

// ===================================================================
// CARREGAR RADARES: Busca AMBOS os arquivos do GitHub em paralelo
// ===================================================================
async function carregarRadares() {
    if (!map) return;
    
    if (radarMarkers.length > 0) { 
        radarMarkers.forEach(function(marker) { 
            if (marker.radarData && marker.radarData.isUsuario && marker.radarData._isSessao) {
                // Mantém radares da sessão atual
            } else {
                map.removeLayer(marker); 
            }
        }); 
        radarMarkers = radarMarkers.filter(m => m.radarData && m.radarData.isUsuario && m.radarData._isSessao);
    }
    
    $("#loading").show().html("<div class='loading-spinner'></div><div>Carregando alertas...</div>");

    try {
        console.log('[Radar X9] 🔄 Buscando radares no GitHub...');
        console.log('[Radar X9] 🔍 URL Curados:', GITHUB_CONFIG.cdnUrl);
        console.log('[Radar X9] 🔍 URL Usuários:', GITHUB_CONFIG.cdnUrlApp);
        
        const [responseCurados, responseApp] = await Promise.all([
            fetch(GITHUB_CONFIG.cdnUrl + '?v=' + Date.now()),
            fetch(GITHUB_CONFIG.cdnUrlApp + '?v=' + Date.now())
        ]);

        let radaresCurados = [];
        let radaresApp = [];

        // Processa radares curados
        if (responseCurados.ok) {
            const dataCurados = await responseCurados.json();
            radaresCurados = (dataCurados.records || []).map(r => ({ ...r, _isUsuario: false }));
            console.log(`[Radar X9] ✅ Radares curados: ${radaresCurados.length}`);
        } else if (responseCurados.status === 404) {
            console.warn('[Radar X9] ⚠️ ARQUIVO radares.json NÃO EXISTE no repositório!');
            console.warn('[Radar X9] 💡 Crie o arquivo radares.json na raiz do repositório ou ajuste o caminho.');
            showNotification('️ Arquivo radares.json não encontrado');
        } else {
            console.warn('[Radar X9] ⚠️ Erro ao carregar radares.json:', responseCurados.status);
        }

        // Processa radares de usuários
        if (responseApp.ok) {
            const dataApp = await responseApp.json();
            radaresApp = (dataApp.records || []).map(r => ({ ...r, _isUsuario: true }));
            console.log(`[Radar X9] ✅ Radares usuários: ${radaresApp.length}`);
        } else {
            console.warn('[Radar X9] ⚠️ Erro ao carregar radares_app.json:', responseApp.status);
        }

        const todosOsRadares = [...radaresCurados, ...radaresApp];
        console.log(`[Radar X9] 📊 Total: ${todosOsRadares.length} radares`);

        if (todosOsRadares.length > 0) {
            renderizarRadaresNoMapa(todosOsRadares);
            RADAR_MODO_OFFLINE = false;
            
            try {
                localStorage.setItem('radarx9_radares_cache', JSON.stringify({
                    recordsCurados: radaresCurados,
                    recordsApp: radaresApp,
                    timestamp: Date.now()
                }));
            } catch(e) {}
            
        } else {
            showNotification('⚠️ Nenhum radar encontrado');
            RADAR_MODO_OFFLINE = true;
        }

    } catch (err) {
        console.error('[Radar X9] ❌ Erro:', err);
        showNotification('⚠️ Erro de conexão');
        
        // Fallback cache
        try {
            const cached = localStorage.getItem('radarx9_radares_cache');
            if (cached) {
                const data = JSON.parse(cached);
                const todos = [...(data.recordsCurados || []), ...(data.recordsApp || [])];
                if (todos.length > 0) {
                    renderizarRadaresNoMapa(todos);
                    RADAR_MODO_OFFLINE = true;
                }
            }
        } catch (e) {}
    } finally {
        $("#loading").hide();
    }
}


// =======================
// FUNÇÃO BUSCAR RADARES
// =======================

function buscarRadares(query) {
    if (!query || query.length < 2) return;
    var encontrou = false;
    var boundsGroup = L.featureGroup();
    var q = query.toLowerCase();
    radarMarkers.forEach(function(marker) {
        var d = marker.radarData;
        if ((d.endereco + ' ' + d.tipoOriginal + ' ' + d.tipoExibicao).toLowerCase().includes(q)) {
            encontrou = true; boundsGroup.addLayer(marker); marker.openPopup();
        }
    });
    if (encontrou) { if (map) map.fitBounds(boundsGroup.getBounds().pad(0.2)); isFollowing = false; }
    else showNotification("Nenhum radar encontrado para: " + query);
}

function showError(error) {
    if (gpsSource === 'appinventor') return;
    var msg = "Erro ao obter localização.";
    if (error.code === 1) msg = "Permissão de GPS negada.";
    if (error.code === 2) msg = "Sinal GPS indisponível.";
    if (error.code === 3) msg = "Tempo esgotado. Tentando novamente...";
    showNotification(msg); hideFullscreenLoading();
    if (error.code === 3) setTimeout(startGPSTracking, 5000);
}

function inicializarBussolaHardware() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        console.log('[Radar X9] Bússola iOS detectada'); return;
    }
    if (typeof DeviceOrientationEvent !== 'undefined') {
        window.addEventListener('deviceorientation', function(event) {
            if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) { currentHeading = event.webkitCompassHeading; bussolaHardwareDisponivel = true; }
            else if (event.alpha !== null && event.absolute === true) { currentHeading = event.alpha; bussolaHardwareDisponivel = true; }
        }, true);
        console.log('[Radar X9] deviceorientation listener registrado');
    } else console.warn('[Radar X9] deviceorientation API não disponível');
}

async function solicitarPermissaoBussolaIOS() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            var resposta = await DeviceOrientationEvent.requestPermission();
            if (resposta === 'granted') {
                window.addEventListener('deviceorientation', function(event) {
                    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) { currentHeading = event.webkitCompassHeading; bussolaHardwareDisponivel = true; }
                }, true);
                return true;
            }
            return false;
        } catch (erro) { return false; }
    }
    return false;
}



// ===================================================================
// INICIALIZAÇÃO
// ===================================================================
document.addEventListener('DOMContentLoaded', async function() {

// ==========================================
// PONTE DE COMUNICAÇÃO: OUVIR O APP INVENTOR
// ==========================================
function iniciarPonteAppInventor() {
    // Verifica se está rodando dentro do App Inventor
    if (typeof window.AppInventor !== 'undefined') {
        console.log("📱 Ambiente App Inventor detectado. Iniciando leitura de GPS...");
        
        // Verifica a cada 1 segundo se há novos dados
        setInterval(() => {
            try {
                // Lê a string que o App Inventor enviou
                let dadosRecebidos = window.AppInventor.getWebViewString();
                
                // Se houver dados e começar com 'GPS|', processa
                if (dadosRecebidos && dadosRecebidos.startsWith('GPS|')) {
                    console.log("📡 Dados brutos recebidos:", dadosRecebidos);
                    
                    // Chama a SUA função que já está pronta
                    receberDadosAppInventor(dadosRecebidos);
                    
                    // Limpa a string para não processar a mesma leitura duas vezes
                    window.AppInventor.setWebViewString("");
                }
            } catch (erro) {
                console.warn("Erro ao ler WebViewString:", erro);
            }
        }, 1000); // 1000ms = 1 segundo
    } else {
        console.log("💻 Rodando no navegador normal. Usando GPS do navegador...");
        // Aqui você pode manter sua lógica original de navigator.geolocation se quiser
    }
}

// Inicia a ponte assim que a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarPonteAppInventor);
} else {
    iniciarPonteAppInventor();
}
  
    ajustarTextosClima();
    ajustarHeaderResponsivo();
    carregarRadaresPendentes(); 
    initMap(); 
    inicializarBussolaHardware(); // nome corrigido, ver bug 2 abaixo
    setTimeout(()=>{ const l=document.getElementById('loading-fullscreen'); if(l){l.classList.add('fade-out');setTimeout(()=>{if(l)l.style.display='none';},600);} }, 1500);
});
window.addEventListener('resize', function() {
    ajustarTextosClima();
    ajustarHeaderResponsivo();
});

// Dentro de atualizarTemperatura(), após buscar os dados:
atualizarInterfaceCabecalho({
    cidade: dadosClima.name || "Local",
    temp: dadosClima.main.temp,
    umidade: dadosClima.main.humidity,
    poluicaoTexto: textoPoluicao, // (a variável que você já criou no seu código)
    precisaoGPS: typeof ultimaPrecisaoGPS !== 'undefined' ? ultimaPrecisaoGPS : 999
});


// ============================================
// SERVICE WORK
// ============================================
 if ('serviceWorker' in navigator) {
     window.addEventListener('load', () => {
       navigator.serviceWorker.register('/sw.js')
         .then(reg => console.log('SW registrado com sucesso:', reg.scope))
         .catch(err => console.error('Falha no registro do SW:', err));
     });
   }
