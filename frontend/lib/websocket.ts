import { io, Socket } from 'socket.io-client'

class WebSocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect() {
    if (this.socket?.connected) return

    this.socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.handleReconnect()
    })

    // Agent status updates
    this.socket.on('agent:status', (data) => {
      this.emit('agent:status', data)
    })

    // Portfolio updates
    this.socket.on('portfolio:update', (data) => {
      this.emit('portfolio:update', data)
    })

    // Market data updates
    this.socket.on('market:update', (data) => {
      this.emit('market:update', data)
    })

    // Arbitrage opportunities
    this.socket.on('arbitrage:opportunity', (data) => {
      this.emit('arbitrage:opportunity', data)
    })

    // Transaction updates
    this.socket.on('transaction:update', (data) => {
      this.emit('transaction:update', data)
    })

    // Risk alerts
    this.socket.on('risk:alert', (data) => {
      this.emit('risk:alert', data)
    })
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    setTimeout(() => {
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      this.connect()
    }, delay)
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // Subscribe to events
  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  // Unsubscribe from events
  off(event: string, callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  // Emit events
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }

  // Subscribe to agent updates
  subscribeToAgent(agentId: string) {
    this.emit('agent:subscribe', { agentId })
  }

  // Unsubscribe from agent updates
  unsubscribeFromAgent(agentId: string) {
    this.emit('agent:unsubscribe', { agentId })
  }

  // Subscribe to portfolio updates
  subscribeToPortfolio(address: string) {
    this.emit('portfolio:subscribe', { address })
  }

  // Subscribe to market data
  subscribeToMarketData(pairs: string[]) {
    this.emit('market:subscribe', { pairs })
  }
}

// Create singleton instance
const wsManager = new WebSocketManager()

export default wsManager