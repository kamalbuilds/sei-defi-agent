import { Logger } from '../../utils/logger';

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  lastUpdated: Date;
  source: string;
}

export interface PriceHistory {
  symbol: string;
  prices: PricePoint[];
  timeRange: string;
}

export interface PricePoint {
  timestamp: Date;
  price: number;
  volume: number;
}

export interface TradingPair {
  base: string;
  quote: string;
  price: number;
  volume24h: number;
  spread: number;
  exchange: string;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdated: Date;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export class MarketDataService {
  private logger = new Logger('MarketDataService');
  private marketData: Map<string, MarketData> = new Map();
  private priceHistory: Map<string, PriceHistory> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockData: MarketData[] = [
      {
        symbol: 'SEI',
        price: 0.52,
        change24h: 0.03,
        changePercent24h: 6.12,
        volume24h: 45000000,
        marketCap: 890000000,
        high24h: 0.54,
        low24h: 0.48,
        lastUpdated: new Date(),
        source: 'coingecko'
      },
      {
        symbol: 'ETH',
        price: 2456.78,
        change24h: -45.22,
        changePercent24h: -1.81,
        volume24h: 12000000000,
        marketCap: 295000000000,
        high24h: 2520.15,
        low24h: 2430.50,
        lastUpdated: new Date(),
        source: 'coingecko'
      },
      {
        symbol: 'USDC',
        price: 1.00,
        change24h: 0.001,
        changePercent24h: 0.1,
        volume24h: 3500000000,
        marketCap: 24000000000,
        high24h: 1.001,
        low24h: 0.999,
        lastUpdated: new Date(),
        source: 'coingecko'
      },
      {
        symbol: 'SOL',
        price: 98.45,
        change24h: 4.32,
        changePercent24h: 4.59,
        volume24h: 890000000,
        marketCap: 43000000000,
        high24h: 102.15,
        low24h: 94.20,
        lastUpdated: new Date(),
        source: 'coingecko'
      },
      {
        symbol: 'ATOM',
        price: 8.92,
        change24h: -0.15,
        changePercent24h: -1.65,
        volume24h: 125000000,
        marketCap: 2600000000,
        high24h: 9.10,
        low24h: 8.75,
        lastUpdated: new Date(),
        source: 'coingecko'
      }
    ];

    mockData.forEach(data => this.marketData.set(data.symbol, data));

    // Initialize mock price history
    this.initializePriceHistory();

    this.logger.info('Mock market data initialized', { count: mockData.length });
  }

