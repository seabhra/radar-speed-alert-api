// /api/config.js
// Vercel Serverless Function
// Entrega ao front-end apenas configuração NÃO sensível.
// O token do GitHub NUNCA passa por aqui nem chega ao navegador.

export default function handler(req, res) {
  res.status(200).json({
    githubOwner: process.env.GITHUB_OWNER || 'seabhra',
    githubRepo: process.env.GITHUB_REPO || 'radar-speed-alert-api',
    githubPath: process.env.GITHUB_PATH || 'radares.json',
    githubAppPath: process.env.GITHUB_APP_PATH || 'radares_app.json'
  });
}