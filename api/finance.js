// Vercel Serverless Function - The Final Professional Solution using Alpha Vantage API

const fetch = require('node-fetch');

// ★★★ 您專屬的 Alpha Vantage API Key 已經幫您填好了 ★★★
const ALPHA_VANTAGE_API_KEY = 'YSHVIMRE9VSIFUQI';

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', 'https://www.coffeewingman.com');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Alpha Vantage 免費方案有頻率限制 (每分鐘5次)，我們需要一個延遲函式
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const symbols = request.query.symbols;
  if (!symbols) {
    return response.status(400).json({ error: 'Symbols query parameter is required' });
  }

  const symbolsArray = symbols.split(',');
  const results = [];

  try {
    for (const symbol of symbolsArray) {
      // 為了遵守頻率限制，每查詢一支股票就延遲 13 秒
      await delay(13000); 

      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const apiResponse = await fetch(url);
      const data = await apiResponse.json();

      const quote = data['Global Quote'];
      // 檢查回傳的 quote 物件是否存在且有內容
      if (quote && Object.keys(quote).length > 0) {
        results.push({
          symbol: quote['01. symbol'],
          // Alpha Vantage 免費方案不直接提供公司全名，我們先用代號代替
          name: quote['01. symbol'], 
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          previousClose: parseFloat(quote['08. previous close']),
        });
      } else {
         console.warn(`No data found for symbol: ${symbol}. Response:`, JSON.stringify(data));
         // 即使某支股票查不到，也回傳一個包含代號的物件，方便前端判斷
         results.push({ symbol: symbol, price: null, name: symbol });
      }
    }

    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return response.status(200).json(results);

  } catch (error) {
    console.error("[API Error]", error);
    return response.status(500).json({ error: `Backend Error: ${error.message}` });
  }
