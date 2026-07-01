/**
 * 行情源切换组件
 * 支持模拟数据和AKShare真实数据源的切换
 */

import { DatafeedType, DATAFEED_SOURCES } from '../services/types'
import { datafeedService } from '../services/datafeedService'

export class DatafeedSwitcher {
  private container: HTMLElement | null = null
  private currentType: DatafeedType = 'mock'

  constructor() {
    // 从 localStorage 加载用户选择
    const saved = localStorage.getItem('datafeedType')
    if (saved === 'akshare' || saved === 'mock') {
      this.currentType = saved
      // 直接设置，不触发事件（避免循环）
      datafeedService.setCurrentTypeSilent(saved)
    } else {
      // 同步当前数据源状态
      this.currentType = datafeedService.getCurrentType()
    }
    
    // 监听数据源切换事件（其他组件触发的切换）
    datafeedService.onSwitch((type) => {
      if (this.currentType !== type) {
        this.currentType = type
        this.renderUI()
      }
    })
  }

  render(container: HTMLElement) {
    this.container = container
    this.renderUI()
  }

  private renderUI() {
    if (!this.container) return

    // 构建按钮HTML
    const buttonsHtml = DATAFEED_SOURCES.map(source => `
      <button 
        class="datafeed-btn ${this.currentType === source.type ? 'active' : ''}" 
        data-type="${source.type}"
        title="${source.description}"
      >
        <span class="datafeed-icon">${source.icon}</span>
        <span class="datafeed-name">${source.label}</span>
      </button>
    `).join('')

    // 获取当前数据源描述
    const currentSource = DATAFEED_SOURCES.find(s => s.type === this.currentType)

    this.container.innerHTML = `
      <div class="datafeed-switcher">
        <div class="datafeed-switcher-label">📊 行情源</div>
        <div class="datafeed-switcher-options">
          ${buttonsHtml}
        </div>
        <div class="datafeed-switcher-hint">
          ${currentSource ? currentSource.description : ''}
        </div>
      </div>
    `

    // 绑定事件
    const buttons = this.container.querySelectorAll('.datafeed-btn')
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.type as DatafeedType
        this.switchDatafeed(type)
      })
    })
  }

  private async switchDatafeed(type: DatafeedType): void {
    if (this.currentType === type) return
    
    // 先更新本地状态
    this.currentType = type
    
    // 切换到新数据源（会触发监听器，但监听器中会跳过UI更新）
    datafeedService.switchDatafeed(type)
    
    // 保存到 localStorage
    localStorage.setItem('datafeedType', type)
    
    // 手动更新UI（不依赖监听器）
    this.renderUI()
    
    // 显示提示
    const source = DATAFEED_SOURCES.find(s => s.type === type)
    
    if (type === 'akshare') {
      // 检测 AKShare 后端是否可用
      this.checkAkshareAvailability().then(isAvailable => {
        if (isAvailable) {
          this.showToast(`✅ 已切换到${source?.label || type}数据源`)
        } else {
          this.showToast(`⚠️ AKShare后端未配置，将使用模拟数据`, true)
        }
      })
    } else {
      this.showToast(`✅ 已切换到${source?.label || type}数据源`)
    }
  }
  
  // 检测 AKShare 后端 API 是否可用
  private async checkAkshareAvailability(): Promise<boolean> {
    try {
      const baseUrl = datafeedService.getConfig().akshareBaseUrl || '/api/akshare'
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.warn('[DatafeedSwitcher] AKShare后端服务不可用:', error)
      return false
    }
  }

  private showToast(message: string, isWarning: boolean = false): void {
    // 移除已存在的toast
    const existingToast = document.querySelector('.datafeed-toast')
    if (existingToast) {
      existingToast.remove()
    }
    
    const toast = document.createElement('div')
    toast.className = `datafeed-toast ${isWarning ? 'warning' : ''}`
    toast.textContent = message
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.classList.add('show')
    }, 10)
    
    // 警告消息显示时间更长
    const duration = isWarning ? 4000 : 2000
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, duration)
  }

  getCurrentType(): DatafeedType {
    return this.currentType
  }
}
