// Vercel Serverless Function - v2 with better error logging

export default async function handler(request, response) {
    const symbols = request.query.symbols;

    if (!symbols) {
        return response.status(400).json({ error: 'Symbols query parameter is required' });
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;

    try {
        const yahooResponse = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // 檢查 Yahoo 是否回傳了不成功的 HTTP 狀態 (例如 404, 500)
        if (!yahooResponse.ok) {
            // 將 Yahoo 的錯誤狀態和訊息記錄下來
            const errorText = await yahooResponse.text();
            console.error(`Yahoo Finance API returned an error. Status: ${yahooResponse.status}, Body: ${errorText}`);
            throw new Error(`Yahoo Finance API request failed with status ${yahooResponse.status}`);
        }

        const data = await yahooResponse.json();

        // 檢查回傳的 JSON 中是否有錯誤訊息
        if (data.quoteResponse.error) {
            console.error("Yahoo Finance returned an error in the JSON payload:", data.quoteResponse.error);
            throw new Error(data.quoteResponse.error.message || 'Error message from Yahoo is missing.');
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
        // 在這裡印出更詳細的錯誤日誌
        console.error("Error fetching or processing data from Yahoo Finance:", error);
        // 只回傳通用的錯誤訊息給前端
        return response.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
    }
}
