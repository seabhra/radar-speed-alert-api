// ==========================================
// APP.JS - CONTROLE DE INTERFACE 
// ==========================================

// ==========================================
// VARIÁVEIS GLOBAIS (EVITAR DUPLICAÇÃO)
// ==========================================
let ultimaCidade = '';
let alertaNormalidadeMostrado = false;
let alertaAtivoAtual = '';

// Variáveis de GPS (serão definidas pelo mapa.js)
let userLat = null;
let userLng = null;

// ==========================================
// ÁUDIO DE ALERTA (DECLARAR UMA VEZ SÓ)
// ==========================================
const somAlerta = new Audio('audio_app/alerta_sound_clima.mp3');
somAlerta.volume = 0.5;

// ==========================================
// FUNÇÃO ATUALIZAR NOME DA CIDADE LOCAL
// ==========================================
async function atualizarCidade(lat, lng) {
    try {
        if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
            console.warn("[Radar X9] Coordenadas inválidas para atualizar cidade:", lat, lng);
            return;
        }

        const resposta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
        );

        if (!resposta.ok) {
            console.warn("[Radar X9] Nominatim respondeu:", resposta.status);
            return;
        }

        const dados = await resposta.json();

        if (!dados.address) {
            console.warn("[Radar X9] Nominatim não retornou endereço:", dados);
            return;
        }

        const cidade = dados.address.city || dados.address.town || dados.address.municipality || dados.address.village;

        if (cidade && cidade !== ultimaCidade) {
            ultimaCidade = cidade;
            const nomeEl = document.getElementById("nomeCidade");
            if (nomeEl) {
                nomeEl.textContent = "" + cidade;
                nomeEl.style.color = corCidade(cidade);
            }
        }
    } catch (e) {
        console.log("Erro cidade:", e);
    }
}

// ==========================================
// MUDANÇA DA COR DA CIDADE
// ==========================================
function corCidade(nome) {
    let hash = 0;
    for(let i = 0; i < nome.length; i++) {
        hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    }
    let hue = Math.abs(hash) % 360;
    
    // Evita faixas pouco agradáveis
    if (hue >= 20 && hue <= 40) hue = 45;
    if (hue >= 250 && hue <= 295) hue = 210;
    
    return `hsl(${hue},100%,68%)`;
}

// ==========================================
// FUNÇÃO PARA ATUALIZAR O CABEÇALHO
// ==========================================
function atualizarInterfaceCabecalho(dados) {
    if (!dados) return;

    if (dados.cidade) {
        const elCidade = document.getElementById('nomeCidade');
        if (elCidade) elCidade.textContent = dados.cidade;
    }
    
    if (dados.temp !== undefined) {
        const elTemp = document.getElementById('temperaturaAtual');
        if (elTemp) elTemp.textContent = dados.temp.toFixed(1) + '°C';
    }
    
    if (dados.umidade !== undefined) {
        const elUmid = document.getElementById('umidadeAtual');
        if (elUmid) elUmid.textContent = dados.umidade + '%';
    }
    
    if (dados.poluicaoTexto) {
        const elPoluicao = document.getElementById('poluicaoAtual');
        if (elPoluicao) elPoluicao.textContent = dados.poluicaoTexto;
    }

    // Atualiza o status do GPS
    const wrapper = document.getElementById('gps-status-wrapper');
    const dot = document.getElementById('gps-status-dot');
    const label = document.getElementById('gps-status-label');

    if (wrapper && dot && label) {
        wrapper.classList.remove('gps-ok', 'gps-warn', 'gps-err');
        dot.classList.remove('ok', 'warn', 'err');

        const precisao = dados.precisaoGPS || 999;

        if (precisao <= 50) {
            wrapper.classList.add('gps-ok');
            dot.classList.add('ok');
            label.textContent = 'ATIVO';
        } else if (precisao <= 150) {
            wrapper.classList.add('gps-warn');
            dot.classList.add('warn');
            label.textContent = 'INSTÁVEL';
        } else {
            wrapper.classList.add('gps-err');
            dot.classList.add('err');
            label.textContent = 'AGUARDANDO';
        }
    }
}

