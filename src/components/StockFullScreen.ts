import { KLineChartPro, ChartProOptions, SymbolInfo, Period, Datafeed } from '@klinecharts/pro'
import { KLineData } from 'klinecharts'
import { aiAnalysisService } from '../services/aiAnalysisService'
import { datafeedService } from '../services/datafeedService'
import { AIAnalysisResponse, KLineData as ServiceKLineData, DatafeedType } from '../services/types'

export interface StockFullScreenOptions {
  ticker: string
  name: string
  price: number
  change?: number
  changePercent?: number
  klineData?: KLineData[]
  onClose?: () => void
}

// 统一数据源适配器 - 实现 Datafeed 接口，根据当前数据源类型获取数据
class UnifiedDatafeed implements Datafeed {
  private currentType: DatafeedType = 'mock'

  constructor() {
    // 同步当前数据源类型
    this.currentType = datafeedService.getCurrentType()
    // 监听数据源切换
    datafeedService.onSwitch((type) => {
      this.currentType = type
      console.log('[UnifiedDatafeed] 数据源已切换到:', type)
    })
  }

  searchSymbols(search?: string): Promise<SymbolInfo[]> {
    const mockStocks: SymbolInfo[] = [
      { ticker: 'BABA', name: 'Alibaba Group', exchange: 'NYSE' },
      { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
      { ticker: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
      { ticker: 'META', name: 'Meta Platforms', exchange: 'NASDAQ' },
      { ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
      { ticker: '600519', name: '贵州茅台', exchange: 'SH' },
      { ticker: '000858', name: '五粮液', exchange: 'SZ' },
      { ticker: '601318', name: '中国平安', exchange: 'SH' },
      { ticker: '000333', name: '美的集团', exchange: 'SZ' }
    ]

    if (!search) return Promise.resolve(mockStocks)

    return Promise.resolve(mockStocks.filter(stock =>
      stock.ticker.toLowerCase().includes(search.toLowerCase()) ||
      stock.name?.toLowerCase().includes(search.toLowerCase())
    ))
  }

  async getHistoryKLineData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]> {
    // 根据当前数据源类型获取数据
    if (this.currentType === 'akshare') {
      return this.getKLinesFromAkshare(symbol.ticker, period)
    }
    return this.getMockKLines(symbol.ticker, period)
  }

  // 根据股票代码生成稳定的基础价格（使用简单哈希）
  private getBasePriceForTicker(ticker: string): number {
    let hash = 0
    for (let i = 0; i < ticker.length; i++) {
      hash = ((hash << 5) - hash) + ticker.charCodeAt(i)
      hash |= 0
    }
    const normalized = Math.abs(hash)
    
    // A股：30-150元
    if (/^\d{6}$/.test(ticker)) {
      return 30 + (normalized % 120)
    }
    // 港股：10-200元
    if (/^\d{5}$/.test(ticker)) {
      return 10 + (normalized % 190)
    }
    // 美股：50-400美元
    return 50 + (normalized % 350)
  }

  private async getMockKLines(ticker: string, period: Period): Promise<KLineData[]> {
    const klines: KLineData[] = []
    const now = Date.now()
    let price = this.getBasePriceForTicker(ticker)

    const interval = this.getInterval(period)

    for (let i = 500; i > 0; i--) {
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

    await new Promise(resolve => setTimeout(resolve, 300))
    return klines
  }

  private async getKLinesFromAkshare(ticker: string, period: Period): Promise<KLineData[]> {
    const baseUrl = datafeedService.getConfig().akshareBaseUrl || '/api/akshare'
    
    try {
      const isAStock = /^\d{6}$/.test(ticker)
      const endpoint = isAStock
        ? `${baseUrl}/stock/kline`
        : `${baseUrl}/stock/us/kline`

      const periodText = this.convertPeriod(period)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: ticker,
          period: periodText,
          count: 500
        })
      })

      if (!response.ok) {
        throw new Error(`AKShare API error: ${response.status}`)
      }

      const data = await response.json()
      return data.data.map((item: any) => ({
        timestamp: new Date(item.date).getTime(),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseInt(item.volume)
      }))
    } catch (error) {
      console.error('[UnifiedDatafeed] AKShare获取K线数据失败，回退到模拟数据:', error)
      return this.getMockKLines(ticker, period)
    }
  }

  subscribe(symbol: SymbolInfo, period: Period, callback: (data: KLineData) => void): void {
    const interval = this.getInterval(period)
    let price = 150
    const timer = setInterval(() => {
      price = price * (1 + (Math.random() - 0.5) * 0.002)
      const newKLine: KLineData = {
        timestamp: Date.now(),
        open: price,
        high: price * 1.01,
        low: price * 0.99,
        close: price * (1 + (Math.random() - 0.5) * 0.002),
        volume: Math.floor(Math.random() * 1000000) + 100000
      }
      callback(newKLine)
    }, Math.min(interval, 5000))
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    // 实际取消由 subscribe 返回的函数处理
  }

  private getInterval(period: Period): number {
    const { multiplier, timespan } = period
    const unit = timespan.charAt(0)
    switch (unit) {
      case 'm': return multiplier * 60 * 1000
      case 'h': return multiplier * 60 * 60 * 1000
      case 'd': return multiplier * 24 * 60 * 60 * 1000
      default: return 15 * 60 * 1000
    }
  }

  private convertPeriod(period: Period): string {
    const { multiplier, timespan } = period
    const unit = timespan.charAt(0)
    if (unit === 'd') return 'daily'
    if (unit === 'h') return `${multiplier * 60}min`
    return `${multiplier}min`
  }
}

