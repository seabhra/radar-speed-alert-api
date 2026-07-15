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

    // 3. LER ARQUIVO - formato agora é linha por linha
    let records = [];
    try {
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      
      // Verifica se o arquivo está vazio
      if (!content.trim()) {
        records = [];
      } else {
        // Remove colchetes externos se existirem e quebra por linhas
        let linhas = content.trim();
        // Remove [ e ] do início e fim se existirem
        if (linhas.startsWith('[')) linhas = linhas.substring(1);
        if (linhas.endsWith(']')) linhas = linhas.substring(0, linhas.length - 1);
        
        // Divide por linhas e filtra linhas vazias
        linhas = linhas.split('\n').filter(line => line.trim() !== '');
        
        // Parse cada linha como JSON
        for (const linha of linhas) {
          try {
            // Remove vírgula no final se existir
            const linhaLimpa = linha.trim().replace(/,$/, '');
            if (linhaLimpa) {
              const registro = JSON.parse(linhaLimpa);
              records.push(registro);
            }
          } catch (e) {
            console.error('Erro ao parsear linha:', linha, e.message);
            // Continua mesmo com erro em uma linha
          }
        }
      }
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao interpretar radares_app.json: ' + e.message });
    }

    // 4. CALCULAR PRÓXIMO ID
    let proximoId = 1;
    if (records.length > 0) {
      // Pega o maior ID (primeiro elemento de cada array)
      const ids = records.map(reg => reg[0]).filter(id => typeof id === 'number' && !isNaN(id));
      if (ids.length > 0) {
        proximoId = Math.max(...ids) + 1;
      }
    }

    // 5. Extrair bairro do endereço (pega o último segmento antes da vírgula ou o próprio endereço)
    let bairro = "Único";
    if (endereco) {
      const partes = endereco.split(',').map(p => p.trim());
      if (partes.length >= 2) {
        // Pega a penúltima parte como bairro (ex: "Regional Nordeste" ou "Funcionários")
        bairro = partes[partes.length - 2];
      } else if (partes.length === 1) {
        bairro = partes[0];
      }
    }

    // Data no formato brasileiro
const now = new Date();
const dataFormatada = now.toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
}); // Resultado: "15/07/2026 14:30:00"
    
    // 6. Montar novo registro no formato linha por linha
    
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

    // 7. ESCREVER ARQUIVO - formato linha por linha
    let conteudoAtual = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    // Se o arquivo estiver vazio, cria a estrutura inicial
    if (!conteudoAtual.trim()) {
      conteudoAtual = '[\n';
    } else {
      // Remove o colchete final se existir para adicionar nova linha
      if (conteudoAtual.trim().endsWith(']')) {
        conteudoAtual = conteudoAtual.trimEnd().slice(0, -1);
        // Se não terminar com vírgula, adiciona
        if (!conteudoAtual.trim().endsWith(',')) {
          conteudoAtual += ',';
        }
      }
    }

    // Adiciona a nova linha com indentação
    const novaLinha = JSON.stringify(novoRegistro);
    const conteudoAtualizado = conteudoAtual + '\n  ' + novaLinha + '\n]';

    const updatedContent = Buffer.from(conteudoAtualizado, 'utf-8').toString('base64');

    // 8. Gravar (PUT) de volta no GitHub
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
