// /api/get-radares.js
export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = 'seabhra';
  const REPO = 'radar-speed-alert-api';
  const APP_PATH = 'radares_app.json';

  try {
    // Busca metadados
    const metaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${APP_PATH}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const meta = await metaResp.json();

    // Busca via Blob (suporta +100MB)
    const blobResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${meta.sha}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const blob = await blobResp.json();

    const content = Buffer.from(blob.content, 'base64').toString('utf-8');
    
    // Cache de 1 minuto para não bater no limite de requisições do GitHub
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(JSON.parse(content));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar radares' });
  }
}