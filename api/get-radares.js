// /api/get-radares.js

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = 'seabhra';
  const REPO = 'radar-speed-alert-api';
  const APP_PATH = 'radares_app.json';

  try {
    console.log('🔍 [DEBUG] Iniciando busca no GitHub para:', `${OWNER}/${REPO}/${APP_PATH}`);
    
    if (!GITHUB_TOKEN) {
      console.error('❌ [DEBUG] GITHUB_TOKEN não está definido nas Variáveis de Ambiente do Vercel!');
      return res.status(500).json({ error: 'Erro de configuração: Token do GitHub ausente.' });
    }

    // 1. Busca metadados
    const metaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${APP_PATH}`, {
      headers: { 
        'Authorization': `Bearer ${GITHUB_TOKEN}`, 
        'Accept': 'application/vnd.github.v3+json' 
      }
    });

    if (!metaResp.ok) {
      const errText = await metaResp.text();
      console.error(`❌ [DEBUG] Falha ao buscar metadados. Status: ${metaResp.status}`, errText);
      return res.status(metaResp.status).json({ error: 'Falha ao buscar metadados do GitHub', details: errText });
    }

    const meta = await metaResp.json();
    console.log(`✅ [DEBUG] Metadados encontrados. SHA do arquivo: ${meta.sha}`);

    // 2. Busca via Blob (suporta +100MB)
    const blobResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${meta.sha}`, {
      headers: { 
        'Authorization': `Bearer ${GITHUB_TOKEN}`, 
        'Accept': 'application/vnd.github.v3+json' 
      }
    });

    if (!blobResp.ok) {
      console.error(`❌ [DEBUG] Falha ao buscar blob. Status: ${blobResp.status}`);
      return res.status(blobResp.status).json({ error: 'Falha ao buscar conteúdo do arquivo' });
    }

    const blob = await blobResp.json();
    const content = Buffer.from(blob.content, 'base64').toString('utf-8');
    const parsedData = JSON.parse(content);
    
    // 🚀 AQUI ESTÁ A RESPOSTA QUE PROCURAMOS:
    console.log(`🚀 [DEBUG SUCESSO] Total de radares_app.json lidos DO GITHUB: ${parsedData.length}`);
    
    // Cache de 1 minuto para não bater no limite de requisições do GitHub
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(parsedData);

  } catch (err) {
    console.error("💥 [DEBUG] ERRO CRÍTICO ao buscar radares:", err);
    res.status(500).json({ error: 'Erro interno ao buscar radares', details: err.message });
  }
}
