// Vercel Serverless Function - The Final Native Fetch Version

// ★★★ 您專屬的、有效的 Alpha Vantage API Key ★★★
const ALPHA_VANTAGE_API_KEY = 'YSHVIMRE9VSIFUQI';

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', 'https://www.coffeewingman.com');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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

  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY' || !ALPHA_VANTAGE_API_KEY) {
    return response.status(500).json({ error: 'API Key not configured.' });
  }

  const symbolsArray = symbols.split(',');
  const results = [];

  try {
    for (const symbol of symbolsArray) {
      await delay(13000); // 遵守頻率限制

      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

      // 使用 Vercel 環境內建的 fetch，不再需要 require('node-fetch')
      const apiResponse = await fetch(url);

      if (!apiResponse.ok) {
          // 嘗試解析錯誤訊息，如果不行就用狀態碼
          let errorMsg = `API request failed with status ${apiResponse.status}`;
          try {
              const errorData = await apiResponse.json();
              errorMsg = errorData.Information || errorData.Note || JSON.stringify(errorData);
          } catch (e) {
              // 解析失敗，維持原狀
          }
          throw new Error(errorMsg);
      }

      const data = await apiResponse.json();
      const quote = data['Global Quote'];

      if (quote && Object.keys(quote).length > 0) {
        results.push({
          symbol: quote['01. symbol'],
          name: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          previousClose: parseFloat(quote['08. previous close']),
        });
      } else {
         console.warn(`No data for symbol: ${symbol}. Response:`, JSON.stringify(data));
         results.push({ symbol: symbol, price: null, name: symbol, Note: data.Note });
      }
    }

    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return response.status(200).json(results);

  } catch (error) {
    console.error("[API Error]", error);
    return response.status(500).json({ error: `Backend Error: ${error.message}` });
  }
}
