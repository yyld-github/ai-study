/**
 * 聊天对话框组件
 * 参考 E:\vue-ai\KLineChart-main\debug 实现
 * 支持用户输入股票查询，显示对话历史、AI 分析结果、K 线图预览
 */

// AI 分析结果接口
export interface AnalysisResult {
  trend: 'uptrend' | 'downtrend' | 'sideways'
  trendStrength: number
  priceChannels: number
  supportLevels: number
  resistanceLevels: number
  patterns: number
  signals?: number
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  stockData?: any
  analysisResult?: AnalysisResult
}

export class ChatComponent {
  private messages: ChatMessage[] = []
  private container: HTMLElement | null = null
  private messagesContainer: HTMLElement | null = null
  private input: HTMLInputElement | null = null
  private sendBtn: HTMLButtonElement | null = null
  private onSendMessage: ((message: string) => void) | null = null
  private searchHistory: string[] = []
  private isSidebarVisible: boolean = true
  private welcomeVisible: boolean = true

  constructor() {
    // 加载搜索历史
    this.searchHistory = JSON.parse(localStorage.getItem('stockSearchHistory') || '[]')
    
    // 初始欢迎消息
    this.messages = [
      {
        id: 'welcome',
        type: 'assistant',
        content: '你好！我是智能股票分析助手。请输入股票代码或名称查询行情，例如："BABA"、"AAPL"、"阿里巴巴"、"苹果"等。',
        timestamp: new Date()
      }
    ]
  }

  // 设置消息发送回调
  setOnSendMessage(callback: (message: string) => void) {
    this.onSendMessage = callback
  }

  // 添加用户消息
  addUserMessage(content: string) {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    }
    this.messages.push(message)
    this.renderMessage(message)
    this.scrollToBottom()
    
    // 隐藏欢迎消息
    if (this.welcomeVisible) {
      const welcomeMsg = this.container?.querySelector('.welcome-message')
      if (welcomeMsg) {
        welcomeMsg.classList.add('hidden')
        this.welcomeVisible = false
      }
    }
    
