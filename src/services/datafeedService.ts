/**
 * 行情源服务 - 统一管理随机数和akshare两种数据源
 * 支持数据源切换事件通知
 */

import { KLineData, StockInfo, RealtimeQuote, DatafeedType, DatafeedConfig } from './types'

// 数据源切换事件
export type DatafeedChangeListener = (type: DatafeedType) => void

// 股票代码映射表（A股代码）
const A_STOCK_MAP: Record<string, string> = {
  '600519': '贵州茅台',
  '000858': '五粮液',
  '601318': '中国平安',
  '000333': '美的集团',
  '600036': '招商银行',
  '002594': '比亚迪',
  '601888': '中国中免',
  '300750': '宁德时代',
  '600900': '长江电力',
  '000001': '平安银行',
  '601012': '隆基绿能',
  '002415': '海康威视',
  '600276': '恒瑞医药',
  '000651': '格力电器',
  '601166': '兴业银行',
  '600809': '山西汾酒',
  '002714': '牧原股份',
  '603259': '药明康德',
  '000568': '泸州老窖',
  '601398': '工商银行',
  '601390': '中国中铁',
  '601988': '中国银行',
  '601288': '农业银行',
  '600938': '中国海油',
  '601816': '京沪高铁',
  '600030': '中信证券',
  '601166': '兴业银行',
  '600036': '招商银行',
  '000002': '万科A',
  '000651': '格力电器',
  '000333': '美的集团',
  '002594': '比亚迪',
  '300750': '宁德时代',
  '688981': '中芯国际',
  '603288': '海天味业',
  '002475': '立讯精密',
  '002352': '顺丰控股',
  '600585': '海螺水泥',
  '601088': '中国神华',
  '600028': '中国石化',
  '601857': '中国石油',
  '600050': '中国联通',
  '601328': '交通银行',
  '601668': '中国建筑',
  '601919': '中远海控',
  '600690': '海尔智家',
  '600887': '伊利股份',
  '000568': '泸州老窖',
  '600809': '山西汾酒',
  '000596': '古井贡酒',
  '000799': '酒鬼酒',
  '600197': '伊力特',
  '603369': '今世缘',
  '002304': '洋河股份',
  '000681': '视觉中国',
  '300059': '东方财富',
  '601211': '国泰君安',
  '600837': '海通证券',
  '601688': '华泰证券',
  '600031': '三一重工',
  '601633': '长城汽车',
  '600741': '华域汽车',
  '000572': '海马汽车',
  '600104': '上汽集团',
  '601633': '长城汽车',
  '600309': '万华化学',
  '002001': '新和成',
  '600489': '中金黄金',
  '601899': '紫金矿业',
  '000630': '铜陵有色',
  '600547': '山东黄金',
  '600362': '江西铜业',
  '601600': '中国铝业',
  '600219': '南山铝业',
  '002171': '楚江新材',
  '002501': '利源精制',
  '600595': '中孚实业',
  '000761': '本钢板材',
  '600019': '宝钢股份',
  '601003': '柳钢股份',
  '600808': '马钢股份',
  '600010': '包钢股份',
  '000708': '中信特钢',
  '600581': '八一钢铁',
  '600307': '酒钢宏兴',
  '60139': '工商银行',
  '601166': '兴业银行',
  '600036': '招商银行',
  '601328': '交通银行',
  '601988': '中国银行',
  '601288': '农业银行',
  '601939': '建设银行',
  '601166': '兴业银行',
  '000001': '平安银行',
  '002142': '宁波银行',
  '600926': '杭州银行',
  '601229': '上海银行',
  '601166': '兴业银行',
  '601908': '京能电力',
  '600025': '华能国际',
  '600900': '长江电力',
  '600011': '华能国际',
  '601991': '大唐发电',
  '600021': '上海电力',
  '600795': '国电电力',
  '600900': '长江电力',
  '600900': '长江电力',
}

