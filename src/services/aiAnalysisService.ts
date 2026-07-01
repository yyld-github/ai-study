/**
 * AI分析服务 - 接入DeepSeek/Agnes进行行情AI分析
 */

import { KLineData, RealtimeQuote, AIAnalysisRequest, AIAnalysisResponse } from './types'

export interface AIConfig {
  provider: 'deepseek' | 'agnes' | 'mock'
  apiKey?: string
  baseUrl?: string
  model?: string
}

export class AIAnalysisService {
  private config: AIConfig
  private isAnalyzing: boolean = false

  constructor(config?: AIConfig) {
    this.config = config || { provider: 'mock' }
  }

  setConfig(config: AIConfig): void {
    this.config = config
  }

  getConfig(): AIConfig {
    return this.config
  }

  /**
   * 执行AI分析
   */
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (this.config.provider === 'deepseek') {
      return this.analyzeWithDeepSeek(request)
    } else if (this.config.provider === 'agnes') {
      return this.analyzeWithAgnes(request)
    }
    // 默认使用模拟分析
    return this.analyzeWithMock(request)
  }

  /**
   * 使用DeepSeek API进行分析
   */
  private async analyzeWithDeepSeek(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    console.log('[AIAnalysisService] 使用DeepSeek进行分析:', request.ticker)

    const baseUrl = this.config.baseUrl || 'https://api.deepseek.com'
    const model = this.config.model || 'deepseek-chat'

    // 构建技术分析数据
    const technicalAnalysis = this.calculateTechnicalIndicators(request.klineData)
    
    // 构建提示词
    const prompt = this.buildAnalysisPrompt(request, technicalAnalysis)

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: '你是一位专业的股票分析师，擅长技术分析和趋势判断。请根据提供的K线数据和技术指标，给出专业的分析意见。输出格式必须包含：趋势判断、支撑位、阻力位、操作建议和信心指数。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`)
      }

      const data = await response.json()
      const rawResponse = data.choices[0].message.content

      // 解析AI响应
      return this.parseAIResponse(rawResponse, technicalAnalysis)
    } catch (error) {
      console.error('[AIAnalysisService] DeepSeek分析失败:', error)
      // 失败时回退到模拟分析
      return this.analyzeWithMock(request)
    }
  }

  /**
   * 使用Agnes API进行分析
   */
  private async analyzeWithAgnes(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    console.log('[AIAnalysisService] 使用Agnes进行分析:', request.ticker)

    const baseUrl = this.config.baseUrl || 'https://api.agnes.ai'

    const technicalAnalysis = this.calculateTechnicalIndicators(request.klineData)
    const prompt = this.buildAnalysisPrompt(request, technicalAnalysis)

    try {
      const response = await fetch(`${baseUrl}/v1/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          ticker: request.ticker,
          stockName: request.stockName,
          klineData: request.klineData.slice(-50), // 只发送最近50根K线
          technicalIndicators: technicalAnalysis,
          prompt: prompt
        })
      })

      if (!response.ok) {
        throw new Error(`Agnes API error: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        summary: data.summary || '分析完成',
        trend: data.trend || '震荡',
        support: data.support || [],
        resistance: data.resistance || [],
        recommendation: data.recommendation || '持有',
        confidence: data.confidence || 50,
        technicalIndicators: technicalAnalysis,
        rawResponse: JSON.stringify(data)
      }
    } catch (error) {
      console.error('[AIAnalysisService] Agnes分析失败:', error)
      return this.analyzeWithMock(request)
    }
  }

  /**
   * 模拟AI分析（用于演示）
   */
  private async analyzeWithMock(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    console.log('[AIAnalysisService] 使用模拟AI分析:', request.ticker)

    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    const technicalAnalysis = this.calculateTechnicalIndicators(request.klineData)
    
    // 根据最近的数据趋势判断
    const recentData = request.klineData.slice(-20)
    const firstClose = recentData[0]?.close || 0
    const lastClose = recentData[recentData.length - 1]?.close || 0
    const changePercent = ((lastClose - firstClose) / firstClose) * 100

    let trend: '上涨' | '下跌' | '震荡' = '震荡'
    let recommendation: '买入' | '卖出' | '持有' = '持有'

    if (changePercent > 2) {
      trend = '上涨'
      recommendation = '持有'
    } else if (changePercent < -2) {
      trend = '下跌'
      recommendation = '观望' as any
    }

    // 计算支撑位和阻力位
    const prices = request.klineData.map(k => k.close)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const currentPrice = lastClose

    const support = [
      Math.round(minPrice * 1.02 * 100) / 100,
      Math.round((minPrice + currentPrice) / 2 * 100) / 100
    ]
    const resistance = [
      Math.round((maxPrice + currentPrice) / 2 * 100) / 100,
      Math.round(maxPrice * 0.98 * 100) / 100
    ]

    const summary = `${request.stockName}(${request.ticker}) 当前处于${trend}趋势中。
近20日价格变化${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%。
MA5: ${technicalAnalysis.ma5.toFixed(2)}, MA10: ${technicalAnalysis.ma10.toFixed(2)}, MA20: ${technicalAnalysis.ma20.toFixed(2)}。
RSI指标: ${technicalAnalysis.rsi.toFixed(2)}，${technicalAnalysis.rsi > 70 ? '超买' : technicalAnalysis.rsi < 30 ? '超卖' : '正常'}区域。
建议${recommendation}，关注支撑位${support[0].toFixed(2)}和阻力位${resistance[0].toFixed(2)}。`

    return {
      summary,
      trend,
      support,
      resistance,
      recommendation,
      confidence: Math.floor(50 + Math.random() * 30),
      technicalIndicators: technicalAnalysis,
      rawResponse: summary
    }
  }

  /**
   * 计算技术指标
   */
  private calculateTechnicalIndicators(klineData: KLineData[]) {
    const closes = klineData.map(k => k.close)
    const volumes = klineData.map(k => k.volume)

    // 计算MA
    const ma5 = this.calculateMA(closes, 5)
    const ma10 = this.calculateMA(closes, 10)
    const ma20 = this.calculateMA(closes, 20)

    // 计算RSI
    const rsi = this.calculateRSI(closes, 14)

    // 计算MACD
    const macd = this.calculateMACD(closes)

    // 计算布林带
    const bollUpper = this.calculateBollUpper(closes, 20)
    const bollLower = this.calculateBollLower(closes, 20)

    return {
      ma5,
      ma10,
      ma20,
      macd,
      rsi,
      bollUpper,
      bollLower
    }
  }

  private calculateMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0
    const slice = data.slice(-period)
    return slice.reduce((sum, val) => sum + val, 0) / period
  }

  private calculateRSI(data: number[], period: number = 14): number {
    if (data.length < period + 1) return 50

    const changes: number[] = []
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1])
    }

    const recentChanges = changes.slice(-period)
    const gains = recentChanges.filter(c => c > 0)
    const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c))

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0.01

    const rs = avgGain / avgLoss
    return 100 - (100 / (1 + rs))
  }

  private calculateMACD(data: number[]): number {
    if (data.length < 26) return 0
    
    const ema12 = this.calculateEMA(data, 12)
    const ema26 = this.calculateEMA(data, 26)
    
    return ema12 - ema26
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0
    
    const k = 2 / (period + 1)
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period
    
    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k)
    }
    
    return ema
  }

  private calculateBollUpper(data: number[], period: number = 20): number {
    const ma = this.calculateMA(data, period)
    const stdDev = this.calculateStdDev(data, period)
    return ma + 2 * stdDev
  }

  private calculateBollLower(data: number[], period: number = 20): number {
    const ma = this.calculateMA(data, period)
    const stdDev = this.calculateStdDev(data, period)
    return ma - 2 * stdDev
  }

  private calculateStdDev(data: number[], period: number): number {
    const slice = data.slice(-period)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const squaredDiffs = slice.map(val => Math.pow(val - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period
    return Math.sqrt(avgSquaredDiff)
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(request: AIAnalysisRequest, technicalAnalysis: any): string {
    const recentData = request.klineData.slice(-10)
    const firstClose = recentData[0]?.close || 0
    const lastClose = recentData[recentData.length - 1]?.close || 0
    const changePercent = ((lastClose - firstClose) / firstClose) * 100

    return `请对以下股票进行技术分析：

股票信息：
- 代码：${request.ticker}
- 名称：${request.stockName}
- 当前价格：${lastClose.toFixed(2)}
- 近10日涨跌幅：${changePercent.toFixed(2)}%

技术指标：
- MA5: ${technicalAnalysis.ma5.toFixed(2)}
- MA10: ${technicalAnalysis.ma10.toFixed(2)}
- MA20: ${technicalAnalysis.ma20.toFixed(2)}
- RSI(14): ${technicalAnalysis.rsi.toFixed(2)}
- MACD: ${technicalAnalysis.macd.toFixed(2)}
- 布林带上轨: ${technicalAnalysis.bollUpper.toFixed(2)}
- 布林带下轨: ${technicalAnalysis.bollLower.toFixed(2)}

请提供：
1. 趋势判断（上涨/下跌/震荡）
2. 支撑位（2个）
3. 阻力位（2个）
4. 操作建议（买入/卖出/持有）
5. 信心指数（0-100）
6. 简要分析说明`
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(rawResponse: string, technicalAnalysis: any): AIAnalysisResponse {
    // 尝试从响应中提取关键信息
    const trendMatch = rawResponse.match(/(?:趋势|trend)[:：]\s*(上涨|下跌|震荡)/i)
    const supportMatch = rawResponse.match(/(?:支撑|support)[:：]\s*([\d.]+)/i)
    const resistanceMatch = rawResponse.match(/(?:阻力|resistance)[:：]\s*([\d.]+)/i)
    const recommendationMatch = rawResponse.match(/(?:建议|recommendation)[:：]\s*(买入|卖出|持有|观望)/i)
    const confidenceMatch = rawResponse.match(/(?:信心|confidence)[:：]\s*(\d+)/i)

    return {
      summary: rawResponse,
      trend: (trendMatch?.[1] as any) || '震荡',
      support: supportMatch ? [parseFloat(supportMatch[1])] : [],
      resistance: resistanceMatch ? [parseFloat(resistanceMatch[1])] : [],
      recommendation: (recommendationMatch?.[1] as any) || '持有',
      confidence: parseInt(confidenceMatch?.[1] || '50'),
      technicalIndicators: technicalAnalysis,
      rawResponse
    }
  }
}

// 导出单例
export const aiAnalysisService = new AIAnalysisService()