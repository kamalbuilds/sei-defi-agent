'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ArrowRightIcon,
  BoltIcon,
  FireIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface ArbitrageOpportunity {
  id: string
  fromExchange: string
  toExchange: string
  asset: string
  buyPrice: number
  sellPrice: number
  profit: number
  profitPercentage: number
  volume: number
  timeWindow: string
  gasEstimate: number
  netProfit: number
}

const mockOpportunities: ArbitrageOpportunity[] = [
  {
    id: '1',
    fromExchange: 'Uniswap V3',
    toExchange: 'SushiSwap',
    asset: 'ETH',
    buyPrice: 2485.30,
    sellPrice: 2491.75,
    profit: 6.45,
    profitPercentage: 0.26,
    volume: 10.5,
    timeWindow: '2m 15s',
    gasEstimate: 45.20,
    netProfit: 22.45
  },
  {
    id: '2',
    fromExchange: 'Curve',
    toExchange: 'Balancer',
    asset: 'USDC',
    buyPrice: 0.9998,
    sellPrice: 1.0012,
    profit: 0.0014,
    profitPercentage: 0.14,
    volume: 50000,
    timeWindow: '1m 45s',
    gasEstimate: 32.10,
    netProfit: 38.40
  },
  {
    id: '3',
    fromExchange: 'PancakeSwap',
    toExchange: '1inch',
    asset: 'BNB',
    buyPrice: 305.80,
    sellPrice: 308.92,
    profit: 3.12,
    profitPercentage: 1.02,
    volume: 25.3,
    timeWindow: '3m 30s',
    gasEstimate: 28.50,
    netProfit: 50.48
  },
  {
    id: '4',
    fromExchange: 'dYdX',
    toExchange: 'Uniswap V2',
    asset: 'LINK',
    buyPrice: 14.67,
    sellPrice: 14.89,
    profit: 0.22,
    profitPercentage: 1.50,
    volume: 500,
    timeWindow: '4m 12s',
    gasEstimate: 22.75,
    netProfit: 87.25
  }
]

export default function ArbitrageMonitor() {
  const [opportunities, setOpportunities] = useState(mockOpportunities)
  const [isLive, setIsLive] = useState(true)

  // Simulate real-time updates
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setOpportunities(prev => 
        prev.map(opp => ({
          ...opp,
          buyPrice: opp.buyPrice * (1 + (Math.random() - 0.5) * 0.001),
          sellPrice: opp.sellPrice * (1 + (Math.random() - 0.5) * 0.001),
          timeWindow: updateTimeWindow(opp.timeWindow),
        })).map(opp => ({
          ...opp,
          profit: opp.sellPrice - opp.buyPrice,
          profitPercentage: ((opp.sellPrice - opp.buyPrice) / opp.buyPrice) * 100,
          netProfit: (opp.sellPrice - opp.buyPrice) * opp.volume - opp.gasEstimate
        }))
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [isLive])

  const updateTimeWindow = (currentWindow: string) => {
    const match = currentWindow.match(/(\d+)m (\d+)s/)
    if (match) {
      let minutes = parseInt(match[1])
      let seconds = parseInt(match[2])
      
      seconds -= 5
      if (seconds < 0) {
        seconds = 55
        minutes -= 1
      }
      
      if (minutes < 0) minutes = 0
      
      return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
    }
    return currentWindow
  }

  const getProfitColor = (profit: number) => {
    if (profit > 50) return 'text-green-400'
    if (profit > 20) return 'text-yellow-400'
    return 'text-gray-300'
  }

  const getUrgencyColor = (timeWindow: string) => {
    const match = timeWindow.match(/(\d+)m/)
    const minutes = match ? parseInt(match[1]) : 0
    
    if (minutes <= 1) return 'text-red-400'
    if (minutes <= 2) return 'text-yellow-400'
    return 'text-green-400'
  }

  const handleExecuteArbitrage = (opportunity: ArbitrageOpportunity) => {
    console.log('Executing arbitrage:', opportunity)
    // Implementation would trigger the actual arbitrage execution
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BoltIcon className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Live Opportunities</h3>
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
        </div>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            isLive 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {isLive ? 'Live' : 'Paused'}
        </button>
      </div>

      {/* Opportunities List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {opportunities.map((opp, index) => (
          <motion.div
            key={opp.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors group"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-primary-600 to-accent-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{opp.asset}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{opp.fromExchange}</span>
                  <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-white font-medium">{opp.toExchange}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                <span className={`text-sm font-medium ${getUrgencyColor(opp.timeWindow)}`}>
                  {opp.timeWindow}
                </span>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-gray-400">Buy Price</p>
                <p className="text-white font-semibold">
                  ${opp.buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Sell Price</p>
                <p className="text-white font-semibold">
                  ${opp.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </p>
              </div>
            </div>

            {/* Profit Info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-4">
                <div>
                  <p className="text-xs text-gray-400">Gross Profit</p>
                  <p className="text-green-400 font-semibold">
                    ${opp.profit.toFixed(2)} ({opp.profitPercentage.toFixed(2)}%)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Volume</p>
                  <p className="text-white font-semibold">{opp.volume} {opp.asset}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-xs text-gray-400">Net Profit</p>
                <p className={`font-bold ${getProfitColor(opp.netProfit)}`}>
                  ${opp.netProfit.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Gas Estimate */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <FireIcon className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-gray-400">
                  Gas: ${opp.gasEstimate.toFixed(2)}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {opp.netProfit > 50 && (
                  <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded-full">
                    High Profit
                  </span>
                )}
                {getUrgencyColor(opp.timeWindow) === 'text-red-400' && (
                  <span className="px-2 py-1 bg-red-900 text-red-300 text-xs rounded-full">
                    Urgent
                  </span>
                )}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleExecuteArbitrage(opp)}
              disabled={opp.netProfit <= 0}
              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                opp.netProfit > 0
                  ? 'bg-primary-600 hover:bg-primary-700 text-white group-hover:bg-primary-500'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {opp.netProfit > 0 ? 'Execute Arbitrage' : 'Unprofitable'}
            </button>
          </motion.div>
        ))}
      </div>

      {opportunities.length === 0 && (
        <div className="text-center py-8">
          <BoltIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-400">No arbitrage opportunities found</p>
          <p className="text-gray-500 text-sm">Scanning markets...</p>
        </div>
      )}
    </div>
  )
}