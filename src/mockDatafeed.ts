/**
 * 模拟数据源 - 用于测试和演示，无需 API Key
 * 生成随机的 K 线数据
 */

interface KLineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Trade {
  timestamp: number
  price: number
  volume: number
}

export class MockDatafeed {
  private basePrice: number = 150
  private symbol: string = 'BABA'
  
  // 根据周期字符串获取时间间隔（毫秒）
  private getInterval(period: string): number {
    switch (period) {
      case '1m': return 60 * 1000
      case '5m': return 5 * 60 * 1000
      case '15m': return 15 * 60 * 1000
      case '30m': return 30 * 60 * 1000
      case '1h': return 60 * 60 * 1000
      case '4h': return 4 * 60 * 60 * 1000
      case '1d': return 24 * 60 * 60 * 1000
      default: return 15 * 60 * 1000
    }
  }
  
  // 生成模拟 K 线数据
  generateKLines(period: string, count: number = 1000): KLineData[] {
    const klines: KLineData[] = []
    const now = Date.now()
    
    // 根据周期计算时间间隔（毫秒）
    let interval: number
    switch (period) {
      case '1m': interval = 60 * 1000; break
      case '5m': interval = 5 * 60 * 1000; break
      case '15m': interval = 15 * 60 * 1000; break
      case '30m': interval = 30 * 60 * 1000; break
      case '1h': interval = 60 * 60 * 1000; break
      case '4h': interval = 4 * 60 * 60 * 1000; break
      case '1d': interval = 24 * 60 * 60 * 1000; break
      default: interval = 15 * 60 * 1000
    }
    
    let price = this.basePrice
    for (let i = count; i > 0; i--) {
      const timestamp = now - (i * interval)
      
      // 生成随机波动（±2%）
      const change = (Math.random() - 0.5) * 0.04 * price
      const open = price
      const close = price + change
      const high = Math.max(open, close) * (1 + Math.random() * 0.01)
      const low = Math.min(open, close) * (1 - Math.random() * 0.01)
      const volume = Math.floor(Math.random() * 1000000) + 100000
      
      klines.push({
        timestamp,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume
      })
      
      price = close
    }
    
    return klines
  }
  
  // 获取 K 线数据（兼容旧接口）
  async getKlines(params: {
    ticker: string
    multiplier: number
    timespan: string
    from: number
    to: number
  }): Promise<KLineData[]> {
    console.log('[MockDatafeed] 获取 K 线数据:', params)
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const period = `${params.multiplier}${params.timespan.charAt(0)}`
    return this.generateKLines(period, 500)
  }
  
  // 获取历史 K 线数据（KLineChart Pro 要求的核心方法）
  async getHistoryKLineData(params: {
    ticker: string
    period: string
    count: number
    from?: number
    to?: number
  }): Promise<KLineData[]> {
    console.log('[MockDatafeed] 获取历史 K 线数据:', params)
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return this.generateKLines(params.period, params.count || 1000)
  }
  
  // 获取交易数据
  async getTrades(params: {
    ticker: string
    from: number
    to: number
  }): Promise<Trade[]> {
    console.log('[MockDatafeed] 获取交易数据:', params)
    
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const trades: Trade[] = []
    const now = Date.now()
    let price = this.basePrice
    
    for (let i = 100; i > 0; i--) {
      const timestamp = now - (i * 1000)
      price = price * (1 + (Math.random() - 0.5) * 0.001)
      trades.push({
        timestamp,
        price: parseFloat(price.toFixed(2)),
        volume: Math.floor(Math.random() * 1000) + 100
      })
    }
    
    return trades
  }
  
  // 获取股票信息
  async getTickerDetails(ticker: string): Promise<any> {
    console.log('[MockDatafeed] 获取股票详情:', ticker)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return {
      ticker: ticker,
      name: `${ticker} Corporation (模拟数据)`,
      exchange: 'MOCK',
      type: 'Stock',
      currency: 'USD',
      market_cap: 200000000000,
      shares_outstanding: 1000000000
    }
  }
  
// 搜索股票
  async searchTickers(query: string): Promise<any[]> {
    console.log('[MockDatafeed] 搜索股票:', query)
    
    await new Promise(resolve => setTimeout(resolve, 150))
    
    const mockStocks = [
      { ticker: 'BABA', name: 'Alibaba Group (模拟)', exchange: 'NYSE' },
      { ticker: 'AAPL', name: 'Apple Inc. (模拟)', exchange: 'NASDAQ' },
      { ticker: 'GOOGL', name: 'Alphabet Inc. (模拟)', exchange: 'NASDAQ' },
      { ticker: 'MSFT', name: 'Microsoft Corporation (模拟)', exchange: 'NASDAQ' },
      { ticker: 'AMZN', name: 'Amazon.com Inc. (模拟)', exchange: 'NASDAQ' },
      { ticker: 'TSLA', name: 'Tesla Inc. (模拟)', exchange: 'NASDAQ' },
      { ticker: 'META', name: 'Meta Platforms (模拟)', exchange: 'NASDAQ' },
      { ticker: 'NVDA', name: 'NVIDIA Corporation (模拟)', exchange: 'NASDAQ' }
    ]
    
    if (!query) return mockStocks
    
    return mockStocks.filter(stock => 
      stock.ticker.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    )
  }
  
  // 订阅实时数据（KLineChart Pro 要求）
  subscribe(ticker: string, period: string, callback: (data: KLineData) => void): () => void {
    console.log('[MockDatafeed] 订阅实时数据:', ticker, period)
    
    // 模拟实时数据推送 - 每隔几秒生成一个新的 K 线数据
    const interval = this.getInterval(period)
    const timer = setInterval(() => {
      const newKLine: KLineData = {
        timestamp: Date.now(),
        open: this.basePrice,
        high: this.basePrice * 1.02,
        low: this.basePrice * 0.98,
        close: this.basePrice * (1 + (Math.random() - 0.5) * 0.04),
        volume: Math.floor(Math.random() * 1000000) + 100000
      }
      callback(newKLine)
    }, Math.min(interval, 5000)) // 最多每 5 秒更新一次
    
    // 返回取消订阅函数
    return () => {
      console.log('[MockDatafeed] 取消订阅:', ticker)
      clearInterval(timer)
    }
  }
  
  // 取消订阅（KLineChart Pro 要求）
  unsubscribe(ticker: string, period: string): void {
    console.log('[MockDatafeed] 取消订阅:', ticker, period)
    // 实际取消由 subscribe 返回的函数处理
  }
}
