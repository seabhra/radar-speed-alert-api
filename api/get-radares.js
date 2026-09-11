// /api/get-radares.js

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_OWNER || 'seabhra';
  const REPO = process.env.GITHUB_REPO || 'radar-speed-alert-api';
  
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN não configurado no servidor.' });
  }

  // Função auxiliar para buscar e parsear um arquivo do GitHub
  async function fetchGitHubFile(filePath) {
    try {
      // 1. Pegar metadados (SHA)
      const metaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!metaResp.ok) {
        if (metaResp.status === 404) return []; // Arquivo não existe, retorna array vazio
        throw new Error(`Erro ao buscar metadados de ${filePath}: ${metaResp.status}`);
      }
      
      const meta = await metaResp.json();
      
      // 2. Pegar conteúdo via Blob (suporta >1MB)
      const blobResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${meta.sha}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!blobResp.ok) throw new Error(`Erro ao buscar blob de ${filePath}`);
      
      const blob = await blobResp.json();
      const content = Buffer.from(blob.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      
      // Normaliza para sempre retornar um array (handle { records: [] } ou [])
      return Array.isArray(parsed) ? parsed : (parsed.records || []);
      
    } catch (error) {
      console.warn(`[API] Falha ao ler ${filePath}:`, error.message);
      return []; // Retorna vazio em caso de erro, não quebra o app
    }
  }

  try {
    console.log('[API] 🔄 Buscando radares oficiais e dos usuários...');
    
    // Busca os dois arquivos em paralelo (mais rápido)
    const [radaresOficiais, radaresApp] = await Promise.all([
      fetchGitHubFile('radares.json'),
      fetchGitHubFile('radares_app.json')
    ]);

    // Une os dois arrays. Usamos um Map para evitar duplicatas pelo ID (índice 0 do array)
    const mapaRadares = new Map();
    
    radaresOficiais.forEach(r => mapaRadares.set(r[0], r));
    radaresApp.forEach(r => mapaRadares.set(r[0], r)); // Se houver conflito, o do app sobrescreve (ou vice-versa, conforme sua regra de negócio)

    const radaresUnificados = Array.from(mapaRadares.values());

    console.log(`[API] ✅ Sucesso! Oficiais: ${radaresOficiais.length}, App: ${radaresApp.length}, Total Unificado: ${radaresUnificados.length}`);

    // Cache de 1 minuto
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(radaresUnificados);

  } catch (err) {
    console.error('[API] 💥 Erro crítico:', err);
    res.status(500).json({ error: 'Erro interno ao buscar radares' });
  }
}
