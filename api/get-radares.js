// /api/get-radares.js
export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = 'seabhra';
  const REPO = 'radar-speed-alert-api';
  
  // Verificação básica
  if (!GITHUB_TOKEN) {
    console.error('[API] Erro: GITHUB_TOKEN não configurado');
    return res.status(500).json({ error: 'Token não configurado' });
  }

  try {
    // Função para buscar arquivo do GitHub
    async function getGitHubFile(path) {
      try {
        // Busca metadados
        const meta = await fetch(
          `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
          {
            headers: { 
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json' 
            }
          }
        );
        
        if (!meta.ok) return null;
        
        const metaJson = await meta.json();
        
        // Busca conteúdo
        const blob = await fetch(
          `https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${metaJson.sha}`,
          {
            headers: { 
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json' 
            }
          }
        );
        
        if (!blob.ok) return null;
        
        const blobJson = await blob.json();
        const content = Buffer.from(blobJson.content, 'base64').toString('utf-8');
        const data = JSON.parse(content);
        
        // Retorna array (trata tanto array direto quanto objeto com records)
        if (Array.isArray(data)) return data;
        if (data.records && Array.isArray(data.records)) return data.records;
        return null;
        
      } catch (e) {
        console.warn(`Erro ao ler ${path}:`, e.message);
        return null;
      }
    }

    // Busca os dois arquivos em paralelo
    const [oficiais, app] = await Promise.all([
      getGitHubFile('public/radares.json'),
      getGitHubFile('radares_app.json')
    ]);

    const totalOficiais = oficiais ? oficiais.length : 0;
    const totalApp = app ? app.length : 0;

    console.log(`[API] Oficiais: ${totalOficiais}, App: ${totalApp}`);

    // Une os dois arrays
    let todosRadares = [];
    if (oficiais) todosRadares = [...oficiais];
    if (app) todosRadares = [...todosRadares, ...app];

    // Remove duplicatas por ID (primeiro elemento do array)
    const mapa = new Map();
    todosRadares.forEach(r => {
      if (r && r[0]) mapa.set(r[0], r);
    });

    const resultado = Array.from(mapa.values());

    console.log(`[API] Total: ${resultado.length} radares`);

    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(200).json(resultado);

  } catch (err) {
    console.error('[API] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
}
