// Vercel Serverless Function - v3 with Cookie and Crumb Authentication

// 我們需要一個全域變數來快取 cookie 和 crumb，避免每次請求都重新抓取
let yahooAuth = {
  cookie: null,
  crumb: null,
  lastUpdated: 0,
};

// 獲取並更新 cookie 和 crumb 的函式
async function getYahooAuth() {
  // 快取一小時，避免過度請求
  const now = Date.now();
  if (yahooAuth.cookie && yahooAuth.crumb && (now - yahooAuth.lastUpdated < 3600 * 1000)) {
    return yahooAuth;
  }

  const url = "https://fc.yahoo.com"; // 選擇一個簡單的 Yahoo 網址來獲取 cookie
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    }
  });

  // 從回傳的標頭中獲取 cookie
  const cookie = response.headers.get('set-cookie');
  if (!cookie) {
    throw new Error("Failed to get cookie from Yahoo.");
  }

  // 獲取 crumb
  // Crumb 通常藏在某個特定網頁的 HTML 內容裡，我們需要去抓那個網頁並解析
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
          cookie: cookie,
      }
  });
  const crumb = await crumbResponse.text();
  if (!crumb) {
      throw new Error('Failed to get crumb from Yahoo.');
  }

  yahooAuth = { cookie, crumb, lastUpdated: now };
  return yahooAuth;
}

export default async function handler(request, response) {
  const symbols = request.query.symbols;

  if (!symbols) {
    return response.status(400).json({ error: 'Symbols query parameter is required' });
  }

  try {
    // 在請求 API 前，先獲取驗證資訊
    const auth = await getYahooAuth();

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&crumb=${auth.crumb}`;

    const yahooResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        cookie: auth.cookie, // 在請求中帶上 cookie
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
    // 清除舊的驗證資訊，以便下次重新獲取
    yahooAuth.lastUpdated = 0;
    return response.status(500).json({ error: error.message || 'Failed to fetch data from Yahoo Finance' });
  }
}
