import { ChatComponent, ChatMessage, AnalysisResult } from './components/ChatComponent'
import { StockMiniChart } from './components/StockMiniChart'
import { StockFullScreen } from './components/StockFullScreen'
import { DatafeedSwitcher } from './components/DatafeedSwitcher'
import { datafeedService, getTickerByName } from './services/datafeedService'
import { aiAnalysisService } from './services/aiAnalysisService'
import { KLineData, RealtimeQuote, DatafeedType } from './services/types'

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
      <div id="datafeed-switcher-container" class="datafeed-switcher-container"></div>
      <div id="chat-container"></div>
      <div id="full-screen-container"></div>
    </div>
  `

  // 初始化行情源切换组件
  const datafeedSwitcher = new DatafeedSwitcher()
  const switcherContainer = document.getElementById('datafeed-switcher-container')!
  datafeedSwitcher.render(switcherContainer)
  
  // 监听数据源切换事件，在聊天界面显示提示
  datafeedService.onSwitch((type: DatafeedType) => {
    const datafeedLabel = type === 'mock' 
      ? (locale === 'zh-CN' ? '🎲 模拟数据' : '🎲 Mock Data')
      : (locale === 'zh-CN' ? '📈 AKShare真实数据' : '📈 AKShare Real Data')
    console.log(`[App] 数据源已切换到: ${datafeedLabel}`)
  })

  // 初始化聊天组件
  const chatComponent = new ChatComponent()
  const chatContainer = document.getElementById('chat-container')!
  chatComponent.render(chatContainer)

  // 监听全屏事件
  document.addEventListener('fullscreen-open', (e: any) => {
    const { stockName, klineData } = e.detail
    const stockData = generateStockData(stockName)
    openFullScreen(stockData, klineData)
  })

  document.addEventListener('fullscreen-close', () => {
    const fullScreenContainer = document.getElementById('full-screen-container')!
    fullScreenContainer.innerHTML = ''
  })

  // 处理用户发送的消息
  chatComponent.setOnSendMessage(async (message: string) => {
    // 先添加用户消息到聊天界面
    chatComponent.addUserMessage(message)
    
    const ticker = extractTicker(message)
    
    if (!ticker) {
      chatComponent.addMessage('assistant', locale === 'zh-CN' 
        ? '请输入股票代码，例如："查询 BABA" 或 "AAPL 行情" 或 "600519"（A股）'
        : 'Please enter a stock ticker, e.g., "query BABA" or "AAPL quote" or "600519" (A-share)')
      return
    }

    // 显示加载状态
    const typingIndicator = chatComponent.showTypingIndicator()

    try {
      // 使用行情源服务获取数据
      const [stockQuote, klineData] = await Promise.all([
        datafeedService.getRealtimeQuote(ticker),
        datafeedService.getKLines(ticker, '1d', 100)
      ])

      // 移除加载状态
      chatComponent.removeTypingIndicator(typingIndicator)

      if (!stockQuote) {
        chatComponent.addMessage('assistant', locale === 'zh-CN' 
          ? `未能获取 ${ticker} 的行情数据，请检查股票代码是否正确`
          : `Failed to get quote for ${ticker}, please check the ticker`)
        return
      }

      // 使用AI分析服务进行分析
      const aiResult = await aiAnalysisService.analyze({
        ticker: stockQuote.ticker,
        stockName: stockQuote.name,
        klineData: klineData
      })

      // 转换为AnalysisResult格式
      const analysisResult: AnalysisResult = {
        trend: aiResult.trend === '上涨' ? 'uptrend' : aiResult.trend === '下跌' ? 'downtrend' : 'sideways',
        trendStrength: aiResult.confidence / 100,
        priceChannels: Math.floor(Math.random() * 3) + 1,
        supportLevels: aiResult.support.length,
        resistanceLevels: aiResult.resistance.length,
        patterns: Math.floor(Math.random() * 5) + 1
      }

      // 获取当前数据源类型
      const currentDatafeed = datafeedService.getCurrentType()
      const datafeedLabel = currentDatafeed === 'mock' 
        ? (locale === 'zh-CN' ? '🎲 模拟数据' : '🎲 Mock Data')
        : (locale === 'zh-CN' ? '📈 AKShare真实数据' : '📈 AKShare Real Data')
      
      // 添加助手回复消息
      const replyContent = locale === 'zh-CN'
        ? `以下是 **${stockQuote.name} (${stockQuote.ticker})** 的行情信息\n\n当前数据源: ${datafeedLabel}`
        : `Here is the quote for **${stockQuote.name} (${stockQuote.ticker})**\n\nCurrent data source: ${datafeedLabel}`

      chatComponent.addAssistantMessage(
        replyContent,
        analysisResult,
        stockQuote.ticker,
        true, // showActions
        (container: HTMLElement) => {
          // onPreviewReady 回调：渲染迷你 K 线图
          const miniChart = new StockMiniChart()
          miniChart.render(container, {
            ticker: stockQuote.ticker,
            name: stockQuote.name,
            price: stockQuote.price,
            change: stockQuote.change,
            changePercent: stockQuote.changePercent,
            klineData: klineData,
            onDoubleClick: () => {
              document.dispatchEvent(new CustomEvent('fullscreen-open', {
                detail: { stockName: stockQuote.ticker, analysisResult, klineData }
              }))
            }
          })
        }
      )
    } catch (error) {
      console.error('获取行情数据失败:', error)
      chatComponent.removeTypingIndicator(typingIndicator)
      chatComponent.addMessage('assistant', locale === 'zh-CN' 
        ? `获取 ${ticker} 行情数据失败，请稍后重试`
        : `Failed to get quote for ${ticker}, please try again later`)
    }
  })

  // 打开全屏 K 线图
  function openFullScreen(stockData: any, klineData?: KLineData[]) {
    const fullScreenContainer = document.getElementById('full-screen-container')!
    const fullScreen = new StockFullScreen()
    fullScreen.render(fullScreenContainer, {
      ticker: stockData.ticker,
      name: stockData.name,
      price: stockData.price,
      change: stockData.change,
      changePercent: stockData.changePercent,
      klineData: klineData,
      onClose: () => {
        fullScreen.close()
        document.dispatchEvent(new CustomEvent('fullscreen-close'))
      }
    })
  }
}

// 从消息中提取股票代码
function extractTicker(message: string): string | null {
  // 清理消息，移除常见的中文关键词
  const cleaned = message
    .replace(/[查询|查一下|帮我查|行情|股票|分析|一下|请|麻烦|的|吗|呢|吧|啊|哦|嗯|哈|嘿|嗨|您好|你好]/g, '')
    .trim()
  
  // 1. 优先尝试匹配A股代码（6位数字）
  const aStockMatch = cleaned.match(/\b(\d{6})\b/)
  if (aStockMatch) {
    return aStockMatch[1]
  }
  
  // 2. 尝试匹配美股/港股股票代码（1-10个字母，支持大小写）
  const usStockMatch = cleaned.match(/\b([A-Za-z]{1,10})\b/)
  if (usStockMatch) {
    return usStockMatch[1].toUpperCase()
  }
  
  // 3. 尝试匹配带交易所后缀的代码，如 BABA:NYSE, AAPL.NASDAQ
  const exchangeMatch = cleaned.match(/\b([A-Za-z]{1,10}[:\.][A-Z]{2,4})\b/)
  if (exchangeMatch) {
    return exchangeMatch[1].split(/[.:]/)[0].toUpperCase()
  }
  
  // 4. 尝试通过中文名称匹配股票代码（如"茅台"、"阿里巴巴"、"苹果"等）
  // 提取中文字符
  const chineseMatch = cleaned.match(/[\u4e00-\u9fa5]+/g)
  if (chineseMatch && chineseMatch.length > 0) {
    // 合并所有中文字符
    const chineseText = chineseMatch.join('')
    const ticker = getTickerByName(chineseText)
    if (ticker) {
      return ticker
    }
  }
  
  // 5. 尝试通过英文名称匹配股票代码（如"Apple"、"Alibaba"、"Tesla"等）
  const englishMatch = cleaned.match(/[A-Za-z]+/g)
  if (englishMatch && englishMatch.length > 0) {
    // 尝试每个英文单词
    for (const word of englishMatch) {
      if (word.length >= 2) { // 至少2个字母
        const ticker = getTickerByName(word)
        if (ticker) {
          return ticker
        }
      }
    }
  }
  
  // 6. 如果清理后的消息只包含一个单词，直接返回（可能是股票代码）
  const words = cleaned.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 1 && /^[A-Za-z0-9]+$/.test(words[0])) {
    return words[0].toUpperCase()
  }
  
  return null
}

// 生成股票数据（兼容旧接口）
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
    'V': 'Visa Inc.',
    '600519': '贵州茅台',
    '000858': '五粮液',
    '601318': '中国平安',
    '000333': '美的集团',
    '600036': '招商银行',
    '002594': '比亚迪',
  }

  const name = stockNames[ticker] || `${ticker} Corporation`
  const basePrice = /^\d{6}$/.test(ticker) ? 50 + Math.random() * 100 : 100 + Math.random() * 200
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