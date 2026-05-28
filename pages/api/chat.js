// api/chat.js versão 2 Radar X9 - Belo Horizonte
// Foco exclusivo: Detecção de Alertas de Promoção via IA

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
  
        // Lógica EXCLUSIVA para identificar PROMOÇÕES via IA
        let tipoAlerta = 'nenhum'; // Padrão: não é alerta de promoção
        const perguntaLower = pergunta.toLowerCase();
        
        // Palavras que acionam o alerta verde de promoção
        const palavrasPromocao = ['promoção', 'promo', 'desconto', 'oferta', 'vercel', 'grátis', 'cupom'];
        
        if (palavrasPromocao.some(palavra => perguntaLower.includes(palavra))) {
            tipoAlerta = 'promocao';
        }
  
        // Se for promoção, retorna uma mensagem amigável para o alerta verde
        // Se não for, retorna uma mensagem neutra (o frontend vai ignorar)
        const resposta = tipoAlerta === 'promocao' 
            ? `🎉 Promoção detectada! Aproveite: ${pergunta}` 
            : `Nenhuma promoção encontrada para: ${pergunta}`;
        
        // Retorna para o frontend
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