// 美股代码映射表
const US_STOCK_MAP: Record<string, string> = {
  'AAPL': 'Apple Inc.',
  'GOOGL': 'Alphabet Inc.',
  'AMZN': 'Amazon.com Inc.',
  'TSLA': 'Tesla Inc.',
  'MSFT': 'Microsoft Corporation',
  'META': 'Meta Platforms Inc.',
  'NVDA': 'NVIDIA Corporation',
  'BABA': 'Alibaba Group',
  'JPM': 'JPMorgan Chase',
  'V': 'Visa Inc.',
  'WMT': 'Walmart Inc.',
  'DIS': 'Walt Disney Co.',
  'NFLX': 'Netflix Inc.',
  'PYPL': 'PayPal Holdings',
  'INTC': 'Intel Corporation',
  'AMD': 'Advanced Micro Devices',
  'CRM': 'Salesforce Inc.',
  'UBER': 'Uber Technologies',
  'LYFT': 'Lyft Inc.',
  'SNAP': 'Snap Inc.',
  'TWTR': 'Twitter Inc.',
  'SQ': 'Square Inc.',
  'SHOP': 'Shopify Inc.',
  'SQ': 'Block Inc.',
  'COIN': 'Coinbase Global',
  'HOOD': 'Robinhood Markets',
  'RBLX': 'Roblox Corporation',
  'U': 'Unity Software',
  'PATH': 'UiPath Inc.',
  'DDOG': 'Datadog Inc.',
  'SNOW': 'Snowflake Inc.',
  'NET': 'Cloudflare Inc.',
  'CRWD': 'CrowdStrike Holdings',
  'ZS': 'Zscaler Inc.',
  'OKTA': 'Okta Inc.',
  'S': 'SentinelOne Inc.',
  'ABNB': 'Airbnb Inc.',
  'DASH': 'DoorDash Inc.',
  'UBER': 'Uber Technologies',
  'LYFT': 'Lyft Inc.',
  'GRUB': 'Grubhub Inc.',
  'YUMC': 'Yum China Holdings',
  'PDD': 'Pinduoduo Inc.',
  'JD': 'JD.com Inc.',
  'BABA': 'Alibaba Group',
  'NTES': 'NetEase Inc.',
  'TCEHY': 'Tencent Holdings',
  'BIDU': 'Baidu Inc.',
  'IQ': 'iQIYI Inc.',
  'VIPS': 'Vipshop Holdings',
  'MC': 'Mindstrong Health',
  'DOCU': 'DocuSign Inc.',
  'ZM': 'Zoom Video Communications',
  'TEAM': 'Atlassian Corporation',
  'WDAY': 'Workday Inc.',
  'VEEV': 'Veeva Systems Inc.',
  'HUBS': 'HubSpot Inc.',
  'BILL': 'Bill.com Holdings',
  'GTLB': 'GitLab Inc.',
  'ESTC': 'Elastic N.V.',
  'MDB': 'MongoDB Inc.',
  'PLTR': 'Palantir Technologies',
  'SNOW': 'Snowflake Inc.',
  'DDOG': 'Datadog Inc.',
  'NET': 'Cloudflare Inc.',
  'CRWD': 'CrowdStrike Holdings',
  'ZS': 'Zscaler Inc.',
  'OKTA': 'Okta Inc.',
  'S': 'SentinelOne Inc.',
  'PANW': 'Palo Alto Networks',
  'FTNT': 'Fortinet Inc.',
  'CYBR': 'CyberArk Software',
  'FEYE': 'FireEye Inc.',
  'RPD': 'Rapid7 Inc.',
  'TENB': 'Tenable Holdings',
  'QLYS': 'Qualys Inc.',
  'EXPD': 'Expeditors International',
  'EXPE': 'Expedia Group Inc.',
  'TRIP': 'TripAdvisor Inc.',
  'BKNG': 'Booking Holdings',
  'ABNB': 'Airbnb Inc.',
  'DASH': 'DoorDash Inc.',
  'UBER': 'Uber Technologies',
  'LYFT': 'Lyft Inc.',
}

