import { KLineChartPro, ChartProOptions, SymbolInfo, Period, Datafeed } from '@klinecharts/pro'
import { KLineData } from 'klinecharts'

export interface StockFullScreenOptions {
  ticker: string
  name: string
  price: number
  change?: number
  changePercent?: number
  klineData?: KLineData[]
  onClose?: () => void
}

// 模拟数据源 - 实现 Datafeed 接口
class MockDatafeed implements Datafeed {
  private basePrice: number = 150

  searchSymbols(search?: string): Promise<SymbolInfo[]> {
    const mockStocks: SymbolInfo[] = [
      { ticker: 'BABA', name: 'Alibaba Group', exchange: 'NYSE' },
      { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
      { ticker: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
      { ticker: 'META', name: 'Meta Platforms', exchange: 'NASDAQ' },
      { ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' }
    ]

    if (!search) return Promise.resolve(mockStocks)

    return Promise.resolve(mockStocks.filter(stock =>
      stock.ticker.toLowerCase().includes(search.toLowerCase()) ||
      stock.name?.toLowerCase().includes(search.toLowerCase())
    ))
  }

  async getHistoryKLineData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]> {
    const klines: KLineData[] = []
    const now = Date.now()
    let price = this.basePrice

    // 根据周期计算时间间隔
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

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    return klines
  }

  subscribe(symbol: SymbolInfo, period: Period, callback: (data: KLineData) => void): void {
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
}

export class StockFullScreen {
  private chart: KLineChartPro | null = null
  private overlay: HTMLElement | null = null
  private onCloseCallback: (() => void) | null = null
  private datafeed: Datafeed | null = null

  render(container: HTMLElement, options: StockFullScreenOptions) {
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

    headerDiv.appendChild(stockInfoDiv)
    headerDiv.appendChild(closeBtn)
    this.overlay.appendChild(headerDiv)

    // 创建图表容器 - 使用 KLineChartPro 官方组件
    const chartContainer = document.createElement('div')
    chartContainer.id = 'klinechart-pro-container'
    chartContainer.style.cssText = `
      flex: 1;
      width: 100%;
      position: relative;
    `
    this.overlay.appendChild(chartContainer)

    // 添加到页面
    container.appendChild(this.overlay)

    // 初始化 KLineChartPro 官方组件
    this.initChartPro(chartContainer, options)

    // 保存回调
    this.onCloseCallback = options.onClose || null

    // ESC 键关闭
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close()
        if (this.onCloseCallback) {
          this.onCloseCallback()
        }
        document.removeEventListener('keydown', handleEsc)
      }
    }
    document.addEventListener('keydown', handleEsc)
  }

  private initChartPro(container: HTMLElement, options: StockFullScreenOptions) {
    // 创建模拟数据源
    this.datafeed = new MockDatafeed()

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

    // 创建 KLineChartPro 实例 - 使用官方组件
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
  }

  dispose() {
    this.close()
  }
}
