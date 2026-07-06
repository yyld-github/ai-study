/**
 * 手势识别服务
 * 使用 MediaPipe Hands 实现手部关键点检测和手势识别
 * - 单手左右挥动 → 行情图左右移动（连续平滑滚动，速度映射）
 * - 双手靠近/远离 → 缩小/放大行情图（连续平滑缩放）
 *
 * 改进要点：
 * 1. 连续平滑映射：不再用阈值累积触发，而是实时映射手部运动到图表操作
 * 2. 速度/比例平滑：用指数平滑减少抖动，手感更跟手
 * 3. 可视化反馈数据：提供手势强度、方向等数据供 UI 层展示
 */

export interface GestureCallbacks {
  /** 单手滚动：deltaX 为归一化滚动量（正=右，负=左） */
  onScroll?: (deltaX: number) => void
  /** 双手缩放：ratio > 1 放大，< 1 缩小 */
  onZoom?: (ratio: number) => void
  /** 状态变化 */
  onStatusChange?: (active: boolean, handCount: number) => void
  /** 手势可视化数据（供 UI 层绘制反馈层） */
  onVisualFeedback?: (feedback: GestureVisualFeedback) => void
}

export interface GestureVisualFeedback {
  /** 当前手势模式：'idle' | 'scroll' | 'zoom' */
  mode: 'idle' | 'scroll' | 'zoom'
  /** 单手模式下的滚动方向和强度（-1 ~ 1） */
  scrollIntensity: number
  /** 双手模式下的缩放比例（相对于初始距离） */
  zoomRatio: number
  /** 手部在画面中的归一化 x 位置（0~1） */
  handX: number
  /** 手部在画面中的归一化 y 位置（0~1） */
  handY: number
}

export class GestureControl {
  private video: HTMLVideoElement | null = null
  private camera: any = null
  private handsInstance: any = null
  private running = false
  private callbacks: GestureCallbacks = {}
  private scriptsLoaded = false
  private canvas: HTMLCanvasElement | null = null
  private canvasCtx: CanvasRenderingContext2D | null = null

  // ====== 单手滚动状态 ======
  private prevHandCenterX: number | null = null
  private smoothedScrollVelocity = 0       // 平滑后的滚动速度
  private scrollDeadzone = 0.005           // 死区，忽略微小抖动

  // ====== 双手缩放状态 ======
  private initialPinchDistance: number | null = null  // 双手刚检测到时的参考距离
  private smoothedZoomRatio = 1            // 平滑后的缩放比
  private zoomSmoothFactor = 0.3           // 缩放平滑系数（越小越平滑）
  private scrollSmoothFactor = 0.35        // 滚动平滑系数（越大越跟手）

  // ====== 双手中心位置（用于可视化） ======
  private handsCenterX = 0.5
  private handsCenterY = 0.5

  // ====== 可视化反馈 ======
  private lastFeedback: GestureVisualFeedback = {
    mode: 'idle',
    scrollIntensity: 0,
    zoomRatio: 1,
    handX: 0.5,
    handY: 0.5,
  }

  private handCount = 0

  async start(
    videoElement: HTMLVideoElement,
    canvasElement?: HTMLCanvasElement
  ): Promise<void> {
    this.video = videoElement
    this.canvas = canvasElement || null
    if (this.canvas) {
      this.canvasCtx = this.canvas.getContext('2d')
    }

    if (!this.scriptsLoaded) {
      try {
        await this.loadScripts()
      } catch (err) {
        console.error('[GestureControl] 加载 MediaPipe 脚本失败:', err)
        throw new Error('加载手势识别库失败，请检查网络连接')
      }
    }
    await this.initHands()
    this.running = true
  }

