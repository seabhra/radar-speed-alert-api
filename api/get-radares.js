// /api/get-radares.js

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_OWNER || 'seabhra';
  const REPO = process.env.GITHUB_REPO || 'radar-speed-alert-api';
  
  const logs = []; // Array para acumular logs e enviar na resposta
  
  function log(msg) {
    console.log(msg);
    logs.push(msg);
  }

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN não configurado', logs });
  }

  log(`[API] Owner: ${OWNER}, Repo: ${REPO}`);

  // Função para buscar arquivo do GitHub
  async function fetchGitHubFile(filePath) {
    try {
      log(`[API] 🔍 Tentando: ${filePath}`);
      
      const metaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      log(`[API] Status da requisição para ${filePath}: ${metaResp.status}`);
      
      if (!metaResp.ok) {
        if (metaResp.status === 404) {
          log(`[API] ❌ ${filePath} não existe (404)`);
          return null;
        }
        const errText = await metaResp.text();
        log(`[API] ❌ Erro HTTP ${metaResp.status}: ${errText.slice(0, 200)}`);
        return null;
      }
      
      const meta = await metaResp.json();
      log(`[API] ✅ Metadados obtidos. SHA: ${meta.sha}, Tipo: ${meta.type}, Tamanho: ${meta.size} bytes`);
      
      const blobResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${meta.sha}`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!blobResp.ok) {
        log(`[API] ❌ Erro ao buscar blob: ${blobResp.status}`);
        return null;
      }
      
      const blob = await blobResp.json();
      const content = Buffer.from(blob.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      
      log(`[API] ✅ Conteúdo parseado. Chaves: ${Object.keys(parsed).join(', ')}`);
      
      // Trata tanto array puro quanto objeto com "records"
      if (Array.isArray(parsed)) {
        log(`[API]  Formato: Array puro com ${parsed.length} itens`);
        return parsed;
      }
      if (parsed && Array.isArray(parsed.records)) {
        log(`[API] 📊 Formato: Objeto com chave "records" (${parsed.records.length} itens)`);
        return parsed.records;
      }
      if (parsed && Array.isArray(parsed.radares)) {
        log(`[API] 📊 Formato: Objeto com chave "radares" (${parsed.radares.length} itens)`);
        return parsed.radares;
      }
