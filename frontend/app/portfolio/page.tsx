'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  WalletIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PlusIcon,
  MinusIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline'
import Navigation from '@/components/ui/Navigation'
import PortfolioChart from '@/components/charts/PortfolioChart'

const portfolioData = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '12.5',
    value: '$31,250.00',
    allocation: 45,
    change24h: '+2.3%',
    changeValue: '+$702.50',
    isPositive: true
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    balance: '0.75',
    value: '$32,250.00',
    allocation: 35,
    change24h: '+1.8%',
    changeValue: '+$570.00',
    isPositive: true
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '15,000',
    value: '$15,000.00',
    allocation: 15,
    change24h: '0.0%',
    changeValue: '$0.00',
    isPositive: true
  },
  {
    symbol: 'UNI',
    name: 'Uniswap',
    balance: '500',
    value: '$3,500.00',
    allocation: 5,
    change24h: '-1.2%',
    changeValue: '-$42.00',
    isPositive: false
  }
]

const recentTransactions = [
  {
    id: '1',
    type: 'buy',
    asset: 'ETH',
    amount: '2.5',
    price: '$2,500.00',
    total: '$6,250.00',
    timestamp: '2 hours ago',
    status: 'completed'
  },
  {
    id: '2',
    type: 'sell',
    asset: 'UNI',
    amount: '100',
    price: '$7.20',
    total: '$720.00',
    timestamp: '6 hours ago',
    status: 'completed'
  },
  {
    id: '3',
    type: 'swap',
    asset: 'USDC → ETH',
    amount: '5,000',
    price: '$2,480.00',
    total: '2.02 ETH',
    timestamp: '1 day ago',
    status: 'completed'
  }
]

const performanceMetrics = [
  { label: 'Total Value', value: '$82,000.00', change: '+$1,230.50', isPositive: true },
  { label: '24h Change', value: '+1.52%', change: '+$1,230.50', isPositive: true },
  { label: '7d Change', value: '+8.7%', change: '+$6,580.00', isPositive: true },
  { label: '30d Change', value: '+15.2%', change: '+$10,850.00', isPositive: true }
]

export default function PortfolioPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h')
  const [showRebalanceModal, setShowRebalanceModal] = useState(false)

  const timeframes = ['1h', '24h', '7d', '30d', '90d', '1y']

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Portfolio</h1>
              <p className="text-gray-300">
                Track your assets and performance across all chains
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowRebalanceModal(true)}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <ArrowsRightLeftIcon className="h-5 w-5" />
                <span>Rebalance</span>
              </button>
              <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors">
                <PlusIcon className="h-5 w-5" />
                <span>Add Position</span>
              </button>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {performanceMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-effect p-6 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{metric.label}</p>
                    <p className="text-2xl font-bold text-white">{metric.value}</p>
                    <div className="flex items-center mt-1">
                      {metric.isPositive ? (
                        <ArrowTrendingUpIcon className="h-4 w-4 text-green-400 mr-1" />
                      ) : (
                        <ArrowTrendingDownIcon className="h-4 w-4 text-red-400 mr-1" />
                      )}
                      <p className={`text-sm ${metric.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {metric.change}
                      </p>
                    </div>
                  </div>
                  <WalletIcon className="h-8 w-8 text-primary-400" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Portfolio Chart */}
          <div className="mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="glass-effect p-6 rounded-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Portfolio Performance</h2>
                <div className="flex space-x-2">
                  {timeframes.map((timeframe) => (
                    <button
                      key={timeframe}
                      onClick={() => setSelectedTimeframe(timeframe)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedTimeframe === timeframe
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {timeframe}
                    </button>
                  ))}
                </div>
              </div>
              <PortfolioChart timeframe={selectedTimeframe} />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Asset Breakdown */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="glass-effect p-6 rounded-xl"
              >
                <h2 className="text-xl font-bold text-white mb-6">Asset Breakdown</h2>
                <div className="space-y-4">
                  {portfolioData.map((asset, index) => (
                    <div
                      key={asset.symbol}
                      className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-primary-600 to-accent-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{asset.symbol}</span>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{asset.name}</h3>
                          <p className="text-gray-400 text-sm">{asset.balance} {asset.symbol}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-white font-semibold">{asset.value}</p>
                        <div className="flex items-center justify-end">
                          {asset.isPositive ? (
                            <ArrowTrendingUpIcon className="h-4 w-4 text-green-400 mr-1" />
                          ) : (
                            <ArrowTrendingDownIcon className="h-4 w-4 text-red-400 mr-1" />
                          )}
                          <p className={`text-sm ${asset.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {asset.change24h}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-gray-300 text-sm">Allocation</p>
                        <p className="text-white font-semibold">{asset.allocation}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Recent Transactions */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="glass-effect p-6 rounded-xl"
              >
                <h2 className="text-xl font-bold text-white mb-6">Recent Transactions</h2>
                <div className="space-y-4">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 bg-dark-800 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tx.type === 'buy' ? 'bg-green-900 text-green-300' :
                          tx.type === 'sell' ? 'bg-red-900 text-red-300' :
                          'bg-blue-900 text-blue-300'
                        }`}>
                          {tx.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">{tx.timestamp}</span>
                      </div>
                      <p className="text-white font-medium">{tx.asset}</p>
                      <p className="text-gray-300 text-sm">
                        {tx.amount} @ {tx.price}
                      </p>
                      <p className="text-gray-400 text-sm">{tx.total}</p>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 text-primary-400 hover:text-primary-300 text-sm font-medium">
                  View All Transactions
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Rebalance Modal */}
      {showRebalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-effect p-8 rounded-xl max-w-2xl w-full mx-4"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Rebalance Portfolio</h2>
            <div className="space-y-4 mb-6">
              {portfolioData.map((asset) => (
                <div key={asset.symbol} className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-primary-600 to-accent-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xs">{asset.symbol}</span>
                    </div>
                    <span className="text-white">{asset.name}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-300">Current: {asset.allocation}%</span>
                    <input
                      type="number"
                      defaultValue={asset.allocation}
                      className="w-20 bg-dark-700 border border-gray-600 rounded px-3 py-1 text-white text-center"
                      min="0"
                      max="100"
                    />
                    <span className="text-gray-300">Target</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowRebalanceModal(false)}
                className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-2 rounded-lg transition-colors">
                Execute Rebalance
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}