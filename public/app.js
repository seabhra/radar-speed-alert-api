// ==========================================
// APP.JS - CONTROLE DE INTERFACE 
// ==========================================

// FUNÇÃO ATUALIZAR NOME DA CIDADE LOCAL

async function atualizarCidade(lat, lng) {
    try {

        if (
            lat == null ||
            lng == null ||
            isNaN(lat) ||
            isNaN(lng)
        ) {
            console.warn("[Radar X9] Coordenadas inválidas para atualizar cidade:", lat, lng);
            return;
        }

        const resposta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
        );

        if (!resposta.ok) {
            console.warn(
                "[Radar X9] Nominatim respondeu:",
                resposta.status
            );
            return;
        }

        const dados = await resposta.json();

        if (!dados.address) {
            console.warn("[Radar X9] Nominatim não retornou endereço:", dados);
            return;
        }

        const cidade =
            dados.address.city ||
            dados.address.town ||
            dados.address.municipality ||
            dados.address.village;

        if (cidade && cidade !== ultimaCidade) {

            ultimaCidade = cidade;

            const nomeEl = document.getElementById("nomeCidade");

            if (nomeEl) {
                nomeEl.textContent = "📍" + cidade;
                nomeEl.style.color = corCidade(cidade);
            }
        }

    } catch (e) {
        console.log("Erro cidade:", e);
    }
}

//=========================
// MUDANÇA DA COR DA CIDADE
//=========================
function corCidade(nome){

    let hash = 0;

    for(let i = 0; i < nome.length; i++){
        hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    }

    let hue = Math.abs(hash) % 360;

    // Evita faixas pouco agradáveis
    if (hue >= 20 && hue <= 40) hue = 45;      // remove marrom
    if (hue >= 250 && hue <= 295) hue = 210;   // troca roxo por azul

    return `hsl(${hue},100%,68%)`;
}

// 1. Função para atualizar o cabeçalho (chamada pelo mapa.js)
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


// =============================================
// ATUALIZAR TEMPERATURA, UMIDADE E POLUIÇÃO
// =============================================
async function atualizarTemperatura() {
    if (!userLat || !userLng) return;

    try {
        const API_KEY = 'a5c507ef270b147035538e0d6019bce1';
        
        // ==========================================
        // 1. BUSCA DADOS DE CLIMA
        // ==========================================
        const urlClima = `https://api.openweathermap.org/data/2.5/weather?lat=${userLat}&lon=${userLng}&appid=${API_KEY}&units=metric&lang=pt_br`;
        const respostaClima = await fetch(urlClima);
        
        if (!respostaClima.ok) throw new Error('Erro na API de clima: ' + respostaClima.status);
        const dadosClima = await respostaClima.json();

        const temperatura = dadosClima.main.temp;
        const umidade = dadosClima.main.humidity;

        // ==========================================
        // DETECTA SE É MOBILE
        // ==========================================
        const isMobile = window.innerWidth <= 600;
        
        // ==========================================
        // ATUALIZA TEMPERATURA
        // ==========================================
        const tempEl = document.getElementById('temperaturaAtual');
        if (tempEl) {
            const valorTemp = temperatura.toFixed(1) + '°C';
            if (isMobile) {
                // APP: apenas o valor "26.9°C"
                tempEl.textContent = valorTemp;
            } else {
                // SITE: "Temperatura 26.9°C"
                tempEl.textContent = 'Temperatura ' + valorTemp;
            }
            tempEl.style.color = '#ffffff';
        }
        
        // ==========================================
        // ATUALIZA UMIDADE
        // ==========================================
        const umidEl = document.getElementById('umidadeAtual');
        if (umidEl) {
            let valorUmid = (umidade !== undefined && umidade !== null) ? umidade + '%' : '--%';
            if (isMobile) {
                // APP: apenas o valor "40%"
                umidEl.textContent = valorUmid;
            } else {
                // SITE: "Umidade 40%"
                umidEl.textContent = 'Umidade ' + valorUmid;
            }
            umidEl.style.color = '#ffffff';
        }

        // ==========================================
        // 2. BUSCA POLUIÇÃO DO AR
        // ==========================================
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
                    let valorPol =  '';
                    if (valorPoluicao > 0) {
                        valorPol = infoPoluicao.texto + ' ' + valorPoluicao;
                    } else {
                        valorPol = infoPoluicao.texto;
                    }
                    
                    if (isMobile) {
                        // APP: apenas o valor "Moderada 6"
                        poluEl.textContent = valorPol;
                    } else {
                        // SITE: "Poluição Moderada 6"
                        poluEl.textContent = '' + valorPol;
                    }
                    poluEl.style.color = infoPoluicao.cor;
                }
                
                verificarAlertaPoluicao(aqi);
            } else {
                const poluEl = document.getElementById('poluicaoAtual');
                if (poluEl) {
                    if (isMobile) {
                        poluEl.textContent = 'N/A';
                    } else {
                        poluEl.textContent = 'Poluição N/A';
                    }
                    poluEl.style.color = '#888';
                }
            }
        } catch (e) {
            console.warn('Erro ao buscar poluição:', e);
            const poluEl = document.getElementById('poluicaoAtual');
            if (poluEl) {
                if (isMobile) {
                    poluEl.textContent = 'N/A';
                } else {
                    poluEl.textContent = 'Poluição N/A';
                }
                poluEl.style.color = '#888';
            }
        }

        // ==========================================
        // 3. VERIFICA ALERTAS
        // ==========================================
        verificarAlertasClima(temperatura, umidade);
        verificarClimaNormal(temperatura, umidade);

    } catch(e) {
        console.error("Erro clima:", e);
    }
}