  stop() {
    this.running = false
    this.handCount = 0

    if (this.camera) {
      try { this.camera.stop() } catch (e) { /* ignore */ }
      this.camera = null
    }

    if (this.handsInstance) {
      try { this.handsInstance.close() } catch (e) { /* ignore */ }
      this.handsInstance = null
    }

    if (this.video) {
      const stream = this.video.srcObject as MediaStream
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
      this.video.srcObject = null
      this.video = null
    }

    if (this.canvas && this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
    this.canvas = null
    this.canvasCtx = null

    this.resetState()
  }

  setCallbacks(callbacks: GestureCallbacks) {
    this.callbacks = callbacks
  }

  isRunning(): boolean {
    return this.running
  }

  getHandCount(): number {
    return this.handCount
  }

  private resetState() {
    this.prevHandCenterX = null
    this.smoothedScrollVelocity = 0
    this.initialPinchDistance = null
    this.smoothedZoomRatio = 1
    this.handsCenterX = 0.5
    this.handsCenterY = 0.5
    this.lastFeedback = {
      mode: 'idle',
      scrollIntensity: 0,
      zoomRatio: 1,
      handX: 0.5,
      handY: 0.5,
    }
  }

  private async loadScripts(): Promise<void> {
    const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe'

    const scripts = [
      `${CDN_BASE}/camera_utils/camera_utils.js`,
      `${CDN_BASE}/drawing_utils/drawing_utils.js`,
      `${CDN_BASE}/hands/hands.js`,
    ]

    await new Promise<void>((resolve, reject) => {
      let loaded = 0
      let hasError = false

      scripts.forEach((src) => {
        const existing = document.querySelector(
          `script[src="${src}"]`
        ) as HTMLScriptElement | null
        if (existing) {
          loaded++
          if (loaded === scripts.length) {
            this.scriptsLoaded = true
            resolve()
          }
          return
        }

        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.onload = () => {
          loaded++
          if (loaded === scripts.length && !hasError) {
            this.scriptsLoaded = true
            resolve()
          }
        }
        script.onerror = () => {
          if (!hasError) {
            hasError = true
            reject(new Error(`加载脚本失败: ${src}`))
          }
        }
        document.head.appendChild(script)
      })
    })
  }

  private async initHands(): Promise<void> {
    const Hands = (window as any).Hands
    const Camera = (window as any).Camera

    if (!Hands || !Camera) {
      throw new Error('MediaPipe 库未正确加载')
    }

    this.handsInstance = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      },
    })

    this.handsInstance.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    })

    this.handsInstance.onResults((results: any) => {
      this.processResults(results)
    })

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        if (this.handsInstance && this.video && this.video.readyState >= 2) {
          try {
            await this.handsInstance.send({ image: this.video })
          } catch (e) {
            // 忽略帧处理错误
          }
        }
      },
      width: 640,
      height: 480,
    })

    await this.camera.start()
  }

  private processResults(results: any) {
    if (!this.running) return

    const count = results.multiHandLandmarks
      ? results.multiHandLandmarks.length
      : 0
    this.handCount = count

    // 绘制手部关键点（摄像头预览画布）
    this.drawLandmarks(results)

    if (count === 1) {
      // 单手模式 - 连续平滑滚动
      this.handleSingleHand(results.multiHandLandmarks[0])
      this.callbacks.onStatusChange?.(true, 1)
    } else if (count === 2) {
      // 双手模式 - 连续平滑缩放
      this.handleTwoHands(
        results.multiHandLandmarks[0],
        results.multiHandLandmarks[1]
      )
      this.callbacks.onStatusChange?.(true, 2)
    } else {
      // 无手部检测 → 渐变为 idle
      this.smoothedScrollVelocity *= 0.85
      this.initialPinchDistance = null
      this.smoothedZoomRatio = 1
      this.prevHandCenterX = null

      if (Math.abs(this.smoothedScrollVelocity) > 0.001) {
        // 仍有残余速度，继续发送减速滚动（惯性效果）
        this.callbacks.onScroll?.(this.smoothedScrollVelocity * 80)
      } else {
        this.smoothedScrollVelocity = 0
        this.lastFeedback.mode = 'idle'
        this.lastFeedback.scrollIntensity = 0
        this.lastFeedback.zoomRatio = 1
        this.emitVisualFeedback()
      }

      if (this.handCount !== 0) {
        this.callbacks.onStatusChange?.(false, 0)
      }
    }
  }

  // ==================== 单手：连续平滑滚动 ====================

  private handleSingleHand(landmarks: any[]) {
    // 使用多个关键点求平均作为手部中心
    const centerX =
      (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5
    const centerY =
      (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5

    this.handsCenterX = centerX
    this.handsCenterY = centerY

    if (this.prevHandCenterX !== null) {
      // 原始位移量（归一化坐标差）
      const rawDelta = centerX - this.prevHandCenterX

      // 死区过滤：微小抖动不处理
      if (Math.abs(rawDelta) < this.scrollDeadzone) {
        // 速度衰减（模拟摩擦）
        this.smoothedScrollVelocity *= 0.85
      } else {
        // 指数平滑滤波 - 灵敏度大幅提升
        const targetVelocity = rawDelta * 25  // 放大灵敏度
        this.smoothedScrollVelocity =
          this.smoothedScrollVelocity * (1 - this.scrollSmoothFactor) +
          targetVelocity * this.scrollSmoothFactor
      }

      // 限制最大速度
      this.smoothedScrollVelocity = Math.max(
        -3.0,
        Math.min(3.0, this.smoothedScrollVelocity)
      )

      // 连续发送滚动事件（每帧都发，让图表持续滚动）
      if (Math.abs(this.smoothedScrollVelocity) > 0.02) {
        const scrollAmount = this.smoothedScrollVelocity * 300
        this.callbacks.onScroll?.(scrollAmount)
      }
    }

    this.prevHandCenterX = centerX
    this.initialPinchDistance = null
    this.smoothedZoomRatio = 1

    // 更新可视化反馈
    this.lastFeedback.mode = 'scroll'
    this.lastFeedback.scrollIntensity = this.smoothedScrollVelocity
    this.lastFeedback.handX = centerX
    this.lastFeedback.handY = centerY
    this.emitVisualFeedback()
  }

  // ==================== 双手：连续平滑缩放 ====================

  private handleTwoHands(hand1Landmarks: any[], hand2Landmarks: any[]) {
    // 使用食指指尖（landmark 8）计算捏合距离
    const tip1 = hand1Landmarks[8]
    const tip2 = hand2Landmarks[8]

    const dx = tip1.x - tip2.x
    const dy = tip1.y - tip2.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 双手中心位置
    this.handsCenterX = (tip1.x + tip2.x) / 2
    this.handsCenterY = (tip1.y + tip2.y) / 2

    if (this.initialPinchDistance === null) {
      // 首次检测到双手，记录初始距离作为基准
      if (distance > 0.02) {
        this.initialPinchDistance = distance
        this.smoothedZoomRatio = 1
      }
    } else {
      // 计算当前距离相对于初始距离的比例
      const rawRatio = distance / this.initialPinchDistance

      // 指数平滑
      this.smoothedZoomRatio =
        this.smoothedZoomRatio * (1 - this.zoomSmoothFactor) +
        rawRatio * this.zoomSmoothFactor

      // 限制缩放范围
      this.smoothedZoomRatio = Math.max(0.3, Math.min(3.0, this.smoothedZoomRatio))

      // 只有当比例明显偏离 1 时才触发缩放
      if (Math.abs(this.smoothedZoomRatio - 1) > 0.03) {
        // 连续发送缩放事件
        this.callbacks.onZoom?.(this.smoothedZoomRatio)
      }
    }

    this.prevHandCenterX = null
    this.smoothedScrollVelocity = 0

    // 更新可视化反馈
    this.lastFeedback.mode = 'zoom'
    this.lastFeedback.zoomRatio = this.smoothedZoomRatio
    this.lastFeedback.handX = this.handsCenterX
    this.lastFeedback.handY = this.handsCenterY
    this.emitVisualFeedback()
  }

  // ==================== 可视化反馈 ====================

  private emitVisualFeedback() {
    this.callbacks.onVisualFeedback?.({
      ...this.lastFeedback,
    })
  }

  // ==================== 绘制手部关键点 ====================

  private drawLandmarks(results: any) {
    if (!this.canvas || !this.canvasCtx || !results.multiHandLandmarks) return

    const ctx = this.canvasCtx
    const width = this.canvas.width
    const height = this.canvas.height

    ctx.clearRect(0, 0, width, height)

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ]

    for (let h = 0; h < results.multiHandLandmarks.length; h++) {
      const landmarks = results.multiHandLandmarks[h]

      ctx.strokeStyle = h === 0 ? '#00E676' : '#448AFF'
      ctx.lineWidth = 2
      ctx.beginPath()
      connections.forEach(([i, j]) => {
        const p1 = landmarks[i]
        const p2 = landmarks[j]
        ctx.moveTo(p1.x * width, p1.y * height)
        ctx.lineTo(p2.x * width, p2.y * height)
      })
      ctx.stroke()

      landmarks.forEach((lm: any, idx: number) => {
        const x = lm.x * width
        const y = lm.y * height

        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        ctx.fillStyle = h === 0 ? '#00E676' : '#448AFF'
        ctx.fill()

        if (idx === 0 || idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20) {
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, 2 * Math.PI)
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      })
    }

    // 绘制当前手势模式提示
    const mode = this.lastFeedback.mode
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.textAlign = 'left'
    if (mode === 'scroll') {
      const dir = this.smoothedScrollVelocity > 0 ? '→' : '←'
      ctx.fillText(`${dir} 滚动`, 10, 25)
    } else if (mode === 'zoom') {
      const dir = this.smoothedZoomRatio > 1 ? '🔍+' : '🔍-'
      ctx.fillText(`${dir} 缩放 ${this.smoothedZoomRatio.toFixed(2)}x`, 10, 25)
    }
  }
}
