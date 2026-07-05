// api/radares.js - Radar X9 - Belo Horizonte
// Endpoint para adicionar radares ao arquivo radares.json

import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
    // Configura os cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Trata a requisição pré-voo (OPTIONS) necessária para o CORS funcionar
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Somente aceita POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Método não permitido. Use POST para adicionar radares.' 
        });
    }
    
    try {
        const { tipo, endereco, velocidade, latitude, longitude } = req.body;
        
        // Validação dos campos obrigatórios
        if (!tipo || !endereco || !velocidade || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                error: 'Todos os campos são obrigatórios: tipo, endereco, velocidade, latitude, longitude'
            });
        }
        
        // Caminho do arquivo radares.json
        const filePath = path.join(process.cwd(), 'public', 'radares.json');
        
        // Lê o arquivo atual
        let jsonData;
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            jsonData = JSON.parse(fileContent);
        } catch (error) {
            // Se o arquivo não existir, cria uma estrutura padrão
            jsonData = {
                fields: [
                    { id: "_id", type: "int" },
                    { id: "ID_FISCALIZACAO_ELETRONICA", type: "text" },
                    { id: "DESC_LOC_CONTROLADOR_TRANSITO", type: "text" },
                    { id: "DESC_TIPO_CONTROLADOR_TRANSITO", type: "text" },
                    { id: "VELOCIDADE_REGULAMENTAR", type: "text" },
                    { id: "SENTIDO", type: "text" },
                    { id: "SENTIDO_FISCALIZADO", type: "text" },
                    { id: "NUM_SERIE_ATUAL", type: "text" },
                    { id: "COD_SECUNDARIA", type: "text" },
                    { id: "GEOMETRIA", type: "text" }
                ],
                records: []
            };
        }
        
        // Garante que records existe
        if (!jsonData.records) {
            jsonData.records = [];
        }
        
        // Calcula o próximo ID
        const idsExistentes = jsonData.records.map(record => record[0]);
        const proximoId = idsExistentes.length > 0 ? Math.max(...idsExistentes) + 1 : 1;
        
        // Cria o novo registro no formato do radares.json
        const idFiscalizacao = String(proximoId);
        const novoRegistro = [
            proximoId,                                      // [0] ID
            idFiscalizacao,                                // [1] ID_FISCALIZACAO_ELETRONICA
            endereco,                                       // [2] DESC_LOC_CONTROLADOR_TRANSITO
            tipo,                                           // [3] DESC_TIPO_CONTROLADOR_TRANSITO
            String(velocidade),                             // [4] VELOCIDADE_REGULAMENTAR
            "Único",                                        // [5] SENTIDO
            "Único",                                        // [6] SENTIDO_FISCALIZADO
            `M${String(proximoId).padStart(6, '0')}`,       // [7] NUM_SERIE_ATUAL
            `KBH${String(proximoId).padStart(6, '0')}`,     // [8] COD_SECUNDARIA
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` // [9] GEOMETRIA
        ];
        
        // Adiciona o novo registro
        jsonData.records.push(novoRegistro);
        
        // Salva de volta no arquivo
        await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
        
        // Retorna sucesso
        return res.status(201).json({
            success: true,
            id: proximoId,
            message: `Radar #${proximoId} adicionado com sucesso!`,
            radar: {
                id: proximoId,
                tipo,
                endereco,
                velocidade,
                latitude,
                longitude
            }
        });
        
    } catch (error) {
        console.error('[Radar X9] Erro ao adicionar radar:', error);
        return res.status(500).json({
            error: 'Erro interno ao salvar o radar',
            details: error.message
        });
    }
}
