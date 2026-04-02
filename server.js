const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Habilita o CORS
app.use(cors());

// Serve arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rota para servir o index.html em requisições para a raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Suas rotas de API
app.post('/api/chat', (req, res) => {
    res.json({
        choices: [{
            message: {
                content: "Resposta da API: Duelo entre filósofos sobre o tema..."
            }
        }]
    });
});

// Inicia o servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> {
    console.log(`Servidor rodando na porta ${PORT}`);
});
