
// /api/get-radares.js

import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_OWNER || 'seabhra';
  const REPO = process.env.GITHUB_REPO || 'radar-speed-alert-api';
  
  // 1. Função para ler o arquivo LOCAL da pasta /public (Mais rápido e 100% confiável)
    function lerArquivoLocal() {
    try {
      // Tenta 3 caminhos possíveis no Vercel
      const caminhosPossiveis = [
        path.join(process.cwd(), 'public', 'radares.json'),
        path.join(process.cwd(), 'radares.json'),
        path.join(__dirname, '..', 'public', 'radares.json') // Fallback para algumas estruturas Next.js
      ];

      for (const caminho of caminhosPossiveis) {
        if (fs.existsSync(caminho)) {
          const fileContents = fs.readFileSync(caminho, 'utf8');
          const parsed = JSON.parse(fileContents);
          console.log(`[API] ✅ Arquivo local encontrado e lido em: ${caminho}`);
          return Array.isArray(parsed) ? parsed : (parsed.records || []);
        }
      }
      
      console.log('[API] ⚠️ Arquivo radares.json NÃO encontrado em nenhum dos caminhos locais.');
      return [];
    } catch (error) {
      console.error('[API] ❌ Falha crítica ao ler arquivo local radares.json:', error.message);
      return [];
    }
  }

  // 2. Função auxiliar para buscar o arquivo DINÂMICO do GitHub (radares_app.json)
  async function fetchGitHubFile(filePath) {
    if (!GITHUB_TOKEN) {
        console.warn('[API] ⚠️ GITHUB_TOKEN não configurado. Não é possível ler radares_app.json do GitHub.');
        return [];
    }
    try {
      const metaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!metaResp.ok) {
        if (metaResp.status === 404) {
            console.warn(`[API] ⚠️ Arquivo ${filePath} não encontrado no GitHub.`);
            return []; 
        }
        throw new Error(`Erro ao buscar metadados de ${filePath}: ${metaResp.status}`);
      }
      
      const meta = await metaResp.json();
      const blobResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${meta.sha}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!blobResp.ok) throw new Error(`Erro ao buscar blob de ${filePath}`);
      
      const blob = await blobResp.json();
      const content = Buffer.from(blob.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      
      return Array.isArray(parsed) ? parsed : (parsed.records || []);
      
    } catch (error) {
      console.warn(`[API] Falha ao ler GitHub ${filePath}:`, error.message);
      return [];
    }
  }

  try {
    console.log('[API] 🔄 Buscando radares oficiais (local) e dos usuários (GitHub)...');
    
    // Executa as duas leituras
    const radaresOficiais = lerArquivoLocal();
    const radaresApp = await fetchGitHubFile('radares_app.json');

    // Une os dois arrays. Usamos um Map para evitar duplicatas pelo ID (índice 0 do array)
    const mapaRadares = new Map();
    
    // Adiciona oficiais primeiro
    radaresOficiais.forEach(r => {
        if (r && r[0] !== undefined) mapaRadares.set(r[0], r);
    });
    
    // Adiciona/Atualiza com os dos usuários (se houver conflito de ID, o do usuário prevalece)
    radaresApp.forEach(r => {
        if (r && r[0] !== undefined) mapaRadares.set(r[0], r);
    });

    const radaresUnificados = Array.from(mapaRadares.values());

    console.log(`[API] ✅ Sucesso! Oficiais (Local): ${radaresOficiais.length}, App (GitHub): ${radaresApp.length}, Total Unificado: ${radaresUnificados.length}`);

    // Cache de 1 minuto para economizar recursos do servidor
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(radaresUnificados);

  } catch (err) {
    console.error('[API] 💥 Erro crítico:', err);
    res.status(500).json({ error: 'Erro interno ao buscar radares' });
  }
}