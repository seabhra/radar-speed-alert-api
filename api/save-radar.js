// /api/save-radar.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_OWNER || 'seabhra';
  const REPO = process.env.GITHUB_REPO || 'radar-speed-alert-api';
  const APP_PATH = process.env.GITHUB_APP_PATH || 'radares_app.json';

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN não configurado no servidor.' });
  }

  const { tipo, endereco, velocidade, latitude, longitude } = req.body || {};

  if (!tipo || !endereco || !velocidade || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Dados incompletos do radar.' });
  }

  try {
    // 1. Descobrir a branch padrão
    const repoInfoResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!repoInfoResp.ok) {
      const detalhe = await repoInfoResp.text().catch(() => '');
      return res.status(repoInfoResp.status).json({ error: `Erro ao ler repositório: ${detalhe.slice(0, 300)}` });
    }
    const repoInfo = await repoInfoResp.json();
    const branch = repoInfo.default_branch || 'main';

    // 2. Buscar arquivo atual
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${APP_PATH}`;
    const getResp = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!getResp.ok) {
      const detalhe = await getResp.text().catch(() => '');
      return res.status(getResp.status).json({ error: `Erro ao buscar arquivo: ${detalhe.slice(0, 300)}` });
    }
    const fileData = await getResp.json();

    // 3. PARSE CORRETO — JSON nativo, sem gambiarra de linha por linha
    let records = [];
    let hadRecordsWrapper = true; // flag para preservar o formato original

    try {
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      if (content.trim()) {
        const parsed = JSON.parse(content);  // ← Parse como JSON de verdade

        if (Array.isArray(parsed)) {
          // Formato: [ [...], [...] ]
          records = parsed;
          hadRecordsWrapper = false;
        } else if (parsed && Array.isArray(parsed.records)) {
          // Formato: {"records": [ [...], [...] ]}
          records = parsed.records;
          hadRecordsWrapper = true;
        } else {
          return res.status(500).json({ error: 'Formato inesperado no radares_app.json.' });
        }
      }
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao interpretar radares_app.json: ' + e.message });
    }

    // 4. Calcular próximo ID
    let proximoId = 1;
    if (records.length > 0) {
      const ids = records
        .map(reg => Array.isArray(reg) ? reg[0] : null)
        .filter(id => typeof id === 'number' && !isNaN(id));
      if (ids.length > 0) {
        proximoId = Math.max(...ids) + 1;
      }
    }

    // 5. Extrair bairro
    let bairro = "Único";
    if (endereco) {
      const partes = endereco.split(',').map(p => p.trim());
      if (partes.length >= 2) {
        bairro = partes[partes.length - 2];
      } else if (partes.length === 1) {
        bairro = partes[0];
      }
    }

    // 6. Data formatada
    const now = new Date();
    const dataFormatada = now.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });

    // 7. Montar novo registro
    const novoRegistro = [
      proximoId,
      String(proximoId).padStart(6, '0'),
      endereco,
      tipo,
      String(velocidade),
      bairro,
      "Único",
      `M${String(proximoId).padStart(6, '0')}`,
      `KBH${String(proximoId).padStart(6, '0')}`,
      `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`,
      dataFormatada
    ];

    // 8. Adicionar ao array e MONTAR JSON CORRETAMENTE
    records.push(novoRegistro);

    // Preserva o formato original do arquivo
    const conteudoAtualizado = hadRecordsWrapper
      ? JSON.stringify({ records: records }, null, 2)
      : JSON.stringify(records, null, 2);

    const updatedContent = Buffer.from(conteudoAtualizado, 'utf-8').toString('base64');

    // 9. Gravar no GitHub
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
      return res.status(putResp.status).json({ error: `Erro ao salvar: ${detalhe.slice(0, 300)}` });
    }

    return res.status(200).json({
      success: true,
      id: proximoId,
      persistido: true,
      branch,
      registro: novoRegistro
    });

  } catch (err) {
    console.error('Erro ao salvar radar:', err);
    return res.status(500).json({ error: err.message || 'Erro desconhecido ao salvar radar.' });
  }
}