// 生成反向映射：股票名称 -> 股票代码（支持模糊匹配）
function buildReverseStockMap(): Map<string, string> {
  const reverseMap = new Map<string, string>()
  
  // A股反向映射
  for (const [code, name] of Object.entries(A_STOCK_MAP)) {
    reverseMap.set(name.toLowerCase(), code)
    // 添加简称映射
    if (name.length > 2) {
      reverseMap.set(name.slice(0, -1).toLowerCase(), code) // 去掉最后一个字
    }
  }
  
  // 美股反向映射
  for (const [code, name] of Object.entries(US_STOCK_MAP)) {
    reverseMap.set(name.toLowerCase(), code)
    // 提取简称（去掉 Inc., Corp. 等后缀）
    const shortName = name
      .replace(/\s+(Inc\.|Corp\.|Corporation|Company|Holdings|Group|Technologies|Software|N\.V\.|Ltd\.|Co\.)$/i, '')
      .toLowerCase()
    reverseMap.set(shortName, code)
  }
  
  return reverseMap
}

// 创建反向映射（名称 -> 代码）
const REVERSE_STOCK_MAP = buildReverseStockMap()

// 导出反向映射供外部使用
export function getTickerByName(query: string): string | null {
  const cleaned = query.trim().toLowerCase()
  
  // 精确匹配
  if (REVERSE_STOCK_MAP.has(cleaned)) {
    return REVERSE_STOCK_MAP.get(cleaned)
  }
  
  // 模糊匹配：检查查询字符串是否是某个股票名称的子串
  for (const [name, code] of REVERSE_STOCK_MAP.entries()) {
    if (name.includes(cleaned) || cleaned.includes(name)) {
      return code
    }
  }
  
  return null
}

export class DatafeedService {
  private config: DatafeedConfig
  private currentType: DatafeedType = 'mock'
  private listeners: DatafeedChangeListener[] = []

  constructor(config?: DatafeedConfig) {
    this.config = config || { type: 'mock' }
    this.currentType = this.config.type
  }

  // 注册数据源切换监听器
  onSwitch(listener: DatafeedChangeListener): () => void {
    this.listeners.push(listener)
    // 返回取消订阅函数
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  // 静默设置数据源（不触发事件）
  setCurrentTypeSilent(type: DatafeedType): void {
    this.currentType = type
    this.config.type = type
    console.log(`[DatafeedService] 静默设置数据源: ${type}`)
  }

  // 切换数据源
  switchDatafeed(type: DatafeedType): void {
    if (this.currentType === type) return
    
    this.currentType = type
    this.config.type = type
    console.log(`[DatafeedService] 切换到数据源: ${type}`)
    
    // 通知所有监听器
    this.listeners.forEach(listener => listener(type))
  }

  getCurrentType(): DatafeedType {
    return this.currentType
  }

  getConfig(): DatafeedConfig {
    return this.config
  }

  setConfig(config: DatafeedConfig): void {
    this.config = config
  }

  /**
   * 获取K线数据
   */
  async getKLines(ticker: string, period: string = '1d', count: number = 100): Promise<KLineData[]> {
    console.log(`[DatafeedService] 获取K线数据 - 请求数据源: ${this.currentType}, 股票: ${ticker}`)
    if (this.currentType === 'akshare') {
      return this.getKLinesFromAkshare(ticker, period, count)
    }
    return this.getMockKLines(ticker, period, count)
  }

  /**
   * 获取实时行情
   */
  async getRealtimeQuote(ticker: string): Promise<RealtimeQuote | null> {
    console.log(`[DatafeedService] 获取实时行情 - 请求数据源: ${this.currentType}, 股票: ${ticker}`)
    if (this.currentType === 'akshare') {
      return this.getQuoteFromAkshare(ticker)
    }
    return this.getMockQuote(ticker)
  }

  /**
   * 搜索股票
   */
  async searchStocks(query: string): Promise<Array<{ ticker: string; name: string }>> {
    console.log(`[DatafeedService] 搜索股票 - 请求数据源: ${this.currentType}, 关键词: ${query}`)
    if (this.currentType === 'akshare') {
      return this.searchFromAkshare(query)
    }
    return this.searchMock(query)
  }

  // ==================== Mock 数据源 ====================

  private async getMockKLines(ticker: string, period: string, count: number): Promise<KLineData[]> {
    console.log('[DatafeedService] 生成模拟K线数据:', ticker, period, count)
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300))

    const klines: KLineData[] = []
    const now = Date.now()
    
