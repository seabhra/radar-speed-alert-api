




// ====================================================
// CONTROLE DE NAVEGAÇÃO ENTRE PÁGINAS - NOVO NO SCRIPT
// ====================================================

// Esconder Splash Screen após carregar
window.addEventListener('load', function() {
    setTimeout(function() {
        var splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(function() {
                splash.style.display = 'none';
            }, 500);
        }
    }, 2500); // Splash fica visível por 2.5 segundos
});

// Toggle Menu Lateral
function toggleMenu() {
    var menu = document.getElementById('menu-lateral');
    var overlay = document.getElementById('menu-overlay');
    
    if (menu.style.left === '0px') {
        menu.style.left = '-300px';
        overlay.style.display = 'none';
    } else {
        menu.style.left = '0px';
        overlay.style.display = 'block';
    }
}

// Mostrar Página Específica
function showPage(pageName) {
    // Esconde todas as páginas
    var pages = document.querySelectorAll('.app-page');
    pages.forEach(function(page) {
        page.style.display = 'none';
    });
    
    // Mostra a página solicitada
    var targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
        targetPage.style.display = 'block';
        
        // Se for a página do mapa, atualiza o Leaflet
        if (pageName === 'mapa' && typeof map !== 'undefined') {
            setTimeout(function() {
                map.invalidateSize();
            }, 300);
        }
    }
    
    // Fecha o menu
    toggleMenu();
}

// Fechar App (Simulação para PWA)
function fecharApp() {
    if (confirm('Deseja realmente fechar o aplicativo?')) {
        // Tenta fechar a janela (funciona em alguns casos)
        window.close();
        
        // Se não conseguir fechar, redireciona para about:blank
        setTimeout(function() {
            window.location.href = 'about:blank';
        }, 500);
        
        // Alternativa: mostra mensagem
        setTimeout(function() {
            alert('Para fechar completamente, use o botão "Voltar" do seu celular ou feche a aba do navegador.');
        }, 1000);
    }
}


// ============================================
// INICIALIZAÇÃO SEGURA
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ App X9 Radar: DOM carregado e pronto!');
    
    // Esconder Splash Screen após carregar
    setTimeout(function() {
        var splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(function() {
                splash.style.display = 'none';
            }, 500);
        }
    }, 2500); // Splash fica visível por 2.5 segundos

    // Se o mapa já existir, atualiza o tamanho
    if (typeof map !== 'undefined') {
        setTimeout(function() {
            map.invalidateSize();
        }, 500);
    }

    // Previne que o menu lateral seja afetado pelo scroll do mapa
    var menuLateral = document.getElementById('menu-lateral');
    if (menuLateral) {
        menuLateral.addEventListener('touchmove', function(e) {
            e.stopPropagation();
        }, { passive: true });
    }
});

// ==========================================
// ATUALIZAR INTERFACE DO CABEÇALHO (App.js)
// ==========================================
function atualizarInterfaceCabecalho(dados) {
    // dados = { cidade, temp, umidade, poluicaoTexto, precisaoGPS }

    // 1. Atualizar Cidade
    const elCidade = document.getElementById('nomeCidade');
    if (elCidade && dados.cidade) {
        elCidade.textContent = dados.cidade; // O emoji 📍 já pode estar no HTML ou adicionado aqui
    }

    // 2. Atualizar Temperatura
    const elTemp = document.getElementById('temperaturaAtual');
    if (elTemp && dados.temp !== undefined) {
        elTemp.textContent = dados.temp.toFixed(1) + '°C';
    }

    // 3. Atualizar Umidade
    const elUmid = document.getElementById('umidadeAtual');
    if (elUmid && dados.umidade !== undefined) {
        elUmid.textContent = dados.umidade + '%';
    }

    // 4. Atualizar Poluição
    const elPoluicao = document.getElementById('poluicaoAtual');
    if (elPoluicao && dados.poluicaoTexto) {
        elPoluicao.textContent = dados.poluicaoTexto;
    }

    // 5. Atualizar STATUS DO GPS (A mágica das suas classes CSS)
    const wrapper = document.getElementById('gps-status-wrapper');
    const dot = document.getElementById('gps-status-dot');
    const label = document.getElementById('gps-status-label');

    if (wrapper && dot && label) {
        // Limpa todas as classes de estado anteriores
        wrapper.classList.remove('gps-ok', 'gps-warn', 'gps-err');
        dot.classList.remove('ok', 'warn', 'err');

        const precisao = dados.precisaoGPS || 999;

        if (precisao <= 50) {
            // 🟢 EXCELENTE
            wrapper.classList.add('gps-ok');
            dot.classList.add('ok');
            label.textContent = 'ATIVO';
            wrapper.title = `GPS Preciso: ${precisao}m`;
        } else if (precisao <= 150) {
            // 🟡 INSTÁVEL
            wrapper.classList.add('gps-warn');
            dot.classList.add('warn');
            label.textContent = 'INSTÁVEL';
            wrapper.title = `GPS Instável: ${precisao}m`;
        } else {
            // 🔴 RUIM / AGUARDANDO
            wrapper.classList.add('gps-err');
            dot.classList.add('err');
            label.textContent = 'AGUARDANDO';
            wrapper.title = `Aguardando sinal: ${precisao}m`;
        }
    }
}
