// /api/save-radar.js
// Vercel Serverless Function
// Recebe os dados de um novo radar do front-end (via POST) e grava
// no radares_app.json do GitHub usando o GITHUB_TOKEN guardado como
// variável de ambiente no servidor. O token nunca é exposto ao cliente.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_OWNER || 'seabhra';
  const REPO = process.env.GITHUB_REPO || 'radar-speed-alert-api';
  const APP_PATH = process.env.GITHUB_APP_PATH || 'radares_app.json';

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN não configurado no servidor (variável de ambiente ausente na Vercel).' });
  }

  const { tipo, endereco, velocidade, latitude, longitude } = req.body || {};

  if (!tipo || !endereco || !velocidade || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Dados incompletos do radar. Necessário: tipo, endereco, velocidade, latitude, longitude.' });
  }

  try {
    // 1. Descobrir a branch padrão do repositório
    const repoInfoResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!repoInfoResp.ok) {
      const detalhe = await repoInfoResp.text().catch(() => '');
      return res.status(repoInfoResp.status).json({ error: `Não foi possível ler o repositório (${repoInfoResp.status}): ${detalhe.slice(0, 300)}` });
    }
    const repoInfo = await repoInfoResp.json();
    const branch = repoInfo.default_branch || 'main';

    // 2. Buscar conteúdo atual do arquivo radares_app.json
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${APP_PATH}`;
    const getResp = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!getResp.ok) {
      const detalhe = await getResp.text().catch(() => '');
      return res.status(getResp.status).json({ error: `Erro ao buscar arquivo (${getResp.status}): ${detalhe.slice(0, 300)}` });
    }
    const fileData = await getResp.json();

    let jsonData;
    try {
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      jsonData = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao interpretar radares_app.json: ' + e.message });
    }
    if (!jsonData.records) jsonData.records = [];

    // 3. Calcular o próximo ID (evita colisão com IDs já existentes)
    const idsExistentes = jsonData.records
      .map(r => Number(r[0]))
      .filter(n => !isNaN(n));
    const proximoId = idsExistentes.length > 0 ? Math.max(...idsExistentes) + 1 : 100001;

    // 4. Montar novo registro no mesmo formato dos demais campos
    const novoRegistro = [
      proximoId,
      String(proximoId),
      endereco,
      tipo,
      String(velocidade),
      "Único",
      "Único",
      `M${String(proximoId).padStart(6, '0')}`,
      `KBH${String(proximoId).padStart(6, '0')}`,
      `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
    ];
    jsonData.records.push(novoRegistro);

    const updatedContent = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8').toString('base64');

    // 5. Gravar (PUT) de volta no GitHub
    const putResp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Adicionado radar #${proximoId}: ${tipo} em ${endereco}`,
        content: updatedContent,
        sha: fileData.sha,
        branch: branch
      })
    });

    if (!putResp.ok) {
      const detalhe = await putResp.text().catch(() => '');
      return res.status(putResp.status).json({ error: `Erro ao salvar (${putResp.status}): ${detalhe.slice(0, 300)}` });
    }

    return res.status(200).json({ success: true, id: proximoId, persistido: true, branch });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro desconhecido ao salvar radar.' });
  }
}


