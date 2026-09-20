




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

// Função para atualizar o cabeçalho (chame isso a partir do mapa.js quando tiver os dados)
function atualizarCabecalhoApp(cidade, temperatura, gpsOk) {
    const elCidade = document.getElementById('header-cidade');
    const elClima = document.getElementById('header-clima');
    const elGps = document.getElementById('header-gps-status');

    if (elCidade) elCidade.textContent = cidade || "Localização atual";
    if (elClima) elClima.textContent = temperatura ? `${temperatura}°C` : "--°C";
    
    if (elGps) {
        elGps.style.background = gpsOk ? '#00ff00' : '#ff0000'; // Verde se OK, Vermelho se ERR
    }
}