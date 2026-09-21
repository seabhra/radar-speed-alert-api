// ==========================================
// APP.JS - CONTROLE DE INTERFACE (VERSÃO FINAL)
// ==========================================

'use strict';

// 1. DECLARAÇÃO DE VARIÁVEIS GLOBAIS (Evita erros de referência)
let ultimaCidade = '';
let alertaNormalidadeMostrado = false;
let alertaAtivoAtual = '';
let userLat = null;
let userLng = null;

// Inicialização segura do áudio
let somAlerta;
try {
    somAlerta = new Audio('audio_app/alerta_sound_clima.mp3');
    somAlerta.volume = 0.5;
} catch (e) {
    console.warn('⚠️ [APP.JS] Áudio não inicializado:', e);
    somAlerta = { play: () => Promise.resolve() }; // Fallback seguro
}

// ==========================================
// 2. FUNÇÕES PRINCIPAIS (Exportadas para window)
// ==========================================

window.atualizarCidade = async function(lat, lng) {
    console.log('📍 [APP.JS] Tentando atualizar cidade:', lat, lng);
    
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
        console.warn("⚠️ [APP.JS] Coordenadas inválidas para atualizar cidade");
        return;
    }

    try {
        const resposta = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);

        if (!resposta.ok) {
            console.warn("⚠️ [APP.JS] Nominatim respondeu com status:", resposta.status);
            return;
        }

        const dados = await resposta.json();

        if (!dados.address) {
            console.warn("⚠️ [APP.JS] Nominatim não retornou endereço:", dados);
            return;
        }

        const cidade = dados.address.city || dados.address.town || dados.address.municipality || dados.address.village;

        if (cidade && cidade !== ultimaCidade) {
            ultimaCidade = cidade;
            const nomeEl = document.getElementById("nomeCidade");

            if (nomeEl) {
                nomeEl.textContent = cidade; // Removido o 📍 do texto pois já está no HTML ou pode ser adicionado no CSS
                nomeEl.style.color = corCidade(cidade);
                console.log('✅ [APP.JS] Cidade atualizada com sucesso:', cidade);
            }
        }
    } catch (e) {
        console.error("❌ [APP.JS] Erro ao buscar cidade:", e);
    }
};

function corCidade(nome) {
    let hash = 0;
    for(let i = 0; i < nome.length; i++) {
        hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    }
    let hue = Math.abs(hash) % 360;
    if (hue >= 20 && hue <= 40) hue = 45;
    if (hue >= 250 && hue <= 295) hue = 210;
    return `hsl(${hue},100%,68%)`;
}

window.atualizarInterfaceCabecalho = function(dados) {
    console.log('🔄 [APP.JS] atualizarInterfaceCabecalho chamado com:', dados);
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
        console.log('✅ [APP.JS] Status do GPS atualizado. Precisão:', precisao);
    }
};

window.atualizarTemperatura = async function() {
    console.log('🌡️ [APP.JS] atualizarTemperatura chamado. userLat:', userLat, 'userLng:', userLng);
    
    if (!userLat || !userLng) {
        console.warn('⚠️ [APP.JS] Coordenadas (userLat/userLng) ainda não definidas. Aguardando...');
        return;
    }

    try {
        const API_KEY = 'a5c507ef270b147035538e0d6019bce1';
        const urlClima = `https://api.openweathermap.org/data/2.5/weather?lat=${userLat}&lon=${userLng}&appid=${API_KEY}&units=metric&lang=pt_br`;
        
        console.log('🌐 [APP.JS] Buscando clima em:', urlClima);
        const respostaClima = await fetch(urlClima);
        
        if (!respostaClima.ok) throw new Error('Erro na API de clima: ' + respostaClima.status);
        const dadosClima = await respostaClima.json();

        const temperatura = dadosClima.main.temp;
        const umidade = dadosClima.main.humidity;
        const isMobile = window.innerWidth <= 600;
        
        console.log('📊 [APP.JS] Dados climáticos recebidos. Temp:', temperatura, 'Umid:', umidade);

        const tempEl = document.getElementById('temperaturaAtual');
        if (tempEl) {
            const valorTemp = temperatura.toFixed(1) + '°C';
            tempEl.textContent = isMobile ? valorTemp : 'Temperatura ' + valorTemp;
            tempEl.style.color = '#ffffff';
        }
        
        const umidEl = document.getElementById('umidadeAtual');
        if (umidEl) {
            let valorUmid = (umidade !== undefined && umidade !== null) ? umidade + '%' : '--%';
            umidEl.textContent = isMobile ? valorUmid : 'Umidade ' + valorUmid;
            umidEl.style.color = '#ffffff';
        }

        // Busca Poluição
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
            }
        } catch (e) {
            console.warn('⚠️ [APP.JS] Erro ao buscar poluição:', e);
            const poluEl = document.getElementById('poluicaoAtual');
            if (poluEl) {
                poluEl.textContent = isMobile ? 'N/A' : 'Poluição N/A';
                poluEl.style.color = '#888';
            }
        }

        verificarAlertasClima(temperatura, umidade);
        verificarClimaNormal(temperatura, umidade);

    } catch(e) {
        console.error("❌ [APP.JS] Erro geral no clima:", e);
    }
};

