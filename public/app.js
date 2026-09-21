// ==========================================
// APP.JS - CONTROLE DE INTERFACE 
// ==========================================
// Versão: 2.0 - Corrigido para evitar duplicações
// ==========================================

(function() {
    'use strict';

    // ==========================================
    // DECLARAÇÃO SEGURA DE VARIÁVEIS GLOBAIS
    // (Evita "already been declared")
    // ==========================================
    if (typeof window.ultimaCidade === 'undefined') window.ultimaCidade = '';
    if (typeof window.alertaNormalidadeMostrado === 'undefined') window.alertaNormalidadeMostrado = false;
    if (typeof window.alertaAtivoAtual === 'undefined') window.alertaAtivoAtual = '';
    if (typeof window.userLat === 'undefined') window.userLat = null;
    if (typeof window.userLng === 'undefined') window.userLng = null;

    // ==========================================
    // ÁUDIO DE ALERTA (DECLARAR UMA VEZ)
    // ==========================================
    if (!window.somAlerta) {
        try {
            window.somAlerta = new Audio('audio_app/alerta_sound_clima.mp3');
            window.somAlerta.volume = 0.5;
        } catch(e) {
            console.warn('⚠️ Audio não inicializado:', e);
            window.somAlerta = { play: () => Promise.resolve() };
        }
    }

    // ==========================================
    // FUNÇÃO ATUALIZAR NOME DA CIDADE
    // ==========================================
    window.atualizarCidade = async function(lat, lng) {
        try {
            if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

            const resposta = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
            );

            if (!resposta.ok) return;

            const dados = await resposta.json();
            if (!dados.address) return;

            const cidade = dados.address.city || dados.address.town || 
                          dados.address.municipality || dados.address.village;

            if (cidade && cidade !== window.ultimaCidade) {
                window.ultimaCidade = cidade;
                const nomeEl = document.getElementById("nomeCidade");
                if (nomeEl) {
                    nomeEl.textContent = cidade;
                    nomeEl.style.color = corCidade(cidade);
                }
            }
        } catch (e) {
            console.log("Erro cidade:", e);
        }
    };

    // ==========================================
    // COR DA CIDADE
    // ==========================================
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

    // ==========================================
    // ATUALIZAR CABEÇALHO (EXPORTADA IMEDIATAMENTE)
    // ==========================================
    window.atualizarInterfaceCabecalho = function(dados) {
        if (!dados) return;

        if (dados.cidade) {
            const el = document.getElementById('nomeCidade');
            if (el) el.textContent = dados.cidade;
        }
        if (dados.temp !== undefined) {
            const el = document.getElementById('temperaturaAtual');
            if (el) el.textContent = dados.temp.toFixed(1) + '°C';
        }
        if (dados.umidade !== undefined) {
            const el = document.getElementById('umidadeAtual');
            if (el) el.textContent = dados.umidade + '%';
        }
        if (dados.poluicaoTexto) {
            const el = document.getElementById('poluicaoAtual');
            if (el) el.textContent = dados.poluicaoTexto;
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
        }
    };

    // ==========================================
    // ATUALIZAR TEMPERATURA
    // ==========================================
    window.atualizarTemperatura = async function() {
        if (!window.userLat || !window.userLng) return;

        try {
            const API_KEY = 'a5c507ef270b147035538e0d6019bce1';
            const urlClima = `https://api.openweathermap.org/data/2.5/weather?lat=${window.userLat}&lon=${window.userLng}&appid=${API_KEY}&units=metric&lang=pt_br`;
            const respostaClima = await fetch(urlClima);
            
            if (!respostaClima.ok) throw new Error('Erro API clima');
            const dadosClima = await respostaClima.json();

            const temperatura = dadosClima.main.temp;
            const umidade = dadosClima.main.humidity;
            const isMobile = window.innerWidth <= 600;

            const tempEl = document.getElementById('temperaturaAtual');
            if (tempEl) {
                tempEl.textContent = isMobile ? temperatura.toFixed(1) + '°C' : 'Temperatura ' + temperatura.toFixed(1) + '°C';
                tempEl.style.color = '#ffffff';
            }

            const umidEl = document.getElementById('umidadeAtual');
            if (umidEl) {
                umidEl.textContent = isMobile ? umidade + '%' : 'Umidade ' + umidade + '%';
                umidEl.style.color = '#ffffff';
            }

            try {
                const urlPoluicao = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${window.userLat}&lon=${window.userLng}&appid=${API_KEY}`;
                const respostaPoluicao = await fetch(urlPoluicao);
                
                if (respostaPoluicao.ok) {
                    const dadosPoluicao = await respostaPoluicao.json();
                    const aqi = dadosPoluicao.list[0].main.aqi;
                    
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
                        poluEl.textContent = isMobile ? infoPoluicao.texto : 'Poluição ' + infoPoluicao.texto;
                        poluEl.style.color = infoPoluicao.cor;
                    }
                    
                    verificarAlertaPoluicao(aqi);
                }
            } catch (e) {
                console.warn('Erro poluição:', e);
            }

            verificarAlertasClima(temperatura, umidade);
            verificarClimaNormal(temperatura, umidade);

        } catch(e) {
            console.error("Erro clima:", e);
        }
    };

    function verificarAlertaPoluicao(aqi) {
        const alertaDiv = document.getElementById('alerta-sound-clima');
        if (!alertaDiv) return;
        
        if (alertaDiv.style.display === 'none' || alertaDiv.style.display === '') {
            if (aqi >= 4) {
                alertaDiv.style.display = 'flex';
                alertaDiv.className = 'alerta-clima-label alerta-poluicao';
                alertaDiv.innerHTML = `🌫️ ATENÇÃO: Qualidade do Ar ${aqi >= 5 ? 'PÉSSIMA' : 'MUITO RUIM'}!`;
                
                if (window.alertaAtivoAtual !== 'poluicao') {
                    window.somAlerta.play().catch(() => {});
                    window.alertaAtivoAtual = 'poluicao';
                }
            } else if (window.alertaAtivoAtual === 'poluicao') {
                alertaDiv.style.display = 'none';
                window.alertaAtivoAtual = '';
            }
        }
    }

    function verificarClimaNormal(temp, umid) {
        const alertaNormalDiv = document.getElementById('alerta-normalidade');
        const alertaClimaDiv = document.getElementById('alerta-sound-clima');
        if (!alertaNormalDiv || !alertaClimaDiv) return;
        
        const semAlertas = !(temp >= 40 || temp <= 5 || umid <= 20);
        const poluicaoEl = document.getElementById('poluicaoAtual');
        const poluicaoBoa = poluicaoEl && (poluicaoEl.textContent.includes('Bom') || poluicaoEl.textContent.includes('Moderado'));
        
        if (semAlertas && poluicaoBoa && alertaClimaDiv.style.display !== 'flex' && !window.alertaNormalidadeMostrado) {
            alertaNormalDiv.style.display = 'flex';
            alertaNormalDiv.innerHTML = '✅ Clima normal. Aproveite!';
            window.alertaNormalidadeMostrado = true;
            
            setTimeout(() => { alertaNormalDiv.style.display = 'none'; }, 8000);
        }
    }

    function verificarAlertasClima(temp, umid) {
        if (temp === undefined || umid === undefined) return;
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
            alertaDiv.innerHTML = '🏜️ ATENÇÃO: Umidade Baixa!';
            alertaDiv.classList.add('alerta-seco');
        } else {
            alertaDiv.style.display = 'none';
            window.alertaAtivoAtual = '';
            return;
        }

        alertaDiv.style.display = 'flex';
        if (novoAlerta !== window.alertaAtivoAtual) {
            window.somAlerta.play().catch(() => {});
            window.alertaAtivoAtual = novoAlerta;
        }
    }

    // ==========================================
    // OBSERVADOR DE MUDANÇAS
    // ==========================================
    document.addEventListener('DOMContentLoaded', function() {
        const observer = new MutationObserver(() => verificarAlertasClima());
        const configObserver = { childList: true, subtree: true };
        
        const elemTemp = document.getElementById('temperaturaAtual');
        const elemUmid = document.getElementById('umidadeAtual');
        
        if (elemTemp) observer.observe(elemTemp, configObserver);
        if (elemUmid) observer.observe(elemUmid, configObserver);
    });

    // ==========================================
    // FUNÇÕES DE INTERFACE
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

    window.showPage = function(pageName) {
        const pages = document.querySelectorAll('.app-page');
        pages.forEach(page => page.style.display = 'none');

        const targetPage = document.getElementById('page-' + pageName);
        if (targetPage) {
            targetPage.style.display = 'block';
            if (pageName === 'mapa' && typeof map !== 'undefined') {
                setTimeout(() => map.invalidateSize(), 100);
            }
        }
        window.toggleMenu();
    };

    window.setUserLocation = function(lat, lng) {
        window.userLat = lat;
        window.userLng = lng;
    };

    // ==========================================
    // INICIALIZAÇÃO - SPLASH SCREEN
    // ==========================================
    function removerSplash() {
        const splash = document.getElementById('splash-screen');
        if (splash && splash.style.display !== 'none') {
            console.log('🔄 Removendo splash screen...');
            splash.style.opacity = '0';
            splash.style.pointerEvents = 'none';
            setTimeout(() => {
                splash.style.display = 'none';
                console.log('✅ Splash screen removida');
            }, 500);
        }
    }

    // Remove splash quando tudo carregar
    window.addEventListener('load', function() {
        console.log('✅ Página carregada completamente');
        setTimeout(removerSplash, 2500);
    });

    // Fallback absoluto - remove splash em 5s mesmo com erros
    setTimeout(removerSplash, 5000);

    console.log('✅ app.js v2.0 carregado com sucesso');
})();
