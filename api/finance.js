// Vercel Serverless Function - The Final Solution using a more stable endpoint

// 引入我們在 package.json 中指定的 node-fetch 工具
const fetch = require('node-fetch');

// 設定CORS標頭
function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', 'https://www.coffeewingman.com');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  const promises = symbolsArray.map(symbol => {
    // 使用更穩定的 v8 端點，雖然需要對每個股票單獨發送請求
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    return fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }).then(res => {
      if (!res.ok) {
        // 如果請求失敗，拋出一個包含狀態碼的錯誤
        throw new Error(`Failed for symbol ${symbol} with status ${res.status}`);
      }
      return res.json();
    }).then(data => {
      // 從回傳的資料中解析出我們需要的欄位
      const result = data.chart.result[0];
      const meta = result.meta;
      return {
        symbol: meta.symbol,
        name: meta.instrumentType === 'EQUITY' ? result.meta.symbol : meta.exchangeName, // 指數沒有公司名，用交易所名代替
        price: meta.regularMarketPrice,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
        previousClose: meta.previousClose
      };
    }).catch(error => {
      // 如果某支股票查詢失敗，回傳一個錯誤物件，而不是讓整個請求失敗
      console.error(`Error processing symbol ${symbol}:`, error.message);
      return { symbol: symbol, error: true, message: error.message };
    });
  });

  try {
    const results = await Promise.all(promises);
    // 過濾掉查詢失敗的股票
    const successfulResults = results.filter(r => !r.error);

    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return response.status(200).json(successfulResults);

  } catch (error) {
    console.error("[API Handler Error]", error);
    return response.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
