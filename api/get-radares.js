// /api/get-radares.js
export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_OWNER || 'seabhra';
  const REPO = process.env.GITHUB_REPO || 'radar-speed-alert-api';
  
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN não configurado no servidor.' });
  }

  // Função robusta para buscar QUALQUER arquivo JSON do GitHub
  async function fetchGitHubFile(filePath) {
    try {
      // 1. Pegar metadados (SHA)
      const metaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!metaResp.ok) {
        if (metaResp.status === 404) return null; // Arquivo não existe neste caminho
        throw new Error(`Erro HTTP ${metaResp.status} em ${filePath}`);
      }
      
      const meta = await metaResp.json();
      
      // 2. Pegar conteúdo via Blob (suporta arquivos grandes)
      const blobResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${meta.sha}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!blobResp.ok) throw new Error(`Erro ao buscar blob de ${filePath}`);
      
      const blob = await blobResp.json();
      const content = Buffer.from(blob.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      
      // Normaliza para sempre retornar um array
      return Array.isArray(parsed) ? parsed : (parsed.records || []);
      
    } catch (error) {
      console.warn(`[API] Falha ao ler GitHub em ${filePath}:`, error.message);
      return null;
    }
  }

  try {
    console.log('[API] 🔄 Buscando radares oficiais e dos usuários no GitHub...');
    
    // Tenta encontrar o radares.json em 3 caminhos comuns (o GitHub é rápido para retornar 404 se não existir)
    let radaresOficiais = await fetchGitHubFile('radares.json');
    if (!radaresOficiais) radaresOficiais = await fetchGitHubFile('public/radares.json');
    if (!radaresOficiais) radaresOficiais = await fetchGitHubFile('src/radares.json');
    
    if (radaresOficiais) {
        console.log(`[API] ✅ Radares oficiais encontrados! Total: ${radaresOficiais.length}`);
    } else {
        console.log('[API] ⚠️ Radares oficiais (radares.json) NÃO encontrados em nenhum caminho do GitHub.');
        radaresOficiais = [];
    }

    // Busca os radares dos usuários (que já sabemos que funciona)
    const radaresApp = await fetchGitHubFile('radares_app.json') || [];
    console.log(`[API] ✅ Radares dos usuários encontrados! Total: ${radaresApp.length}`);

    // Une os dois arrays, removendo duplicatas pelo ID (índice 0 do array)
    const mapaRadares = new Map();
    
    radaresOficiais.forEach(r => { if (r && r[0] !== undefined) mapaRadares.set(r[0], r); });
    radaresApp.forEach(r => { if (r && r[0] !== undefined) mapaRadares.set(r[0], r); });

    const radaresUnificados = Array.from(mapaRadares.values());

    console.log(`[API] 🚀 SUCESSO! Total Unificado: ${radaresUnificados.length} radares.`);

    // Cache de 1 minuto
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(radaresUnificados);

  } catch (err) {
    console.error('[API] 💥 Erro crítico:', err);
    res.status(500).json({ error: 'Erro interno ao buscar radares' });
  }
}