    // 根据周期计算时间间隔
    let interval: number
    switch (period) {
      case '1m': interval = 60 * 1000; break
      case '5m': interval = 5 * 60 * 1000; break
      case '15m': interval = 15 * 60 * 1000; break
      case '30m': interval = 30 * 60 * 1000; break
      case '1h': interval = 60 * 60 * 1000; break
      case '4h': interval = 4 * 60 * 60 * 1000; break
      case '1d': interval = 24 * 60 * 60 * 1000; break
      default: interval = 24 * 60 * 60 * 1000
    }

    // 根据股票代码生成不同的基础价格
    const basePrice = this.getBasePrice(ticker)
    let price = basePrice

    for (let i = count; i > 0; i--) {
      const timestamp = now - (i * interval)
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

  private async getMockQuote(ticker: string): Promise<RealtimeQuote> {
    await new Promise(resolve => setTimeout(resolve, 200))

    const name = this.getStockName(ticker)
    const basePrice = this.getBasePrice(ticker)
    const change = (Math.random() - 0.5) * 10
    const changePercent = (change / basePrice) * 100

    return {
      ticker,
      name,
      price: Math.round(basePrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      high: Math.round((basePrice + Math.random() * 5) * 100) / 100,
      low: Math.round((basePrice - Math.random() * 5) * 100) / 100,
      open: Math.round(basePrice * 100) / 100,
      volume: Math.floor(Math.random() * 10000000),
      turnover: Math.floor(Math.random() * 100000000),
      timestamp: Date.now()
    }
  }

  private searchMock(query: string): Array<{ ticker: string; name: string }> {
    const allStocks = [
      ...Object.entries(A_STOCK_MAP).map(([ticker, name]) => ({ ticker, name })),
      ...Object.entries(US_STOCK_MAP).map(([ticker, name]) => ({ ticker, name }))
    ]

    if (!query) return allStocks

    return allStocks.filter(stock =>
      stock.ticker.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    )
  }

  private getBasePrice(ticker: string): number {
    // A股价格范围（30-150元）
    if (/^\d{6}$/.test(ticker)) {
      return 30 + Math.random() * 120
    }
    // 港股价格范围
    if (/^\d{5}$/.test(ticker)) {
      return 10 + Math.random() * 200
    }
    // 美股价格范围（50-400美元）
    return 50 + Math.random() * 350
  }

  private getStockName(ticker: string): string {
    // 优先从映射表获取
    if (A_STOCK_MAP[ticker]) return A_STOCK_MAP[ticker]
    if (US_STOCK_MAP[ticker]) return US_STOCK_MAP[ticker]
    
    // 根据代码格式智能生成名称
    if (/^\d{6}$/.test(ticker)) {
      // A股：返回代码+未知股票
      return `${ticker} (A股)`
    }
    if (/^\d{5}$/.test(ticker)) {
      // 港股
      return `${ticker} (港股)`
    }
    
    // 美股/其他：根据代码长度生成名称
    if (ticker.length === 1) {
      return `${ticker} Inc.`
    } else if (ticker.length === 2) {
      return `${ticker} Group`
    } else if (ticker.length <= 4) {
      return `${ticker} Corporation`
    } else {
      return `${ticker} Ltd.`
    }
  }

  // ==================== 真实数据源（使用公开API）====================

  /**
   * 从Yahoo Finance获取K线数据（通过公开API）
   */
  private async getKLinesFromAkshare(ticker: string, period: string, count: number): Promise<KLineData[]> {
    console.log('[DatafeedService] 从真实API获取K线数据:', ticker, period, count)

    try {
      // 判断是A股还是美股
      const isAStock = /^\d{6}$/.test(ticker)
      
      let symbol: string
      if (isAStock) {
        // A股需要添加交易所后缀
        symbol = this.convertATickerToYahoo(ticker)
      } else {
        symbol = ticker.toUpperCase()
      }

      // 使用Yahoo Finance公开API（通过代理或直接访问）
      const yahooPeriod = this.convertPeriodToYahoo(period)
      const range = this.countToRange(count)
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${yahooPeriod}&range=${range}&includePrePost=false`
      
      // 使用CORS代理或直接请求
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`)
      }

      const data = await response.json()
      const result = data.chart.result[0]
      const timestamps = result.timestamp
      const quotes = result.indicators.quote[0]

      if (!timestamps || !quotes) {
        throw new Error('No data returned from Yahoo Finance')
      }

      const klines: KLineData[] = []
      for (let i = 0; i < timestamps.length; i++) {
        klines.push({
          timestamp: timestamps[i] * 1000, // Yahoo返回的是秒级时间戳
          open: quotes.open[i] || 0,
          high: quotes.high[i] || 0,
          low: quotes.low[i] || 0,
          close: quotes.close[i] || 0,
          volume: quotes.volume[i] || 0
        })
      }

      console.log(`[DatafeedService] 成功获取 ${klines.length} 条K线数据`)
      return klines
    } catch (error) {
      console.error('[DatafeedService] 获取K线数据失败:', error)
      console.warn('[DatafeedService] ⚠️ 真实数据获取失败，已自动回退到模拟数据')
      // 失败时回退到模拟数据
      return this.getMockKLines(ticker, period, count)
    }
  }

