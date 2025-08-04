// Vercel Serverless Function - v4 with CORS support for coffeewingman.com

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
  const url = "https://fc.yahoo.com";
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    }
  });
  const cookie = response.headers.get('set-cookie');
  if (!cookie) throw new Error("Failed to get cookie from Yahoo.");
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { 'User-Agent': '...', cookie: cookie }
  });
  const crumb = await crumbResponse.text();
  if (!crumb) throw new Error('Failed to get crumb from Yahoo.');
  yahooAuth = { cookie, crumb, lastUpdated: now };
  return yahooAuth;
}

export default async function handler(request, response) {
    // --- CORS 設定開始 ---
    // 設置允許存取此資源的來源網域
    response.setHeader('Access-Control-Allow-Origin', 'https://www.coffeewingman.com');
    // 設置允許的 HTTP 方法
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    // 設置允許的標頭
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 瀏覽器在發送正式 GET 請求前，會先發送一個 OPTIONS "預檢"請求
    // 如果請求方法是 OPTIONS，我們直接回傳 200 OK 即可
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    // --- CORS 設定結束 ---

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
            const errorText = await yahooResponse.text();
            console.error(`Yahoo Finance API returned an error. Status: ${yahooResponse.status}, Body: ${errorText}`);
            throw new Error(`Yahoo Finance API request failed with status ${yahooResponse.status}`);
        }

        const data = await yahooResponse.json();
        if (data.quoteResponse.error) {
            console.error("Yahoo Finance returned an error in JSON:", data.quoteResponse.error);
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
        console.error("Error in handler function:", error);
        yahooAuth.lastUpdated = 0;
        return response.status(500).json({ error: error.message || 'Failed to fetch data from Yahoo Finance' });
    }
}