// ==========================================
// 3. FUNÇÕES DE ALERTA E LÓGICA
// ==========================================

function verificarAlertaPoluicao(aqi) {
    const alertaDiv = document.getElementById('alerta-sound-clima');
    if (!alertaDiv) return;
    
    if (alertaDiv.style.display === 'none' || alertaDiv.style.display === '') {
        if (aqi >= 4) {
            alertaDiv.style.display = 'flex';
            alertaDiv.className = 'alerta-clima-label alerta-poluicao';
            const textoAlerta = aqi >= 5 ? 'ATENÇÃO: Qualidade do Ar PÉSSIMA!' : 'ATENÇÃO: Qualidade do Ar MUITO RUIM!';
            alertaDiv.innerHTML = `🌫️ ${textoAlerta}`;
            
            if (alertaAtivoAtual !== 'poluicao') {
                somAlerta.play().catch(e => console.log("Aguardando interação para áudio..."));
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

function verificarClimaNormal(temp, umid) {
    const alertaNormalDiv = document.getElementById('alerta-normalidade');
    const alertaClimaDiv = document.getElementById('alerta-sound-clima');
    if (!alertaNormalDiv || !alertaClimaDiv) return;
    
    const semAlertas = !(temp >= 40 || temp <= 5 || umid <= 20);
    const poluicaoEl = document.getElementById('poluicaoAtual');
    const textoPoluicao = poluicaoEl ? poluicaoEl.textContent : '';
    const poluicaoBoa = textoPoluicao.includes('Bom') || textoPoluicao.includes('Moderado');
    
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

function tocarBeepNormalidade() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notas = [523, 659];
        const duracao = 0.15;
        
        notas.forEach(function(freq, index) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + (index * 0.2));
            gain.gain.setValueAtTime(0.15, ctx.currentTime + (index * 0.2));
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (index * 0.2) + duracao);
            osc.start(ctx.currentTime + (index * 0.2));
            osc.stop(ctx.currentTime + (index * 0.2) + duracao);
        });
    } catch(e) {
        console.warn('Beep de normalidade falhou:', e);
    }
}

function verificarAlertasClima(temp, umid) {
    if (temp === undefined || umid === undefined) {
        const tempEl = document.getElementById('temperaturaAtual');
        const umidEl = document.getElementById('umidadeAtual');
        if (!tempEl || !umidEl) return;
        
        temp = parseFloat(tempEl.textContent.replace(/[^0-9.-]/g, ''));
        umid = parseFloat(umidEl.textContent.replace(/[^0-9.-]/g, ''));
    }
    
    if (isNaN(temp) || isNaN(umid)) return;

    const alertaDiv = document.getElementById('alerta-sound-clima');
    if (!alertaDiv) return;
    
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
        alertaDiv.innerHTML = '🏜️ ATENÇÃO: Umidade do Ar Baixa!';
        alertaDiv.classList.add('alerta-seco');
    } else {
        alertaDiv.style.display = 'none';
        alertaAtivoAtual = '';
        return;
    }

    if (novoAlerta !== '') {
        alertaDiv.style.display = 'flex';
        if (novoAlerta !== alertaAtivoAtual) {
            somAlerta.play().catch(e => console.log("Aguardando interação para áudio..."));
            alertaAtivoAtual = novoAlerta;
        }
    }
}

// ==========================================
// 4. FUNÇÕES DE INTERFACE (MENU E PÁGINAS)
// ==========================================

window.toggleMenu = function() {
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
};

