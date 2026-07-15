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

    // 2. BUSCAR METADADOS DO ARQUIVO (Para pegar o SHA do arquivo e o SHA do Blob)
    const urlContents = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${APP_PATH}?ref=${encodeURIComponent(branch)}`;
    const metaResp = await fetch(urlContents, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!metaResp.ok) {
      const detalhe = await metaResp.text().catch(() => '');
      return res.status(metaResp.status).json({ error: `Erro ao buscar metadados do arquivo (${metaResp.status}): ${detalhe.slice(0, 300)}` });
    }
    const fileMetaData = await metaResp.json();
    const fileSha = fileMetaData.sha; // SHA necessário para o PUT (commit)
    const blobSha = fileMetaData.sha; // Em arquivos, o SHA do conteúdo é o mesmo do arquivo

    // 3. LER O CONTEÚDO VIA BLOB (Suporta arquivos até 100 MB!)
    const urlBlob = `https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${blobSha}`;
    const blobResp = await fetch(urlBlob, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!blobResp.ok) {
      const detalhe = await blobResp.text().catch(() => '');
      return res.status(blobResp.status).json({ error: `Erro ao buscar blob do arquivo (${blobResp.status}): ${detalhe.slice(0, 300)}` });
    }
    const blobData = await blobResp.json();
    
    // O blob retorna o conteúdo em Base64 de forma garantida e completa
    const content = Buffer.from(blobData.content, 'base64').toString('utf-8');

    // 4. PARSE DO JSON
    let records = [];
    let hadRecordsWrapper = true;

    if (content.trim()) {
      try {
        const parsed = JSON.parse(content);

        if (Array.isArray(parsed)) {
          records = parsed;
          hadRecordsWrapper = false;
        } else if (parsed && Array.isArray(parsed.records)) {
          records = parsed.records;
          hadRecordsWrapper = true;
        } else {
          return res.status(500).json({ error: 'Formato inesperado no radares_app.json.' });
        }
      } catch (e) {
        return res.status(500).json({ error: 'Erro ao interpretar radares_app.json: ' + e.message });
      }
    }

    // 5. Calcular próximo ID
    let proximoId = 1;
    if (records.length > 0) {
      const ids = records
        .map(reg => Array.isArray(reg) ? reg[0] : null)
        .filter(id => typeof id === 'number' && !isNaN(id));
      if (ids.length > 0) {
        proximoId = Math.max(...ids) + 1;
      }
    }

    // 6. Extrair bairro
    let bairro = "Único";
    if (endereco) {
      const partes = endereco.split(',').map(p => p.trim());
      if (partes.length >= 2) {
        bairro = partes[partes.length - 2];
      } else if (partes.length === 1) {
        bairro = partes[0];
      }
    }

    // 7. Data formatada
    const now = new Date();
    const dataFormatada = now.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });

    // 8. Montar novo registro
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

    // 9. Adicionar ao array e montar JSON
    records.push(novoRegistro);

    const conteudoAtualizado = hadRecordsWrapper
      ? JSON.stringify({ records: records }, null, 2)
      : JSON.stringify(records, null, 2);

    const updatedContentBase64 = Buffer.from(conteudoAtualizado, 'utf-8').toString('base64');

    // 10. Gravar no GitHub (usando o endpoint de contents normal com o SHA correto)
    const urlPut = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${APP_PATH}`;
    const putResp = await fetch(urlPut, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Adicionado radar #${proximoId}: ${tipo} em ${endereco}`,
        content: updatedContentBase64,
        sha: fileSha, // Usa o SHA do passo 2
        branch: branch
      })
    });

    if (!putResp.ok) {
      const detalhe = await putResp.text().catch(() => '');
      return res.status(putResp.status).json({ error: `Erro ao salvar (${putResp.status}): ${detalhe.slice(0, 300)}` });
    }

    return res.status(200).json({
      success: true,
      id: proximoId,
      persistido: true,
      branch,
      totalRadaresAgora: records.length,
      registro: novoRegistro
    });

  } catch (err) {
    console.error('Erro ao salvar radar:', err);
    return res.status(500).json({ error: err.message || 'Erro desconhecido ao salvar radar.' });
  }
}