  private initializePriceHistory(): void {
    const symbols = ['SEI', 'ETH', 'USDC', 'SOL', 'ATOM'];
    
    symbols.forEach(symbol => {
      const currentData = this.marketData.get(symbol);
      if (!currentData) return;

      const prices: PricePoint[] = [];
      const basePrice = currentData.price;
      
      // Generate 30 days of mock price history
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Generate realistic price movements
        const volatility = symbol === 'USDC' ? 0.001 : 0.05;
        const randomChange = (Math.random() - 0.5) * volatility;
        const price = basePrice * (1 + randomChange);
        
        prices.push({
          timestamp: date,
          price: Math.max(price, 0.01), // Ensure positive prices
          volume: Math.random() * currentData.volume24h * 0.1
        });
      }

      this.priceHistory.set(symbol, {
        symbol,
        prices,
        timeRange: '30D'
      });
    });
  }

  async getMarketData(symbol: string): Promise<MarketData | null> {
    const data = this.marketData.get(symbol.toUpperCase());
    
    if (data) {
      // Simulate real-time price updates with small random changes
      const updatedData = { ...data };
      const volatility = symbol === 'USDC' ? 0.0001 : 0.001;
      const priceChange = data.price * (Math.random() - 0.5) * volatility;
      updatedData.price = Math.max(data.price + priceChange, 0.01);
      updatedData.lastUpdated = new Date();
      
      this.marketData.set(symbol.toUpperCase(), updatedData);
      this.logger.info('Market data retrieved', { symbol, price: updatedData.price });
      return updatedData;
    }

    this.logger.warn('Market data not found', { symbol });
    return null;
  }

  async getMultipleSymbols(symbols: string[]): Promise<MarketData[]> {
    this.logger.info('Retrieving multiple symbols', { symbols, count: symbols.length });
    
    const results: MarketData[] = [];
    
    for (const symbol of symbols) {
      const data = await this.getMarketData(symbol);
      if (data) {
        results.push(data);
      }
    }

    return results;
  }

  async getPriceHistory(symbol: string, timeRange: string = '30D'): Promise<PriceHistory | null> {
    const history = this.priceHistory.get(symbol.toUpperCase());
    
    if (history) {
      this.logger.info('Price history retrieved', { symbol, timeRange, points: history.prices.length });
      return { ...history, timeRange };
    }

    this.logger.warn('Price history not found', { symbol });
    return null;
  }

  async getTradingPairs(baseSymbol?: string): Promise<TradingPair[]> {
    const pairs: TradingPair[] = [
      {
        base: 'SEI',
        quote: 'USDC',
        price: 0.52,
        volume24h: 2500000,
        spread: 0.001,
        exchange: 'dragonswap'
      },
      {
        base: 'ETH',
        quote: 'USDC',
        price: 2456.78,
        volume24h: 8900000,
        spread: 0.0005,
        exchange: 'yei-finance'
      },
      {
        base: 'SOL',
        quote: 'USDC',
        price: 98.45,
        volume24h: 450000,
        spread: 0.002,
        exchange: 'dragonswap'
      },
      {
        base: 'SEI',
        quote: 'ETH',
        price: 0.000211,
        volume24h: 890000,
        spread: 0.003,
        exchange: 'yei-finance'
      }
    ];

    let filteredPairs = pairs;
    if (baseSymbol) {
      filteredPairs = pairs.filter(pair => 
        pair.base.toUpperCase() === baseSymbol.toUpperCase()
      );
    }

    this.logger.info('Trading pairs retrieved', { baseSymbol, count: filteredPairs.length });
    return filteredPairs;
  }

  async getOrderBook(symbol: string, exchange?: string): Promise<OrderBook> {
    this.logger.info('Retrieving order book', { symbol, exchange });

    // Generate mock order book
    const marketData = await this.getMarketData(symbol);
    const basePrice = marketData?.price || 1;

    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];

    // Generate 20 bid levels
    for (let i = 0; i < 20; i++) {
      const price = basePrice * (1 - (i + 1) * 0.001);
      const size = Math.random() * 10000 + 100;
      bids.push({
        price: Math.round(price * 1000000) / 1000000,
        size: Math.round(size * 100) / 100,
        total: bids.reduce((sum, bid) => sum + bid.size, 0) + size
      });
    }

    // Generate 20 ask levels
    for (let i = 0; i < 20; i++) {
      const price = basePrice * (1 + (i + 1) * 0.001);
      const size = Math.random() * 10000 + 100;
      asks.push({
        price: Math.round(price * 1000000) / 1000000,
        size: Math.round(size * 100) / 100,
        total: asks.reduce((sum, ask) => sum + ask.size, 0) + size
      });
    }

    return {
      symbol: symbol.toUpperCase(),
      bids: bids.sort((a, b) => b.price - a.price),
      asks: asks.sort((a, b) => a.price - b.price),
      lastUpdated: new Date()
    };
  }

  async subscribeToUpdates(symbols: string[], callback: (data: MarketData) => void): Promise<void> {
    this.logger.info('Subscribing to market data updates', { symbols });

    // Simulate real-time updates
    setInterval(() => {
      symbols.forEach(async symbol => {
        const data = await this.getMarketData(symbol);
        if (data) {
          callback(data);
        }
      });
    }, 5000); // Update every 5 seconds
  }

  async getTopGainers(limit: number = 10): Promise<MarketData[]> {
    const allData = Array.from(this.marketData.values());
    const sorted = allData.sort((a, b) => b.changePercent24h - a.changePercent24h);
    
    this.logger.info('Top gainers retrieved', { limit, count: sorted.length });
    return sorted.slice(0, limit);
  }

  async getTopLosers(limit: number = 10): Promise<MarketData[]> {
    const allData = Array.from(this.marketData.values());
    const sorted = allData.sort((a, b) => a.changePercent24h - b.changePercent24h);
    
    this.logger.info('Top losers retrieved', { limit, count: sorted.length });
    return sorted.slice(0, limit);
  }

  async getMarketSummary(): Promise<{
    totalMarketCap: number;
    totalVolume24h: number;
    activeSymbols: number;
    topGainers: MarketData[];
    topLosers: MarketData[];
  }> {
    const allData = Array.from(this.marketData.values());
    
    const summary = {
      totalMarketCap: allData.reduce((sum, data) => sum + data.marketCap, 0),
      totalVolume24h: allData.reduce((sum, data) => sum + data.volume24h, 0),
      activeSymbols: allData.length,
      topGainers: await this.getTopGainers(3),
      topLosers: await this.getTopLosers(3)
    };

    this.logger.info('Market summary generated', { 
      totalMarketCap: summary.totalMarketCap,
      totalVolume24h: summary.totalVolume24h 
    });
    
    return summary;
  }
}