// =============================================
// VERIFICAR ALERTA DE POLUIÇÃO
// =============================================
function verificarAlertaPoluicao(aqi) {
    const alertaDiv = document.getElementById('alerta-sound-clima');
    
    // Se não tem alerta de clima ativo, pode mostrar o de poluição
    if (alertaDiv.style.display === 'none' || alertaDiv.style.display === '') {
        if (aqi >= 4) { // Muito Ruim ou Péssima
            alertaDiv.style.display = 'flex';
            alertaDiv.className = 'alerta-clima-label alerta-poluicao';
            
            // SEM EMOJIS
            const textoAlerta = aqi >= 5 ? 'ATENÇÃO: Qualidade do Ar PÉSSIMA!' : 'ATENÇÃO: Qualidade do Ar MUITO RUIM!';
            alertaDiv.innerHTML = `🌫️ ${textoAlerta}`;
            alertaDiv.classList.add('alerta-poluicao');
            
            // Toca som de alerta
            if (alertaAtivoAtual !== 'poluicao') {
                somAlerta.play().catch(e => console.log("Aguardando interação..."));
                alertaAtivoAtual = 'poluicao';
            }
        } else {
            // Remove alerta de poluição se o AQI melhorou
            if (alertaAtivoAtual === 'poluicao') {
                alertaDiv.style.display = 'none';
                alertaAtivoAtual = '';
            }
        }
    }
}



// =============================================
// VERIFICAR SE O CLIMA ESTÁ NORMAL (ALERTA POSITIVO)
// =============================================
function verificarClimaNormal(temp, umid) {
    const alertaNormalDiv = document.getElementById('alerta-normalidade');
    const alertaClimaDiv = document.getElementById('alerta-sound-clima');
    
    // Verifica se NÃO há alertas ativos
    const semAlertas = 
        !(temp >= 40 || temp <= 5 || umid <= 20);
    
    // Verifica se a poluição está boa (AQI 1 ou 2) - SEM EMOJIS
    const poluicaoEl = document.getElementById('poluicaoAtual');
    const textoPoluicao = poluicaoEl.textContent;
    const poluicaoBoa = textoPoluicao.includes('Boa') || textoPoluicao.includes('Moderada');
    
    // Se o clima está normal E a poluição está boa E NÃO há alertas de clima
    if (semAlertas && poluicaoBoa && alertaClimaDiv.style.display !== 'flex') {
        
        // Só mostra se ainda NÃO foi mostrado nesta sessão
        if (!alertaNormalidadeMostrado) {
            alertaNormalDiv.style.display = 'flex';
            alertaNormalDiv.innerHTML = '✅ Clima normal. Aproveite!';
            
            // Toca o beep ao aparecer
            tocarBeepNormalidade();
            
            // Marca como já mostrado
            alertaNormalidadeMostrado = true;
            
            // Mostra por 8 segundos e depois some
            setTimeout(() => {
                alertaNormalDiv.style.display = 'none';
            }, 8000);
        }
    } else {
        // Esconde o alerta de normalidade se houver alertas ativos
        if (alertaClimaDiv.style.display === 'flex') {
            alertaNormalDiv.style.display = 'none';
        }
    }
}

