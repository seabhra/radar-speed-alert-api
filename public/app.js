// ==========================================
// APP.JS - CONTROLE DE INTERFACE (BLINDADO)
// ==========================================

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

// 2. Função para abrir/fechar o menu (FUNCIONA 100% DAS VEZES)
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
    console.log('✅ App X9 Radar: DOM pronto e funções carregadas.');
    
    // Esconde a splash screen após 2.5 segundos
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        }
    }, 2500);
});