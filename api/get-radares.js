// /api/get-radares.js

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = 'seabhra';
  const REPO = 'radar-speed-alert-api';
  const APP_PATH = 'radares_app.json';

  try {
    console.log('🔍 [DEBUG] Iniciando busca no GitHub...');
    
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'GITHUB_TOKEN ausente' });
    }

    // Busca metadados
    const metaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${APP_PATH}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const meta = await metaResp.json();

    // Busca via Blob
    const blobResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${meta.sha}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const blob = await blobResp.json();

    const content = Buffer.from(blob.content, 'base64').toString('utf-8');
    const parsedData = JSON.parse(content);
    
    console.log(`🚀 [DEBUG] Total radares_app.json: ${parsedData.length}`);
    
    // 👇 COLE AQUI - Desativa cache temporariamente
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    res.status(200).json(parsedData);
  } catch (err) {
    console.error("❌ Erro:", err);
    res.status(500).json({ error: 'Erro ao buscar radares' });
  }
}