export class StockFullScreen {
  private chart: KLineChartPro | null = null
  private overlay: HTMLElement | null = null
  private onCloseCallback: (() => void) | null = null
  private datafeed: UnifiedDatafeed | null = null
  private aiPanel: HTMLElement | null = null
  private isAiPanelVisible: boolean = false
  private currentTicker: string = ''
  private currentName: string = ''
  private currentKlineData: KLineData[] = []

  render(container: HTMLElement, options: StockFullScreenOptions) {
    this.currentTicker = options.ticker
    this.currentName = options.name
    this.currentKlineData = options.klineData || []

    // 创建全屏遮罩层
    this.overlay = document.createElement('div')
    this.overlay.className = 'stock-full-screen-overlay'
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(255, 255, 255, 0.98);
      z-index: 9999;
      display: flex;
      flex-direction: column;
    `

    // 创建头部
    const headerDiv = document.createElement('div')
    headerDiv.className = 'stock-full-screen-header'
    headerDiv.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 20px;
      background-color: #ffffff;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    `

    // 股票信息
    const stockInfoDiv = document.createElement('div')
    stockInfoDiv.style.cssText = 'display: flex; align-items: baseline; gap: 15px;'
    stockInfoDiv.innerHTML = `
      <span style="font-size: 24px; font-weight: bold; color: rgba(0, 0, 0, 0.87);">${options.ticker}</span>
      <span style="font-size: 16px; color: rgba(0, 0, 0, 0.6);">${options.name}</span>
      <span style="font-size: 20px; color: rgba(0, 0, 0, 0.87);">${options.price.toFixed(2)}</span>
      ${options.change !== undefined ? `
        <span style="font-size: 16px; color: ${options.change >= 0 ? '#ef5350' : '#26a69a'};">
          ${options.change >= 0 ? '+' : ''}${options.change.toFixed(2)} 
          (${options.changePercent !== undefined ? (options.changePercent >= 0 ? '+' : '') + options.changePercent.toFixed(2) + '%' : ''})
        </span>
      ` : ''}
    `

    // AI分析按钮
    const aiBtn = document.createElement('button')
    aiBtn.className = 'ai-analysis-btn'
    aiBtn.innerHTML = '🤖 AI分析'
    aiBtn.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-size: 14px;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s;
      margin-right: 10px;
    `
    aiBtn.onmouseover = () => { aiBtn.style.transform = 'scale(1.05)' }
    aiBtn.onmouseout = () => { aiBtn.style.transform = 'scale(1)' }
    aiBtn.onclick = () => this.toggleAiPanel()

    // 关闭按钮
    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '✕'
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: rgba(0, 0, 0, 0.5);
      font-size: 24px;
      cursor: pointer;
      padding: 5px 10px;
      transition: color 0.2s;
    `
    closeBtn.onmouseover = () => { closeBtn.style.color = 'rgba(0, 0, 0, 0.87)' }
    closeBtn.onmouseout = () => { closeBtn.style.color = 'rgba(0, 0, 0, 0.5)' }
    closeBtn.onclick = () => {
      this.close()
      if (this.onCloseCallback) {
        this.onCloseCallback()
      }
    }

    const headerActions = document.createElement('div')
    headerActions.style.cssText = 'display: flex; align-items: center;'
    headerActions.appendChild(aiBtn)
    headerActions.appendChild(closeBtn)

    headerDiv.appendChild(stockInfoDiv)
    headerDiv.appendChild(headerActions)
    this.overlay.appendChild(headerDiv)

    // 创建主内容区域（图表 + AI面板）
    const mainContent = document.createElement('div')
    mainContent.style.cssText = `
      flex: 1;
      display: flex;
      overflow: hidden;
    `

    // 创建图表容器
    const chartContainer = document.createElement('div')
    chartContainer.id = 'klinechart-pro-container'
    chartContainer.style.cssText = `
      flex: 1;
      width: 100%;
      position: relative;
      transition: all 0.3s;
    `
    mainContent.appendChild(chartContainer)

    // 创建AI分析面板（从右侧弹出）
    this.aiPanel = document.createElement('div')
    this.aiPanel.style.cssText = `
      position: fixed;
      top: 0;
      right: -450px;
      width: 450px;
      height: 100vh;
      background: #ffffff;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10000;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    `
    document.body.appendChild(this.aiPanel)
    this.overlay.appendChild(mainContent)

    // 添加到页面
    container.appendChild(this.overlay)

    // 初始化 KLineChartPro 官方组件
    this.initChartPro(chartContainer, options)

    // 保存回调
    this.onCloseCallback = options.onClose || null

    // ESC 键关闭
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isAiPanelVisible) {
          this.toggleAiPanel()
        } else {
          this.close()
          if (this.onCloseCallback) {
            this.onCloseCallback()
          }
        }
        document.removeEventListener('keydown', handleEsc)
      }
    }
    document.addEventListener('keydown', handleEsc)
  }

  // 切换AI分析面板
  private async toggleAiPanel(): Promise<void> {
    if (!this.aiPanel || !this.overlay) return

    this.isAiPanelVisible = !this.isAiPanelVisible

    if (this.isAiPanelVisible) {
      // 显示面板 - 从右侧滑入
      this.aiPanel.style.right = '0'
      this.aiPanel.innerHTML = `
        <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
            <h3 style="margin: 0; font-size: 20px; color: #333;">🤖 AI 智能分析</h3>
            <button id="ai-close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px 10px; border-radius: 4px; transition: all 0.2s;">✕</button>
          </div>
          <div class="ai-loading" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div class="ai-spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p style="margin-top: 15px; color: #666; font-size: 14px;">正在分析 ${this.currentTicker}...</p>
          </div>
        </div>
      `
      
      // 添加关闭按钮事件
      const closeBtn = this.aiPanel.querySelector('#ai-close-btn')
      if (closeBtn) {
        closeBtn.onclick = () => this.toggleAiPanel()
        closeBtn.onmouseover = () => {
          ;(closeBtn as HTMLElement).style.background = '#f0f0f0'
          ;(closeBtn as HTMLElement).style.color = '#333'
        }
        closeBtn.onmouseout = () => {
          ;(closeBtn as HTMLElement).style.background = 'none'
          ;(closeBtn as HTMLElement).style.color = '#666'
        }
      }
      
      // 添加旋转动画样式
      if (!document.getElementById('ai-spinner-style')) {
        const style = document.createElement('style')
        style.id = 'ai-spinner-style'
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
        document.head.appendChild(style)
      }
      
      // 执行AI分析
      await this.performAiAnalysis()
    } else {
      // 隐藏面板 - 滑出到右侧
      this.aiPanel.style.right = '-450px'
    }
  }

  // 执行AI分析
  private async performAiAnalysis(): Promise<void> {
    if (!this.aiPanel) return

    try {
      // 获取K线数据
      const klineData: ServiceKLineData[] = this.currentKlineData.map(k => ({
        timestamp: k.timestamp,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume ?? 0
      }))

      // 如果没有K线数据，生成模拟数据
      const analysisData = klineData.length > 0 ? klineData : this.generateMockKlineData()

      const result = await aiAnalysisService.analyze({
        ticker: this.currentTicker,
        stockName: this.currentName,
        klineData: analysisData
      })

      this.renderAiResult(result)
    } catch (error) {
      console.error('AI分析失败:', error)
      if (this.aiPanel) {
        this.aiPanel.innerHTML = `
          <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
              <h3 style="margin: 0; font-size: 20px; color: #333;">🤖 AI 智能分析</h3>
              <button id="ai-close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px 10px; border-radius: 4px; transition: all 0.2s;">✕</button>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;">
              <p style="color: #ef5350; font-size: 16px; margin-bottom: 10px;">❌ 分析失败</p>
              <p style="color: #666; font-size: 14px;">请稍后重试</p>
            </div>
          </div>
        `
        // 添加关闭按钮事件
        const closeBtn = this.aiPanel.querySelector('#ai-close-btn')
        if (closeBtn) {
          closeBtn.onclick = () => this.toggleAiPanel()
          closeBtn.onmouseover = () => {
            ;(closeBtn as HTMLElement).style.background = '#f0f0f0'
            ;(closeBtn as HTMLElement).style.color = '#333'
          }
          closeBtn.onmouseout = () => {
            ;(closeBtn as HTMLElement).style.background = 'none'
            ;(closeBtn as HTMLElement).style.color = '#666'
          }
        }
      }
    }
  }

  // 渲染AI分析结果
  private renderAiResult(result: AIAnalysisResponse): void {
    if (!this.aiPanel) return

    const trendColor = result.trend === '上涨' ? '#ef5350' : result.trend === '下跌' ? '#26a69a' : '#ff9800'
    const recommendationColor = result.recommendation === '买入' ? '#ef5350' : 
                                result.recommendation === '卖出' ? '#26a69a' : '#ff9800'

    this.aiPanel.innerHTML = `
      <div style="padding: 20px; height: 100%; display: flex; flex-direction: column; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
          <h3 style="margin: 0; font-size: 20px; color: #333;">🤖 AI 智能分析</h3>
          <button id="ai-close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px 10px; border-radius: 4px; transition: all 0.2s;">✕</button>
        </div>
        
        <div style="flex: 1; overflow-y: auto;">
          <!-- 趋势和建议卡片 -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <span style="font-size: 24px; font-weight: bold;">${result.trend}</span>
              <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 14px;">信心指数: ${result.confidence}%</span>
            </div>
            <div style="font-size: 18px; opacity: 0.9;">
              操作建议: <span style="font-weight: bold; color: ${recommendationColor === '#ef5350' ? '#ffeb3b' : '#fff'};">${result.recommendation}</span>
            </div>
          </div>

          <!-- 技术指标 -->
          <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">📊 技术指标</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 6px;">
                <span style="color: #666;">MA5</span>
                <span style="font-weight: bold; color: #333;">${result.technicalIndicators.ma5.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 6px;">
                <span style="color: #666;">MA10</span>
                <span style="font-weight: bold; color: #333;">${result.technicalIndicators.ma10.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 6px;">
                <span style="color: #666;">MA20</span>
                <span style="font-weight: bold; color: #333;">${result.technicalIndicators.ma20.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 6px;">
                <span style="color: #666;">RSI</span>
                <span style="font-weight: bold; color: #333;">${result.technicalIndicators.rsi.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 6px;">
                <span style="color: #666;">MACD</span>
                <span style="font-weight: bold; color: #333;">${result.technicalIndicators.macd.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 6px;">
                <span style="color: #666;">布林上轨</span>
                <span style="font-weight: bold; color: #333;">${result.technicalIndicators.bollUpper.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 6px; grid-column: span 2;">
                <span style="color: #666;">布林下轨</span>
                <span style="font-weight: bold; color: #333;">${result.technicalIndicators.bollLower.toFixed(2)}</span>
              </div>
            </div>
          </div>

          ${result.support.length > 0 ? `
          <!-- 支撑位 -->
          <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">🎯 支撑位</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${result.support.map(s => `<span style="background: #e8f5e9; color: #2e7d32; padding: 6px 12px; border-radius: 6px; font-weight: bold;">${s.toFixed(2)}</span>`).join('')}
            </div>
          </div>
          ` : ''}

          ${result.resistance.length > 0 ? `
          <!-- 阻力位 -->
          <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">🚧 阻力位</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${result.resistance.map(r => `<span style="background: #ffebee; color: #c62828; padding: 6px 12px; border-radius: 6px; font-weight: bold;">${r.toFixed(2)}</span>`).join('')}
            </div>
          </div>
          ` : ''}

          <!-- 分析摘要 -->
          <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">📝 分析摘要</h4>
            <div style="color: #555; line-height: 1.6; font-size: 14px;">
              ${result.summary}
            </div>
          </div>

          <!-- 免责声明 -->
          <div style="background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px; padding: 12px; margin-top: 10px;">
            <p style="margin: 0; color: #e65100; font-size: 12px; line-height: 1.5;">
              ⚠️ 以上分析仅供参考，不构成投资建议。股市有风险，投资需谨慎。
            </p>
          </div>
        </div>
      </div>
    `
    
    // 添加关闭按钮事件
    const closeBtn = this.aiPanel.querySelector('#ai-close-btn')
    if (closeBtn) {
      closeBtn.onclick = () => this.toggleAiPanel()
      closeBtn.onmouseover = () => {
        ;(closeBtn as HTMLElement).style.background = '#f0f0f0'
        ;(closeBtn as HTMLElement).style.color = '#333'
      }
      closeBtn.onmouseout = () => {
        ;(closeBtn as HTMLElement).style.background = 'none'
        ;(closeBtn as HTMLElement).style.color = '#666'
      }
    }
  }

  // 生成模拟K线数据用于AI分析
  private generateMockKlineData(): ServiceKLineData[] {
    const data: ServiceKLineData[] = []
    const now = Date.now()
    let price = 100 + Math.random() * 100

    for (let i = 100; i >= 0; i--) {
      const timestamp = now - i * 24 * 60 * 60 * 1000
      const change = (Math.random() - 0.5) * 5
      const open = price
      const close = price + change
      const high = Math.max(open, close) + Math.random() * 2
      const low = Math.min(open, close) - Math.random() * 2
      const volume = Math.floor(Math.random() * 1000000) + 100000

      data.push({
        timestamp,
        open,
        close,
        high,
        low,
        volume
      })

      price = close
    }

    return data
  }

  private initChartPro(container: HTMLElement, options: StockFullScreenOptions) {
    // 创建统一数据源（会根据 datafeedService 的当前类型自动切换）
    this.datafeed = new UnifiedDatafeed()

    // 配置 KLineChartPro 选项
    const chartOptions: ChartProOptions = {
      container: container,
      symbol: {
        ticker: options.ticker,
        name: options.name,
        exchange: 'MOCK',
        type: 'Stock',
        pricePrecision: 2,
        volumePrecision: 0,
        priceCurrency: 'USD'
      },
      period: {
        multiplier: 1,
        timespan: 'd',
        text: '1D'
      },
      periods: [
        { multiplier: 1, timespan: 'm', text: '1m' },
        { multiplier: 5, timespan: 'm', text: '5m' },
        { multiplier: 15, timespan: 'm', text: '15m' },
        { multiplier: 30, timespan: 'm', text: '30m' },
        { multiplier: 1, timespan: 'h', text: '1h' },
        { multiplier: 4, timespan: 'h', text: '4h' },
        { multiplier: 1, timespan: 'd', text: '1D' }
      ],
      datafeed: this.datafeed,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: 'zh-CN',
      theme: 'light',
      mainIndicators: ['MA', 'EMA'],
      subIndicators: ['VOL', 'MACD']
    }

    // 创建 KLineChartPro 实例
    this.chart = new KLineChartPro(chartOptions)
  }

  close() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
      this.overlay = null
    }
    if (this.chart) {
      this.chart = null
    }
    // 移除AI面板
    if (this.aiPanel && this.aiPanel.parentNode) {
      this.aiPanel.parentNode.removeChild(this.aiPanel)
      this.aiPanel = null
    }
    this.isAiPanelVisible = false
  }

  dispose() {
    this.close()
  }
}