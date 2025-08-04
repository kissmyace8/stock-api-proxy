// Vercel Serverless Function
// 這支程式的功能是作為一個代理 (Proxy)
// 接收來自我們儀表板的請求，然後去向 Yahoo Finance 取得資料，最後回傳給儀表板 

export default async function handler(request, response) {
    // 從請求的 URL 中獲取股票代號，例如: .../api/finance?symbols=AAPL,TSLA,2330.TW
    const symbols = request.query.symbols;

    if (!symbols) {
        return response.status(400).json({ error: 'Symbols query parameter is required' });
    }

    // Yahoo Finance 的內部 API 端點
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;

    try {
        // 向 Yahoo Finance 發送請求
        const yahooResponse = await fetch(url, {
            headers: {
                // 偽裝成瀏覽器，避免被阻擋
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!yahooResponse.ok) {
            throw new Error(`Yahoo Finance API request failed with status ${yahooResponse.status}`);
        }

        const data = await yahooResponse.json();
        
        // 從回傳的資料中，解析出我們需要的欄位
        const results = data.quoteResponse.result.map(stock => ({
            symbol: stock.symbol,
            name: stock.longName || stock.shortName,
            price: stock.regularMarketPrice,
            change: stock.regularMarketChange,
            changePercent: stock.regularMarketChangePercent,
            previousClose: stock.regularMarketPreviousClose
        }));

        // 設定 Cache-Control 標頭，讓 Vercel 快取結果 60 秒，有助於效能和避免過度請求
        response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        
        // 回傳處理好的 JSON 資料給我們的儀表板
        return response.status(200).json(results);

    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
    }
}
