import { init, type KLineData } from 'klinecharts'

export interface StockMiniChartOptions {
  ticker: string
  name: string
  price: number
  change?: number
  changePercent?: number
  klineData?: KLineData[]
  onDoubleClick?: () => void
}

export class StockMiniChart {
  private chart: any = null
  private onDoubleClickCallback: (() => void) | null = null

  render(container: HTMLElement, options: StockMiniChartOptions) {
    container.innerHTML = ''
    container.className = 'stock-mini-chart'

    // 保存回调
    this.onDoubleClickCallback = options.onDoubleClick || null

    // 创建股票信息头
    const headerDiv = document.createElement('div')
    headerDiv.className = 'stock-mini-header'
    headerDiv.innerHTML = `
      <div class="stock-ticker">${options.ticker}</div>
      <div class="stock-name">${options.name}</div>
      <div class="stock-price">
        <span class="price-value">${options.price.toFixed(2)}</span>
        ${options.change !== undefined ? `
          <span class="price-change ${options.change >= 0 ? 'positive' : 'negative'}">
            ${options.change >= 0 ? '+' : ''}${options.change.toFixed(2)} 
            (${options.changePercent !== undefined ? (options.changePercent >= 0 ? '+' : '') + options.changePercent.toFixed(2) + '%' : ''})
          </span>
        ` : ''}
      </div>
    `
    container.appendChild(headerDiv)

    // 创建图表容器
    const chartWrapper = document.createElement('div')
    chartWrapper.className = 'stock-mini-chart-wrapper'
    chartWrapper.style.height = '200px'
    chartWrapper.style.width = '100%'
    container.appendChild(chartWrapper)

    // 初始化图表
    const klineData = options.klineData || this.generateMockData()
    this.initChart(chartWrapper, klineData)

    // 图表初始化后，绑定双击事件到整个迷你图表容器
    // 使用 setTimeout 确保 KLineChart 完全初始化后再绑定事件
    // 使用事件捕获阶段（true）确保在 KLineChart 内部事件之前触发
    setTimeout(() => {
      // 为整个容器添加双击事件
      container.addEventListener('dblclick', (e: MouseEvent) => {
        console.log('[StockMiniChart] 双击事件触发 - container')
        e.stopPropagation()
        e.preventDefault()
        if (this.onDoubleClickCallback) {
          console.log('[StockMiniChart] 调用 onDoubleClickCallback')
          this.onDoubleClickCallback()
        }
      }, { capture: true })

      // 同时为图表 wrapper 添加双击事件（确保点击图表区域也能触发）
      chartWrapper.addEventListener('dblclick', (e: MouseEvent) => {
        console.log('[StockMiniChart] 双击事件触发 - chartWrapper')
        e.stopPropagation()
        e.preventDefault()
        if (this.onDoubleClickCallback) {
          console.log('[StockMiniChart] 调用 onDoubleClickCallback')
          this.onDoubleClickCallback()
        }
      }, { capture: true })
    }, 100)
  }

  private initChart(container: HTMLElement, klineData: KLineData[]) {
    if (this.chart) {
      this.chart.dispose()
    }

    // 使用 klinecharts 的正确 API 初始化图表
    this.chart = init(container)
    if (this.chart) {
      // 直接设置数据，不需要 setSymbol 和 setPeriod
      this.chart.applyNewData(klineData)
    }

    // 自适应大小
    window.addEventListener('resize', () => {
      if (this.chart) {
        this.chart.resize()
      }
    })
  }

  private generateMockData(): KLineData[] {
    const data: KLineData[] = []
    const now = Date.now()
    let price = 100 + Math.random() * 100

    for (let i = 50; i >= 0; i--) {
      const timestamp = now - i * 60000 // 每分钟一个数据点
      const change = (Math.random() - 0.5) * 5
      const open = price
      const close = price + change
      const high = Math.max(open, close) + Math.random() * 2
      const low = Math.min(open, close) - Math.random() * 2
      const volume = Math.floor(Math.random() * 10000) + 1000

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

  dispose() {
    if (this.chart) {
      try {
        this.chart.dispose()
      } catch (e) {
        console.warn('Chart dispose error:', e)
      }
      this.chart = null
    }
  }
}