// =============================================
// BEEP DE NORMALIDADE (som suave e agradável)
// =============================================
function tocarBeepNormalidade() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Toca duas notas suaves (C5 e E5)
        var notas = [523, 659]; // C5 e E5
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
//=====================================
// FUNÇÃO POSIONAR TEMPERATURA LOCAL
//=====================================
function posicionarTemperatura(temp){

    const minimo = -20;

    const maximo = 50;

    let porcentagem =

        ((temp-minimo)/(maximo-minimo))*100;

    porcentagem = Math.max(0,Math.min(100,porcentagem));

    document.getElementById("ponteiroTemp").style.left =
        porcentagem+"%";

}



// =======================================================
// SISTEMA DE ALERTA DE CLIMA (Umidade e Temperatura)
// =======================================================

const somAlerta = new Audio('audio_app/alerta_sound_clima.mp3');
somAlerta.volume = 0.5;

let alertaAtivoAtual = '';


function verificarAlertasClima(temp, umid) {
    // Se os parâmetros não foram passados, busca do DOM
    if (temp === undefined || umid === undefined) {
        const tempTexto = document.getElementById('temperaturaAtual').textContent;
        const umidTexto = document.getElementById('umidadeAtual').textContent;
        temp = parseFloat(tempTexto.replace(/[^0-9.-]/g, ''));
        umid = parseFloat(umidTexto.replace(/[^0-9.-]/g, ''));
    }
    
    if (isNaN(temp) || isNaN(umid)) return;

    const alertaDiv = document.getElementById('alerta-sound-clima');
    let novoAlerta = '';

    // Limpa classes anteriores
    alertaDiv.className = 'alerta-clima-label';

    // Condição 1: Calor Extremo (Acima de 40°C)
    if (temp >= 40) {
        novoAlerta = 'quente';
        alertaDiv.innerHTML = '🔥 ALERTA: Temperatura Extrema!';
        alertaDiv.classList.add('alerta-quente');
    } 
    // Condição 2: Frio Extremo (Abaixo de 5°C)
    else if (temp <= 5) {
        novoAlerta = 'frio';
        alertaDiv.innerHTML = '❄️ ALERTA: Frio Extremo!';
        alertaDiv.classList.add('alerta-frio');
    } 
    // Condição 3: Umidade Baixa (Abaixo de 20%)
    else if (umid <= 20) {
        novoAlerta = 'seco';
        alertaDiv.innerHTML = '🏜️ ATENÇÃO: Umidade do Ar Baixa!';
        alertaDiv.classList.add('alerta-seco');
    } else {
        // Se não há alertas, esconde o alerta
        alertaDiv.style.display = 'none';
        alertaAtivoAtual = '';
        return;
    }

    // Mostra o alerta e toca o som
    if (novoAlerta !== '') {
        alertaDiv.style.display = 'flex';
        
        if (novoAlerta !== alertaAtivoAtual) {
            somAlerta.play().catch(e => console.log("Aguardando interação..."));
            alertaAtivoAtual = novoAlerta;
        }
    }
}

// =======================================================
// OBSERVADOR AUTOMÁTICO (A MÁGICA ACONTECE AQUI)
// =======================================================


const observer = new MutationObserver(function() {
    verificarAlertasClima();
});

// Configuração do observador
const configObserver = { childList: true, subtree: true };