    // 隐藏搜索历史（如果需要）
    // if (this.isSidebarVisible) {
    //   this.toggleSidebar()
    // }
  }

  // 添加助手消息（支持 K 线图预览和 AI 分析）
  addAssistantMessage(
    content: string,
    analysisResult: AnalysisResult,
    stockName: string,
    showActions: boolean = false,
    onPreviewReady?: (container: HTMLElement) => void
  ) {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type: 'assistant',
      content,
      timestamp: new Date(),
      analysisResult
    }
    this.messages.push(message)
    
    // 创建消息 DOM
    const messagesContainer = this.messagesContainer
    if (!messagesContainer) return
    
    const messageDiv = document.createElement('div')
    messageDiv.className = 'message assistant'
    
    // 解析 markdown 格式的粗体
    const formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    const previewId = 'preview-' + Date.now()
    
    messageDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div>${formattedContent}</div>
        
        <!-- 行情简图预览 -->
        <div class="chart-preview" id="${previewId}">
          <div class="chart-preview-label">双击查看完整行情图</div>
          <div class="chart-preview-container"></div>
          ${showActions ? `
          <div class="chart-actions">
            <button class="chart-action-btn" data-action="fullscreen">🔍 全屏查看</button>
            <button class="chart-action-btn" data-action="copy">📋 复制分析</button>
          </div>
          ` : ''}
        </div>
        
        <!-- AI 分析结果 -->
        <div class="ai-analysis-result">
          <h4>AI 分析结果</h4>
          <div class="analysis-grid">
            <div class="analysis-badge">
              <span class="analysis-badge-label">趋势</span>
              <span class="analysis-badge-value ${analysisResult.trend === 'uptrend' ? 'uptrend' : analysisResult.trend === 'downtrend' ? 'downtrend' : ''}">
                ${this.getTrendDescription(analysisResult.trend)}
              </span>
            </div>
            <div class="analysis-badge">
              <span class="analysis-badge-label">趋势强度</span>
              <span class="analysis-badge-value">${(analysisResult.trendStrength * 100).toFixed(1)}%</span>
            </div>
            <div class="analysis-badge">
              <span class="analysis-badge-label">价格通道</span>
              <span class="analysis-badge-value">${analysisResult.priceChannels} 个</span>
            </div>
            <div class="analysis-badge">
              <span class="analysis-badge-label">支撑位</span>
              <span class="analysis-badge-value">${analysisResult.supportLevels} 个</span>
            </div>
            <div class="analysis-badge">
              <span class="analysis-badge-label">阻力位</span>
              <span class="analysis-badge-value">${analysisResult.resistanceLevels} 个</span>
            </div>
            <div class="analysis-badge">
              <span class="analysis-badge-label">形态识别</span>
              <span class="analysis-badge-value">${analysisResult.patterns} 个</span>
            </div>
          </div>
        </div>
      </div>
    `
    
    messagesContainer.appendChild(messageDiv)
    
    // 初始化预览图表
    const previewContainer = messageDiv.querySelector(`#${previewId}`)
    const chartContainer = previewContainer?.querySelector('.chart-preview-container')
    if (chartContainer && onPreviewReady) {
      onPreviewReady(chartContainer as HTMLElement)
      // 图表渲染完成后，使用 requestAnimationFrame 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        this.scrollToBottom()
      })
    } else {
      this.scrollToBottom()
    }
    
    // 双击事件已在 StockMiniChart 组件内部处理，此处不再重复绑定
    // StockMiniChart 的 onDoubleClickCallback 会在 app.ts 中设置
    
    // 绑定按钮事件
    const actionBtns = messageDiv.querySelectorAll('.chart-action-btn')
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action
        if (action === 'fullscreen') {
          document.dispatchEvent(new CustomEvent('fullscreen-open', {
            detail: { stockName, analysisResult }
          }))
        } else if (action === 'copy') {
          this.copyAnalysisResult(stockName, analysisResult)
        }
      })
    })
  }

  // 添加普通消息（用于错误提示等）
  addMessage(type: 'user' | 'assistant', content: string, stockData?: any) {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      stockData
    }
    this.messages.push(message)
    this.renderMessage(message)
    this.scrollToBottom()
  }

  // 渲染单条消息
  private renderMessage(message: ChatMessage) {
    if (!this.messagesContainer) return
    
    const messageDiv = document.createElement('div')
    messageDiv.className = `message ${message.type}`
    
    if (message.type === 'user') {
      messageDiv.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-content">${this.escapeHtml(message.content)}</div>
      `
    } else if (!message.analysisResult) {
      // 普通助手消息（不带 AI 分析）
      messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">${message.content}</div>
      `
    }
    // 带 AI 分析的消息已在 addAssistantMessage 中处理
    
    if (message.type === 'user' || !message.analysisResult) {
      this.messagesContainer.appendChild(messageDiv)
    }
  }

  // 显示打字指示器
  showTypingIndicator(): HTMLElement {
    const messagesContainer = this.messagesContainer
    if (!messagesContainer) return document.createElement('div')
    
    const typingDiv = document.createElement('div')
    typingDiv.className = 'message assistant typing'
    typingDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `
    
    messagesContainer.appendChild(typingDiv)
    this.scrollToBottom()
    return typingDiv
  }

  // 移除打字指示器
  removeTypingIndicator(typingDiv: HTMLElement) {
    if (typingDiv.parentNode) {
      typingDiv.parentNode.removeChild(typingDiv)
    }
  }

  // 保存到搜索历史
  private saveToSearchHistory(stockName: string) {
    // 移除重复项
    this.searchHistory = this.searchHistory.filter(item => item !== stockName)
    // 添加到开头
    this.searchHistory.unshift(stockName)
    // 限制最多 10 条
    if (this.searchHistory.length > 10) {
      this.searchHistory.pop()
    }
    // 保存到 localStorage
    localStorage.setItem('stockSearchHistory', JSON.stringify(this.searchHistory))
    // 更新搜索历史面板
    this.renderSearchHistory()
  }

  // 加载搜索历史
  private loadSearchHistory() {
    this.searchHistory = JSON.parse(localStorage.getItem('stockSearchHistory') || '[]')
    this.renderSearchHistory()
  }

  // 清除搜索历史
  clearSearchHistory() {
    this.searchHistory = []
    localStorage.removeItem('stockSearchHistory')
    this.renderSearchHistory()
  }

  // 切换侧边栏显示
  toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible
    const sidebar = this.container?.querySelector('.sidebar')
    if (sidebar) {
      if (this.isSidebarVisible) {
        sidebar.classList.add('visible')
        this.renderSearchHistory()
      } else {
        sidebar.classList.remove('visible')
      }
    }
  }

  // 渲染搜索历史
  private renderSearchHistory() {
    const historyList = this.container?.querySelector('.search-history-list')
    if (!historyList) return
    
    if (this.searchHistory.length === 0) {
      historyList.innerHTML = '<div class="search-history-empty">暂无搜索历史</div>'
      return
    }
    
    historyList.innerHTML = this.searchHistory.map(item => `
      <div class="search-history-item" data-stock="${this.escapeHtml(item)}">
        <span class="search-history-icon">📈</span>
        <span class="search-history-text">${this.escapeHtml(item)}</span>
      </div>
    `).join('')
    
    // 绑定点击事件
    const items = historyList.querySelectorAll('.search-history-item')
    items.forEach(item => {
      item.addEventListener('click', () => {
        const stockName = (item as HTMLElement).dataset.stock
        if (stockName && this.onSendMessage) {
          this.onSendMessage(stockName)
          if (this.input) {
            this.input.value = ''
          }
        }
      })
    })
  }

  // 复制分析结果
  private copyAnalysisResult(stockName: string, analysisResult: AnalysisResult) {
    const text = `【${stockName}】AI 分析报告
趋势：${this.getTrendDescription(analysisResult.trend)}
趋势强度：${(analysisResult.trendStrength * 100).toFixed(1)}%
价格通道：${analysisResult.priceChannels} 个
支撑位：${analysisResult.supportLevels} 个
阻力位：${analysisResult.resistanceLevels} 个
形态识别：${analysisResult.patterns} 个`
    
    navigator.clipboard.writeText(text).then(() => {
      // 显示复制成功提示
      const toast = document.createElement('div')
      toast.className = 'copy-toast'
      toast.textContent = '✓ 已复制到剪贴板'
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.remove()
      }, 2000)
    })
  }

  // 获取趋势描述
  private getTrendDescription(trend: 'uptrend' | 'downtrend' | 'sideways'): string {
    const descriptions = {
      uptrend: '上涨趋势',
      downtrend: '下跌趋势',
      sideways: '震荡整理'
    }
    return descriptions[trend]
  }

  // HTML 转义
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // 滚动到底部
  private scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
    }
  }

  // 渲染组件
  render(container: HTMLElement) {
    this.container = container
    container.innerHTML = `
      <div class="chat-container">
        <!-- 左侧可收缩侧边栏 -->
        <div class="sidebar${this.isSidebarVisible ? ' visible' : ''}">
          <div class="sidebar-header">
            <h3>📚 搜索历史</h3>
            <button class="sidebar-toggle" id="toggle-sidebar" title="${this.isSidebarVisible ? '收起侧边栏' : '展开侧边栏'}">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z"/>
              </svg>
            </button>
          </div>
          <div class="sidebar-content">
            <div class="search-history-list"></div>
            <button class="clear-history-btn" id="clear-history">清除历史</button>
          </div>
        </div>
        
        <!-- 主聊天区域 -->
        <div class="chat-main">
          <!-- 聊天头部 -->
          <div class="chat-header">
            <button class="sidebar-expand-btn" id="expand-sidebar" title="展开侧边栏" style="display: ${this.isSidebarVisible ? 'none' : 'flex'}">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            <h2>📈 智能股票分析助手</h2>
            <div class="header-actions">
              <button class="header-btn" id="clear-chat" title="清空对话">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- 聊天消息区域 -->
          <div class="chat-messages" id="chat-messages">
            <!-- 欢迎消息 -->
            <div class="welcome-message">
              <div class="welcome-icon">👋</div>
              <h3>欢迎使用智能股票分析助手</h3>
              <p>输入股票代码或名称，获取实时行情和 AI 分析</p>
              <div class="quick-actions">
                <button class="quick-action-btn" data-stock="BABA">阿里巴巴</button>
                <button class="quick-action-btn" data-stock="AAPL">苹果</button>
                <button class="quick-action-btn" data-stock="TSLA">特斯拉</button>
                <button class="quick-action-btn" data-stock="NVDA">英伟达</button>
              </div>
            </div>
          </div>
          
          <!-- 输入区域 -->
          <div class="chat-input-area">
            <div class="input-wrapper">
              <input 
                type="text" 
                id="chat-input"
                class="chat-input"
                placeholder="输入股票代码或名称，例如：BABA、AAPL..."
                autocomplete="off"
              />
              <button id="send-button" class="send-button">
                <span>发送</span>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `

    this.messagesContainer = container.querySelector('#chat-messages')
    this.input = container.querySelector('#chat-input')
    this.sendBtn = container.querySelector('#send-button')

    // 绑定事件
    this.bindEvents()
    
    // 初始渲染消息
    this.renderMessages()
    
    // 加载搜索历史
    this.loadSearchHistory()
  }

  // 初始渲染所有消息
  private renderMessages() {
    if (!this.messagesContainer) return
    this.messagesContainer.innerHTML = ''
    this.messages.forEach(msg => this.renderMessage(msg))
  }

  // 绑定事件
  private bindEvents() {
    if (!this.sendBtn || !this.input) return

    // 点击发送按钮
    this.sendBtn.addEventListener('click', () => {
      this.handleSend()
    })

    // 回车发送
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSend()
      }
    })
    
    // 侧边栏切换
    const toggleSidebarBtn = this.container?.querySelector('#toggle-sidebar')
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', () => {
        this.toggleSidebar()
        const expandBtn = this.container?.querySelector('#expand-sidebar')
        if (expandBtn) {
          expandBtn.style.display = this.isSidebarVisible ? 'none' : 'flex'
        }
      })
    }
    
    // 侧边栏展开按钮
    const expandSidebarBtn = this.container?.querySelector('#expand-sidebar')
    if (expandSidebarBtn) {
      expandSidebarBtn.addEventListener('click', () => {
        this.toggleSidebar()
        expandSidebarBtn.style.display = this.isSidebarVisible ? 'none' : 'flex'
      })
    }
    
    // 清空对话
    const clearChatBtn = this.container?.querySelector('#clear-chat')
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        this.messages = [this.messages[0]] // 保留欢迎消息
        if (this.messagesContainer) {
          this.messagesContainer.innerHTML = ''
          this.renderMessage(this.messages[0])
        }
      })
    }
    
    // 清除搜索历史
    const clearHistoryBtn = this.container?.querySelector('#clear-history')
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.clearSearchHistory()
      })
    }
    
    // 快捷操作按钮
    const quickActionBtns = this.container?.querySelectorAll('.quick-action-btn')
    if (quickActionBtns) {
      quickActionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const stockName = (btn as HTMLElement).dataset.stock
          if (stockName && this.onSendMessage) {
            this.onSendMessage(stockName)
            if (this.input) {
              this.input.value = ''
            }
          }
        })
      })
    }
  }

  // 处理发送
  private handleSend() {
    if (!this.input) return

    const message = this.input.value.trim()
    if (message && this.onSendMessage) {
      this.onSendMessage(message)
      this.input.value = ''
    }
  }

  // 静态方法生成模拟分析结果
  static generateMockAnalysis(): AnalysisResult {
    const trends: ('uptrend' | 'downtrend' | 'sideways')[] = ['uptrend', 'downtrend', 'sideways']
    return {
      trend: trends[Math.floor(Math.random() * trends.length)],
      trendStrength: Math.random() * 0.5 + 0.3,
      priceChannels: Math.floor(Math.random() * 3) + 1,
      supportLevels: Math.floor(Math.random() * 3) + 1,
      resistanceLevels: Math.floor(Math.random() * 3) + 1,
      patterns: Math.floor(Math.random() * 5) + 1,
      signals: Math.floor(Math.random() * 3)
    }
  }
}