// ==========================================
// ATUALIZAR TEMPERATURA, UMIDADE E POLUIÇÃO
// ==========================================
async function atualizarTemperatura() {
    if (!userLat || !userLng) return;

    try {
        const API_KEY = 'a5c507ef270b147035538e0d6019bce1';
        
        // 1. BUSCA DADOS DE CLIMA
        const urlClima = `https://api.openweathermap.org/data/2.5/weather?lat=${userLat}&lon=${userLng}&appid=${API_KEY}&units=metric&lang=pt_br`;
        const respostaClima = await fetch(urlClima);
        
        if (!respostaClima.ok) throw new Error('Erro na API de clima: ' + respostaClima.status);
        const dadosClima = await respostaClima.json();

        const temperatura = dadosClima.main.temp;
        const umidade = dadosClima.main.humidity;

        // DETECTA SE É MOBILE
        const isMobile = window.innerWidth <= 600;
        
        // ATUALIZA TEMPERATURA
        const tempEl = document.getElementById('temperaturaAtual');
        if (tempEl) {
            const valorTemp = temperatura.toFixed(1) + '°C';
            tempEl.textContent = isMobile ? valorTemp : 'Temperatura ' + valorTemp;
            tempEl.style.color = '#ffffff';
        }
        
        // ATUALIZA UMIDADE
        const umidEl = document.getElementById('umidadeAtual');
        if (umidEl) {
            let valorUmid = (umidade !== undefined && umidade !== null) ? umidade + '%' : '--%';
            umidEl.textContent = isMobile ? valorUmid : 'Umidade ' + valorUmid;
            umidEl.style.color = '#ffffff';
        }

        // 2. BUSCA POLUIÇÃO DO AR
        try {
            const urlPoluicao = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${userLat}&lon=${userLng}&appid=${API_KEY}`;
            const respostaPoluicao = await fetch(urlPoluicao);
            
            if (respostaPoluicao.ok) {
                const dadosPoluicao = await respostaPoluicao.json();
                const aqi = dadosPoluicao.list[0].main.aqi;
                
                const componentes = dadosPoluicao.list[0].components;
                const pm25 = componentes.pm2_5 ? Math.round(componentes.pm2_5) : null;
                const pm10 = componentes.pm10 ? Math.round(componentes.pm10) : null;
                let valorPoluicao = pm25 || pm10 || 0;
                
                const mapaAQI = {
                    1: { texto: 'Bom', cor: '#00cc66' },
                    2: { texto: 'Moderado', cor: '#ffcc00' },
                    3: { texto: 'Ruim', cor: '#ff8800' },
                    4: { texto: 'Péssimo', cor: '#ff4444' },
                    5: { texto: 'Insalubre', cor: '#cc0000' }
                };
                
                const infoPoluicao = mapaAQI[aqi] || { texto: 'N/A', cor: '#888' };
                const poluEl = document.getElementById('poluicaoAtual');
                
                if (poluEl) {
                    let valorPol = valorPoluicao > 0 ? infoPoluicao.texto + ' ' + valorPoluicao : infoPoluicao.texto;
                    poluEl.textContent = isMobile ? valorPol : 'Poluição ' + valorPol;
                    poluEl.style.color = infoPoluicao.cor;
                }
                
                verificarAlertaPoluicao(aqi);
            } else {
                const poluEl = document.getElementById('poluicaoAtual');
                if (poluEl) {
                    poluEl.textContent = isMobile ? 'N/A' : 'Poluição N/A';
                    poluEl.style.color = '#888';
                }
            }
        } catch (e) {
            console.warn('Erro ao buscar poluição:', e);
            const poluEl = document.getElementById('poluicaoAtual');
            if (poluEl) {
                poluEl.textContent = isMobile ? 'N/A' : 'Poluição N/A';
                poluEl.style.color = '#888';
            }
        }

        // 3. VERIFICA ALERTAS
        verificarAlertasClima(temperatura, umidade);
        verificarClimaNormal(temperatura, umidade);

    } catch(e) {
        console.error("Erro clima:", e);
    }
}

// ==========================================
// VERIFICAR ALERTA DE POLUIÇÃO
// ==========================================
function verificarAlertaPoluicao(aqi) {
    const alertaDiv = document.getElementById('alerta-sound-clima');
    
    if (alertaDiv.style.display === 'none' || alertaDiv.style.display === '') {
        if (aqi >= 4) {
            alertaDiv.style.display = 'flex';
            alertaDiv.className = 'alerta-clima-label alerta-poluicao';
            
            const textoAlerta = aqi >= 5 ? 'ATENÇÃO: Qualidade do Ar PÉSSIMA!' : 'ATENÇÃO: Qualidade do Ar MUITO RUIM!';
            alertaDiv.innerHTML = `🌫️ ${textoAlerta}`;
            alertaDiv.classList.add('alerta-poluicao');
            
            if (alertaAtivoAtual !== 'poluicao') {
                somAlerta.play().catch(e => console.log("Aguardando interação..."));
                alertaAtivoAtual = 'poluicao';
            }
        } else {
            if (alertaAtivoAtual === 'poluicao') {
                alertaDiv.style.display = 'none';
                alertaAtivoAtual = '';
            }
        }
    }
}

// ==========================================
// VERIFICAR SE O CLIMA ESTÁ NORMAL
// ==========================================
function verificarClimaNormal(temp, umid) {
    const alertaNormalDiv = document.getElementById('alerta-normalidade');
    const alertaClimaDiv = document.getElementById('alerta-sound-clima');
    
    const semAlertas = !(temp >= 40 || temp <= 5 || umid <= 20);
    
    const poluicaoEl = document.getElementById('poluicaoAtual');
    const textoPoluicao = poluicaoEl.textContent;
    const poluicaoBoa = textoPoluicao.includes('Boa') || textoPoluicao.includes('Moderada');
    
    if (semAlertas && poluicaoBoa && alertaClimaDiv.style.display !== 'flex') {
        if (!alertaNormalidadeMostrado) {
            alertaNormalDiv.style.display = 'flex';
            alertaNormalDiv.innerHTML = '✅ Clima normal. Aproveite!';
            tocarBeepNormalidade();
            alertaNormalidadeMostrado = true;
            
            setTimeout(() => {
                alertaNormalDiv.style.display = 'none';
            }, 8000);
        }
    } else {
        if (alertaClimaDiv.style.display === 'flex') {
            alertaNormalDiv.style.display = 'none';
        }
    }
}

// ==========================================
// BEEP DE NORMALIDADE
// ==========================================
function tocarBeepNormalidade() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var notas = [523, 659];
        var duracao = 0.15;
        
        notas.forEach(function(freq, index) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + (index * 0.2));
            gain.gain.setValueAtTime(0.15, ctx.currentTime + (index * 0.2));
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (index * 0.2) + duracao);
            osc.start(ctx.currentTime + (index * 0.2));
            osc.stop(ctx.currentTime + (index * 0.2) + duracao);
        });
        
        console.log('🔔 Beep de normalidade tocado');
    } catch(e) {
        console.warn('Beep de normalidade falhou:', e);
    }
}

// ==========================================
// SISTEMA DE ALERTA DE CLIMA
// ==========================================
function verificarAlertasClima(temp, umid) {
    if (temp === undefined || umid === undefined) {
        const tempTexto = document.getElementById('temperaturaAtual').textContent;
        const umidTexto = document.getElementById('umidadeAtual').textContent;
        temp = parseFloat(tempTexto.replace(/[^0-9.-]/g, ''));
        umid = parseFloat(umidTexto.replace(/[^0-9.-]/g, ''));
    }
    
    if (isNaN(temp) || isNaN(umid)) return;

    const alertaDiv = document.getElementById('alerta-sound-clima');
    let novoAlerta = '';
    alertaDiv.className = 'alerta-clima-label';

    if (temp >= 40) {
        novoAlerta = 'quente';
        alertaDiv.innerHTML = '🔥 ALERTA: Temperatura Extrema!';
        alertaDiv.classList.add('alerta-quente');
    } else if (temp <= 5) {
        novoAlerta = 'frio';
        alertaDiv.innerHTML = '❄️ ALERTA: Frio Extremo!';
        alertaDiv.classList.add('alerta-frio');
    } else if (umid <= 20) {
        novoAlerta = 'seco';
        alertaDiv.innerHTML = '️ ATENÇÃO: Umidade do Ar Baixa!';
        alertaDiv.classList.add('alerta-seco');
    } else {
        alertaDiv.style.display = 'none';
        alertaAtivoAtual = '';
        return;
    }

    if (novoAlerta !== '') {
        alertaDiv.style.display = 'flex';
        if (novoAlerta !== alertaAtivoAtual) {
            somAlerta.play().catch(e => console.log("Aguardando interação..."));
            alertaAtivoAtual = novoAlerta;
        }
    }
}

// ==========================================
// OBSERVADOR AUTOMÁTICO
// ==========================================
const observer = new MutationObserver(function() {
    verificarAlertasClima();
});

const configObserver = { childList: true, subtree: true };

// Inicia a observação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    const elemTemp = document.getElementById('temperaturaAtual');
    const elemUmid = document.getElementById('umidadeAtual');
    
    if (elemTemp) observer.observe(elemTemp, configObserver);
    if (elemUmid) observer.observe(elemUmid, configObserver);
});

// ==========================================
// FUNÇÕES DE INTERFACE
// ==========================================
function toggleMenu() {
    const menu = document.getElementById('menu-lateral');
    const overlay = document.getElementById('menu-overlay');
    
    if (menu && overlay) {
        if (menu.style.left === '0px' || menu.style.left === '') {
            menu.style.left = '-300px';
            overlay.style.display = 'none';
        } else {
            menu.style.left = '0px';
            overlay.style.display = 'block';
        }
    }
}

function showPage(pageName) {
    const pages = document.querySelectorAll('.app-page');
    pages.forEach(page => {
        page.style.display = 'none';
    });

    const targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
        targetPage.style.display = 'block';
        
        if (pageName === 'mapa' && typeof map !== 'undefined') {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }

    toggleMenu();
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ App X9 Radar: DOM pronto.');
    
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => { 
                splash.style.display = 'none'; 
            }, 500);
        }
    }, 3000);
});

// ==========================================
// EXPORTAR FUNÇÕES PARA ESCOPO GLOBAL
// ==========================================
window.atualizarInterfaceCabecalho = atualizarInterfaceCabecalho;
window.atualizarCidade = atualizarCidade;
window.atualizarTemperatura = atualizarTemperatura;
window.toggleMenu = toggleMenu;
window.showPage = showPage;
window.setUserLocation = function(lat, lng) {
    userLat = lat;
    userLng = lng;
};
