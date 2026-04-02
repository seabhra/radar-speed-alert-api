// api/index.js Radar X9 - Belo Horizonte

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { pergunta } = req.body;
  const resposta = "Resposta da IA para: " + pergunta;
  res.json({ resposta });
});

module.exports = app;

