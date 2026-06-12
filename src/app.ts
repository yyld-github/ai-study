import { ChatComponent, ChatMessage, AnalysisResult } from './components/ChatComponent'
import { StockMiniChart } from './components/StockMiniChart'
import { StockFullScreen } from './components/StockFullScreen'
import { MockDatafeed } from './mockDatafeed'

export default function setupApp(root: HTMLDivElement) {
  let locale = 'zh-CN'
  if (window.location.hash.endsWith('#en-US')) {
    locale = 'en-US'
  }

  // 创建应用界面
  root.innerHTML = `
    <div class="announcement-bar">
      <svg viewBox="0 0 1024 1024" width="16" height="16">
        <path d="M512 184c44.3 0 87.3 8.7 127.6 25.7 39 16.5 74.1 40.2 104.3 70.3 30.2 30.2 53.8 65.3 70.3 104.3C831.3 424.7 840 467.7 840 512s-8.7 87.3-25.7 127.6c-16.5 39-40.2 74.1-70.3 104.3-30.2 30.2-65.3 53.8-104.3 70.3C599.3 831.3 556.3 840 512 840s-87.3-8.7-127.6-25.7c-39-16.5-74.1-40.2-104.3-70.3-30.2-30.2-53.8-65.3-70.3-104.3C192.7 599.3 184 556.3 184 512s8.7-87.3 25.7-127.6c16.5-39 40.2-74.1 70.3-104.3s65.3-53.8 104.3-70.3C424.7 192.7 467.7 184 512 184m0-120C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z" fill="#006EFF"/>
        <path d="M452 464.5h120v300H452z" fill="#006EFF"/>
        <path d="M512 323.3m-60 0a60 60 0 1 0 120 0 60 60 0 1 0-120 0Z" fill="#006EFF"/>
      </svg>
      ${locale === 'zh-CN' ? '股票行情查询系统' : 'Stock Quote Query System'}
    </div>
    <div id="app-container">
      <div id="chat-container"></div>
      <div id="full-screen-container"></div>
    </div>
  `

  // 初始化聊天组件
  const chatComponent = new ChatComponent()
  const chatContainer = document.getElementById('chat-container')!
  chatComponent.render(chatContainer)

  // 监听全屏事件
  document.addEventListener('fullscreen-open', (e: any) => {
    const { stockName } = e.detail
    const stockData = generateStockData(stockName)
    openFullScreen(stockData)
  })

  document.addEventListener('fullscreen-close', () => {
    const fullScreenContainer = document.getElementById('full-screen-container')!
    fullScreenContainer.innerHTML = ''
  })

  // 处理用户发送的消息
  chatComponent.setOnSendMessage((message: string) => {
    // 先添加用户消息到聊天界面
    chatComponent.addUserMessage(message)
    
    const ticker = extractTicker(message)
    
    if (!ticker) {
      chatComponent.addMessage('assistant', locale === 'zh-CN' 
        ? '请输入股票代码，例如："查询 BABA" 或 "AAPL 行情"'
        : 'Please enter a stock ticker, e.g., "query BABA" or "AAPL quote"')
      return
    }

    // 生成模拟股票数据
    const stockData = generateStockData(ticker)
    
    // 生成模拟分析结果
    const analysisResult = ChatComponent.generateMockAnalysis()

    // 添加助手回复消息（使用新的 API，支持 K 线图预览和 AI 分析）
    const replyContent = locale === 'zh-CN'
      ? `以下是 **${stockData.name} (${stockData.ticker})** 的行情信息`
      : `Here is the quote for **${stockData.name} (${stockData.ticker})**`

    chatComponent.addAssistantMessage(
      replyContent,
      analysisResult,
      stockData.ticker,
      true, // showActions
      (container: HTMLElement) => {
        // onPreviewReady 回调：渲染迷你 K 线图
        const miniChart = new StockMiniChart()
        miniChart.render(container, {
          ticker: stockData.ticker,
          name: stockData.name,
          price: stockData.price,
          change: stockData.change,
          changePercent: stockData.changePercent,
          onDoubleClick: () => {
            document.dispatchEvent(new CustomEvent('fullscreen-open', {
              detail: { stockName: stockData.ticker, analysisResult }
            }))
          }
        })
      }
    )
  })

  // 打开全屏 K 线图
  function openFullScreen(stockData: any) {
    const fullScreenContainer = document.getElementById('full-screen-container')!
    const fullScreen = new StockFullScreen()
    fullScreen.render(fullScreenContainer, {
      ticker: stockData.ticker,
      name: stockData.name,
      price: stockData.price,
      change: stockData.change,
      changePercent: stockData.changePercent,
      onClose: () => {
        fullScreen.close()
        document.dispatchEvent(new CustomEvent('fullscreen-close'))
      }
    })
  }
}

// 从消息中提取股票代码
function extractTicker(message: string): string | null {
  // 尝试匹配大写的股票代码（2-5 个字母）
  const tickerMatch = message.toUpperCase().match(/\b[A-Z]{2,5}\b/)
  if (tickerMatch) {
    return tickerMatch[0]
  }
  return null
}

// 生成模拟股票数据
function generateStockData(ticker: string) {
  const stockNames: Record<string, string> = {
    'BABA': 'Alibaba Group Holding Limited',
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet Inc.',
    'AMZN': 'Amazon.com Inc.',
    'TSLA': 'Tesla Inc.',
    'MSFT': 'Microsoft Corporation',
    'META': 'Meta Platforms Inc.',
    'NVDA': 'NVIDIA Corporation',
    'JPM': 'JPMorgan Chase & Co.',
    'V': 'Visa Inc.'
  }

  const name = stockNames[ticker] || `${ticker} Corporation`
  const basePrice = Math.random() * 200 + 50
  const change = (Math.random() - 0.5) * 10
  const changePercent = (change / basePrice) * 100

  return {
    ticker,
    name,
    price: Math.round(basePrice * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100
  }
}