// Inicia a observação no elemento de temperatura e umidade
const elemTemp = document.getElementById('temperaturaAtual');
const elemUmid = document.getElementById('umidadeAtual');

if (elemTemp) observer.observe(elemTemp, configObserver);
if (elemUmid) observer.observe(elemUmid, configObserver);



//===================================
// 2. Função para abrir/fechar o menu (FUNCIONA 100% DAS VEZES)
//===================================
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

// 3. Função para trocar de página SEM recarregar e SEM sobrepor
function showPage(pageName) {
    // Esconde TODAS as páginas primeiro
    const pages = document.querySelectorAll('.app-page');
    pages.forEach(page => {
        page.style.display = 'none';
    });

    // Mostra apenas a página clicada
    const targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
        targetPage.style.display = 'block';
        
        // Se for a página do mapa, força o Leaflet a se redesenhar
        if (pageName === 'mapa' && typeof map !== 'undefined') {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }

    // FORÇA o fechamento do menu após clicar
    toggleMenu();
}

// 4. Inicialização segura ao carregar a página

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ App X9 Radar: DOM pronto.');
    
    // Esconde a splash screen após 3 segundos (tempo suficiente para carregar)
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => { 
                splash.style.display = 'none'; 
            }, 500);
        }
    }, 3000); // Aumentado de 2.5s para 3s
});

// ==========================================
// FUNÇÕES DAS PÁGINAS
// ==========================================

// Copiar chave PIX
function copiarChavePix() {
    const pixKey = document.getElementById('pix-key').textContent;
    
    navigator.clipboard.writeText(pixKey).then(() => {
        // Feedback visual
        const btn = document.querySelector('.btn-copy-pix');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = '<span class="copy-icon">✅</span> Copiado!';
        btn.style.background = '#00cc66';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
        
        // Toast notification
        showToast('Chave PIX copiada com sucesso!');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        showToast('Erro ao copiar chave PIX');
    });
}

// Selecionar valor de doação
function selecionarValor(valor) {
    // Remover seleção anterior
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Adicionar seleção no botão clicado
    event.target.closest('.amount-btn').classList.add('selected');
    
    // Mostrar mensagem
    showToast(`Valor selecionado: R$ ${valor},00`);
    
    // Aqui você pode redirecionar para pagamento ou mostrar QR Code dinâmico
    setTimeout(() => {
        alert(`Para doar R$ ${valor},00, use a chave PIX: seabhra@gmail.com`);
    }, 500);
}

// Valor customizado
function selecionarValorCustom() {
    const valor = prompt('Digite o valor da doação (R$):');
    
    if (valor && !isNaN(valor) && valor > 0) {
        showToast(`Valor personalizado: R$ ${parseFloat(valor).toFixed(2)}`);
        
        setTimeout(() => {
            alert(`Para doar R$ ${parseFloat(valor).toFixed(2)}, use a chave PIX: seabhra@gmail.com`);
        }, 500);
    }
}

// Toast notification
function showToast(mensagem) {
    // Criar toast se não existir
    let toast = document.getElementById('toast-notification');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: 600;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = mensagem;
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

// Mostrar página
function showPage(pageName) {
    console.log('Navegando para:', pageName);
    
    // Esconder todas as páginas
    document.querySelectorAll('.app-page').forEach(page => {
        page.style.display = 'none';
    });
    
    // Mostrar página selecionada
    const targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.scrollTop = 0; // Resetar scroll
        
        // Se for mapa, redesenhar
        if (pageName === 'mapa' && typeof map !== 'undefined') {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }
    
    // Fechar menu se estiver aberto
    const menu = document.getElementById('menu-lateral');
    const overlay = document.getElementById('menu-overlay');
    if (menu && overlay) {
        menu.style.left = '-300px';
        overlay.style.display = 'none';
    }
}

// Fechar app
function fecharApp() {
    if (confirm('Deseja realmente fechar o aplicativo?')) {
        window.close();
        // Fallback para mobile
        setTimeout(() => {
            alert('Para fechar completamente, use o botão voltar do seu dispositivo.');
        }, 500);
    }
}

