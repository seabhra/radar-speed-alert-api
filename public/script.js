
// Função para buscar dados da API - Radar X9 - Belo Horizonte

async function fetchData() {
  try {
    const response = await fetch('/api/chat');
    const data = await response.json();
    document.getElementById('result').innerText = `Resposta da API: ${data.message}`;
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
  }
}

// Função para enviar dados para a API

async function sendData() {
  try {
    const response = await fetch('/api/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: 'Dados enviados do App Inventor' }),
    });
    const result = await response.json();
    document.getElementById('result').innerText = `Resposta da API: ${result.status}`;
  } catch (error) {
    console.error('Erro ao enviar dados:', error);
  }
}