  /**
   * 从Yahoo Finance获取实时行情
   */
  private async getQuoteFromAkshare(ticker: string): Promise<RealtimeQuote | null> {
    console.log('[DatafeedService] 从真实API获取实时行情:', ticker)

    try {
      // 判断是A股还是美股
      const isAStock = /^\d{6}$/.test(ticker)
      
      let symbol: string
      if (isAStock) {
        symbol = this.convertATickerToYahoo(ticker)
      } else {
        symbol = ticker.toUpperCase()
      }

      // 使用Yahoo Finance公开API获取实时行情
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d&includePrePost=false`
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`)
      }

      const data = await response.json()
      const result = data.chart.result[0]
      const meta = result.meta
      const quotes = result.indicators.quote[0][0]

      const name = this.getStockName(ticker)
      const price = meta.regularMarketPrice
      const previousClose = meta.chartPreviousClose || price
      const change = price - previousClose
      const changePercent = (change / previousClose) * 100

      return {
        ticker,
        name,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        high: Math.round(quotes.high * 100) / 100,
        low: Math.round(quotes.low * 100) / 100,
        open: Math.round(quotes.open * 100) / 100,
        volume: quotes.volume || 0,
        turnover: 0, // Yahoo不直接提供成交额
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('[DatafeedService] 获取实时行情失败:', error)
      console.warn('[DatafeedService] ⚠️ 真实数据获取失败，已自动回退到模拟数据')
      // 失败时回退到模拟数据
      return this.getMockQuote(ticker)
    }
  }

  private async searchFromAkshare(query: string): Promise<Array<{ ticker: string; name: string }>> {
    console.log('[DatafeedService] 从真实API搜索股票:', query)
    
    try {
      // 使用Yahoo Finance搜索API
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}"esCount=5&newsCount=0`
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Yahoo Finance search API error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.quotes) {
        return data.quotes.map((item: any) => ({
          ticker: item.symbol,
          name: item.shortname || item.symbol
        }))
      }
      
      return []
    } catch (error) {
      console.error('[DatafeedService] 搜索股票失败:', error)
      console.warn('[DatafeedService] ⚠️ 真实搜索失败，已自动回退到本地搜索')
      return this.searchMock(query)
    }
  }

  // 转换A股代码为Yahoo格式
  private convertATickerToYahoo(ticker: string): string {
    // A股代码映射到Yahoo Finance
    // 上交所: 6xxxxx -> xxxxxx.SS
    // 深交所: 0xxxxx, 3xxxxx -> xxxxxx.SZ
    if (ticker.startsWith('6')) {
      return `${ticker}.SS`
    } else {
      return `${ticker}.SZ`
    }
  }

  // 转换周期格式为Yahoo格式
  private convertPeriodToYahoo(period: string): string {
    const periodMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '60m',
      '4h': '4h',
      '1d': '1d'
    }
    return periodMap[period] || '1d'
  }

  // 将K线数量转换为Yahoo的时间范围
  private countToRange(count: number): string {
    if (count <= 30) return '1mo'
    if (count <= 90) return '3mo'
    if (count <= 180) return '6mo'
    if (count <= 365) return '1y'
    if (count <= 730) return '2y'
    if (count <= 1825) return '5y'
    return '10y'
  }
}

// 导出单例
export const datafeedService = new DatafeedService()