// FUNÇÃO showPage UNIFICADA (Removida a duplicata)
window.showPage = function(pageName) {
    console.log('📄 [APP.JS] Navegando para:', pageName);
    
    const pages = document.querySelectorAll('.app-page');
    pages.forEach(page => {
        page.style.display = 'none';
    });

    const targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.scrollTop = 0;
        
        if (pageName === 'mapa' && typeof map !== 'undefined') {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }

    // FORÇA o fechamento do menu após clicar
    const menu = document.getElementById('menu-lateral');
    const overlay = document.getElementById('menu-overlay');
    if (menu && overlay) {
        menu.style.left = '-300px';
        overlay.style.display = 'none';
    }
};

window.fecharApp = function() {
    if (confirm('Deseja realmente fechar o aplicativo?')) {
        window.close();
        setTimeout(() => {
            alert('Para fechar completamente, use o botão voltar do seu dispositivo.');
        }, 500);
    }
};

// ==========================================
// 5. INICIALIZAÇÃO (DOMContentLoaded)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ [APP.JS] DOMContentLoaded disparado. Inicializando...');
    
    // 5.1 Esconder Splash Screen
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            console.log('🔄 [APP.JS] Ocultando splash screen...');
            splash.style.opacity = '0';
            splash.style.pointerEvents = 'none';
            setTimeout(() => { 
                splash.style.display = 'none'; 
                console.log('✅ [APP.JS] Splash screen removida do DOM.');
            }, 500);
        }
    }, 2500);

    // 5.2 Inicializar MutationObserver (AGORA COM SEGURANÇA)
    const elemTemp = document.getElementById('temperaturaAtual');
    const elemUmid = document.getElementById('umidadeAtual');
    
    if (elemTemp && elemUmid) {
        const observer = new MutationObserver(function() {
            verificarAlertasClima();
        });
        const configObserver = { childList: true, subtree: true };
        observer.observe(elemTemp, configObserver);
        observer.observe(elemUmid, configObserver);
        console.log('✅ [APP.JS] MutationObserver iniciado para alertas de clima.');
    } else {
        console.warn('⚠️ [APP.JS] Elementos de temperatura/umidade não encontrados para o Observer.');
    }

    // 5.3 Forçar uma tentativa de atualização após 3 segundos (caso o mapa.js demore)
    setTimeout(() => {
        if (userLat && userLng) {
            console.log('🔄 [APP.JS] Forçando atualização inicial de clima/cidade...');
            window.atualizarCidade(userLat, userLng);
            window.atualizarTemperatura();
        }
    }, 3000);
});

// ==========================================
// 6. FUNÇÕES AUXILIARES (PIX, TOAST, ETC)
// ==========================================

window.copiarChavePix = function() {
    const pixKeyElement = document.getElementById('pix-key');
    if (!pixKeyElement) return;
    
    const pixKey = pixKeyElement.textContent;
    navigator.clipboard.writeText(pixKey).then(() => {
        const btn = document.querySelector('.btn-copy-pix');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>✅</span> Copiado!';
            btn.style.background = '#00cc66';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 2000);
        }
        window.showToast('Chave PIX copiada com sucesso!');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        window.showToast('Erro ao copiar chave PIX');
    });
};

window.selecionarValor = function(valor) {
    document.querySelectorAll('.amount-btn').forEach(btn => btn.classList.remove('selected'));
    if (event && event.target) {
        const btn = event.target.closest('.amount-btn');
        if (btn) btn.classList.add('selected');
    }
    window.showToast(`Valor selecionado: R$ ${valor},00`);
    setTimeout(() => {
        alert(`Para doar R$ ${valor},00, use a chave PIX: seabhra@gmail.com`);
    }, 500);
};

window.selecionarValorCustom = function() {
    const valor = prompt('Digite o valor da doação (R$):');
    if (valor && !isNaN(valor) && valor > 0) {
        window.showToast(`Valor personalizado: R$ ${parseFloat(valor).toFixed(2)}`);
        setTimeout(() => {
            alert(`Para doar R$ ${parseFloat(valor).toFixed(2)}, use a chave PIX: seabhra@gmail.com`);
        }, 500);
    }
};

window.showToast = function(mensagem) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9); color: white; padding: 15px 30px;
            border-radius: 8px; z-index: 10000; font-weight: 600; opacity: 0;
            transition: opacity 0.3s ease; pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = mensagem;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
};

// Função para o mapa.js chamar e definir as coordenadas
window.setUserLocation = function(lat, lng) {
    console.log('📍 [APP.JS] setUserLocation chamado com:', lat, lng);
    userLat = lat;
    userLng = lng;
    
    // Dispara as atualizações imediatamente
    window.atualizarCidade(lat, lng);
    window.atualizarTemperatura();
};

console.log('✅ [APP.JS] Carregado e funções exportadas para window com sucesso.');
