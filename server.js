import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração padrão para usar caminhos de arquivo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// O On-render define a porta através de uma variável de ambiente
const PORT = process.env.PORT || 3000;

// Middleware para aceitar JSON (com limite maior para diagramas complexos)
// e para servir os arquivos estáticos (nosso index.html) da pasta 'public'
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Este é o nosso endpoint de exportação
app.post('/export', async (req, res) => {
  console.log('Requisição de exportação recebida.');
  const { htmlContent } = req.body;

  if (!htmlContent) {
    return res.status(400).json({ error: 'Nenhum conteúdo HTML foi fornecido.' });
  }

  let browser;
  try {
    // Inicia o Puppeteer. As flags '--no-sandbox' são ESSENCIAIS para rodar no On-render.
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Define um tamanho de "tela" grande para o navegador invisível
    await page.setViewport({ width: 2400, height: 1600, deviceScaleFactor: 2 });
    
    // Carrega o HTML que o front-end enviou
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Encontra o container do diagrama para tirar a foto apenas dele
    const clipElement = await page.$('#diagram-wrapper');
    if (!clipElement) {
        throw new Error("Container do diagrama (#diagram-wrapper) não encontrado no HTML recebido.");
    }
    const clip = await clipElement.boundingBox();

    // Tira a screenshot da área calculada
    const imageBuffer = await page.screenshot({
      clip,
      encoding: 'base64', // Retorna a imagem como texto para ser enviada via JSON
      omitBackground: true
    });
    
    console.log('Screenshot gerada com sucesso.');
    
    // Envia a imagem em formato base64 de volta para o cliente
    res.json({ image: imageBuffer });

  } catch (error) {
    console.error('Erro durante a geração da imagem com Puppeteer:', error);
    res.status(500).json({ error: 'Falha ao gerar a imagem no servidor.' });
  } finally {
    // Garante que o navegador seja fechado mesmo se ocorrer um erro
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado e ouvindo na porta ${PORT}`);
});
