/**
 * 行情数据类型定义
 */

export interface KLineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockInfo {
  ticker: string
  name: string
  exchange: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  open: number
  volume: number
  turnover: number
  marketCap: string
}

export interface RealtimeQuote {
  ticker: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  open: number
  volume: number
  turnover: number
  timestamp: number
}

export type DatafeedType = 'mock' | 'akshare'

export interface DatafeedSource {
  type: DatafeedType
  label: string
  icon: string
  description: string
}

export const DATAFEED_SOURCES: DatafeedSource[] = [
  {
    type: 'mock',
    label: '模拟数据',
    icon: '🎲',
    description: '使用随机生成的模拟数据，适合演示和测试'
  },
  {
    type: 'akshare',
    label: 'AKShare',
    icon: '📈',
    description: '使用AKShare真实行情数据，需配置后端服务'
  }
]

export interface DatafeedConfig {
  type: DatafeedType
  akshareBaseUrl?: string  // akshare 后端服务地址
}

export interface AIAnalysisRequest {
  ticker: string
  stockName: string
  klineData: KLineData[]
  realtimeQuote?: RealtimeQuote
  prompt?: string
}

export interface AIAnalysisResponse {
  summary: string
  trend: '上涨' | '下跌' | '震荡'
  support: number[]
  resistance: number[]
  recommendation: '买入' | '卖出' | '持有'
  confidence: number  // 0-100
  technicalIndicators: {
    ma5: number
    ma10: number
    ma20: number
    macd: number
    rsi: number
    bollUpper: number
    bollLower: number
  }
  rawResponse: string
}