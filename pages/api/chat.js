
// api/chat.js versão 1 Radar X9 - Belo Horizonte

export default function handler(req, res) {
    // Configura os cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
    // Trata a requisição pré-voo (OPTIONS) necessária para o CORS funcionar
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  
    // Verifica se é POST
    if (req.method === 'POST') {
      try {
        const { pergunta } = req.body;
  
        // Verificação simples se a pergunta existe
        if (!pergunta) {
          return res.status(400).json({ error: "O campo 'pergunta' é obrigatório." });
        }
  
        // Lógica simples para identificar promoções e riscos baseada em palavras-chave
        let tipoAlerta = 'radar'; // padrão
        const perguntaLower = pergunta.toLowerCase();
        
        const palavrasRisco = ['perigo', 'violência', 'acidente', 'inundação', 'escape', 'nuclear'];
        const palavrasPromocao = ['promoção', 'promo', 'desconto', 'oferta', 'vercel'];
        
        if (palavrasRisco.some(palavra => perguntaLower.includes(palavra))) {
            tipoAlerta = 'risco';
        } else if (palavrasPromocao.some(palavra => perguntaLower.includes(palavra))) {
            tipoAlerta = 'promocao';
        }
  
        // Simulação de resposta da IA com classificação do alerta
        const resposta = `Resposta da IA para: ${pergunta} | Tipo de Alerta Detectado: ${tipoAlerta}`;
        
        res.status(200).json({ resposta, tipoAlerta });
        
      } catch (error) {
        console.error("Erro ao processar POST:", error);
        res.status(500).json({ error: "Erro interno no servidor" });
      }
    } else {
      // Se for GET ou outro método não permitido
      res.status(405).json({ error: `Método ${req.method} não permitido` });
    }
  }


