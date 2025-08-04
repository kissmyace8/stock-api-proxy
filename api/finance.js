// Vercel Serverless Function - v5 (The Final Stable Version)
// - Robust CORS Handling
// - Stable Cookie/Crumb Auth

// 設定CORS標頭的輔助函式
function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', 'https://www.coffeewingman.com');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

let yahooAuth = {
  cookie: null,
  crumb: null,
  lastUpdated: 0,
};

async function getYahooAuth() {
  const now = Date.now();
  if (yahooAuth.cookie && yahooAuth.crumb && (now - yahooAuth.lastUpdated < 3600 * 1000)) {
    return yahooAuth;
  }

  // 使用一個更可靠的端點來初始化會話並獲取cookie
  const initResponse = await fetch("https://finance.yahoo.com/quote/TSLA", {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36' }
  });
  const cookie = initResponse.headers.get('set-cookie');
  if (!cookie) throw new Error("Failed to get cookie from Yahoo.");

  // 獲取 crumb
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
          cookie: cookie,
      }
  });
  const crumb = await crumbResponse.text();
  if (!crumb || crumb.includes('<html>')) throw new Error('Failed to get a valid crumb from Yahoo.');

  yahooAuth = { cookie, crumb, lastUpdated: now };
  return yahooAuth;
}

export default async function handler(request, response) {
  // 無論成功或失敗，都先設定好 CORS 標頭
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const symbols = request.query.symbols;
  if (!symbols) {
    return response.status(400).json({ error: 'Symbols query parameter is required' });
  }

  try {
    const auth = await getYahooAuth();
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&crumb=${auth.crumb}`;

    const yahooResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        cookie: auth.cookie,
      }
    });

    if (!yahooResponse.ok) {
      throw new Error(`Yahoo API request failed with status ${yahooResponse.status}`);
    }

    const data = await yahooResponse.json();
    if (data.quoteResponse.error) {
      throw new Error(data.quoteResponse.error.message);
    }

    const results = data.quoteResponse.result.map(stock => ({
      symbol: stock.symbol,
      name: stock.longName || stock.shortName,
      price: stock.regularMarketPrice,
      change: stock.regularMarketChange,
      changePercent: stock.regularMarketChangePercent,
      previousClose: stock.regularMarketPreviousClose
    }));

    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return response.status(200).json(results);

  } catch (error) {
    console.error("[API Error]", error.message);
    yahooAuth.lastUpdated = 0; // 發生錯誤時重置驗證資訊
    return response.status(500).json({ error: `Backend Error: ${error.message}` });
  }
}
