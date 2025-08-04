import { useEffect, useCallback, useRef } from 'react'
import wsManager from '@/lib/websocket'

interface UseWebSocketOptions {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: any) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onConnect, onDisconnect, onError } = options
  const isConnectedRef = useRef(false)

  useEffect(() => {
    // Connect to WebSocket
    wsManager.connect()

    // Set up connection event handlers
    const handleConnect = () => {
      isConnectedRef.current = true
      onConnect?.()
    }

    const handleDisconnect = () => {
      isConnectedRef.current = false
      onDisconnect?.()
    }

    const handleError = (error: any) => {
      onError?.(error)
    }

    wsManager.on('connect', handleConnect)
    wsManager.on('disconnect', handleDisconnect)
    wsManager.on('connect_error', handleError)

    // Cleanup on unmount
    return () => {
      wsManager.off('connect', handleConnect)
      wsManager.off('disconnect', handleDisconnect)
      wsManager.off('connect_error', handleError)
    }
  }, [onConnect, onDisconnect, onError])

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    wsManager.on(event, callback)
    return () => wsManager.off(event, callback)
  }, [])

  const emit = useCallback((event: string, data?: any) => {
    wsManager.emit(event, data)
  }, [])

  return {
    subscribe,
    emit,
    isConnected: isConnectedRef.current,
    subscribeToAgent: wsManager.subscribeToAgent.bind(wsManager),
    unsubscribeFromAgent: wsManager.unsubscribeFromAgent.bind(wsManager),
    subscribeToPortfolio: wsManager.subscribeToPortfolio.bind(wsManager),
    subscribeToMarketData: wsManager.subscribeToMarketData.bind(wsManager),
  }
}

// Custom hooks for specific data types
export function useAgentUpdates(agentId?: string) {
  const { subscribe, subscribeToAgent, unsubscribeFromAgent } = useWebSocket()

  useEffect(() => {
    if (agentId) {
      subscribeToAgent(agentId)
      return () => unsubscribeFromAgent(agentId)
    }
  }, [agentId, subscribeToAgent, unsubscribeFromAgent])

  return {
    subscribe: (callback: (data: any) => void) => subscribe('agent:status', callback),
  }
}

export function usePortfolioUpdates(address?: string) {
  const { subscribe, subscribeToPortfolio } = useWebSocket()

  useEffect(() => {
    if (address) {
      subscribeToPortfolio(address)
    }
  }, [address, subscribeToPortfolio])

  return {
    subscribe: (callback: (data: any) => void) => subscribe('portfolio:update', callback),
  }
}

export function useMarketUpdates(pairs: string[] = []) {
  const { subscribe, subscribeToMarketData } = useWebSocket()

  useEffect(() => {
    if (pairs.length > 0) {
      subscribeToMarketData(pairs)
    }
  }, [pairs, subscribeToMarketData])

  return {
    subscribe: (callback: (data: any) => void) => subscribe('market:update', callback),
  }
}

export function useArbitrageUpdates() {
  const { subscribe } = useWebSocket()

  return {
    subscribe: (callback: (data: any) => void) => subscribe('arbitrage:opportunity', callback),
  }
}

export function useTransactionUpdates() {
  const { subscribe } = useWebSocket()

  return {
    subscribe: (callback: (data: any) => void) => subscribe('transaction:update', callback),
  }
}

export function useRiskAlerts() {
  const { subscribe } = useWebSocket()

  return {
    subscribe: (callback: (data: any) => void) => subscribe('risk:alert', callback),
  }
}