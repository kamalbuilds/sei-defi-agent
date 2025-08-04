'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  CpuChipIcon,
  ClockIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'
import Navigation from '@/components/ui/Navigation'
import PortfolioChart from '@/components/charts/PortfolioChart'

const analyticsData = [
  {
    title: 'Total Profit',
    value: '$12,450.67',
    change: '+15.2%',
    period: '30 days',
    isPositive: true,
    icon: BanknotesIcon
  },
  {
    title: 'Win Rate',
    value: '73.5%',
    change: '+2.1%',
    period: '7 days',
    isPositive: true,
    icon: ChartBarIcon
  },
  {
    title: 'Avg Trade Time',
    value: '4.2 hours',
    change: '-12%',
    period: 'improvement',
    isPositive: true,
    icon: ClockIcon
  },
  {
    title: 'Active Strategies',
    value: '8',
    change: '+2',
    period: 'this week',
    isPositive: true,
    icon: CpuChipIcon
  }
]

const topStrategies = [
  {
    name: 'ETH-USDC Arbitrage',
    profit: '$3,245.50',
    winRate: '85%',
    trades: 156,
    apy: '24.5%'
  },
  {
    name: 'BTC Momentum Trading',
    profit: '$2,890.30',
    winRate: '68%',
    trades: 89,
    apy: '18.2%'
  },
  {
    name: 'Yield Farm Optimizer',
    profit: '$2,156.80',
    winRate: '92%',
    trades: 23,
    apy: '31.7%'
  },
  {
    name: 'Multi-DEX Arbitrage',
    profit: '$1,890.45',
    winRate: '76%',
    trades: 234,
    apy: '15.8%'
  }
]

const riskMetrics = [
  { label: 'Max Drawdown', value: '-8.5%', status: 'good' },
  { label: 'Sharpe Ratio', value: '2.34', status: 'excellent' },
  { label: 'Volatility', value: '12.8%', status: 'moderate' },
  { label: 'Value at Risk', value: '$1,250', status: 'good' }
]

const marketData = [
  { pair: 'ETH/USDC', price: '$2,485.30', change: '+2.3%', volume: '$1.2B' },
  { pair: 'BTC/USDT', price: '$43,250.80', change: '+1.8%', volume: '$890M' },
  { pair: 'UNI/ETH', price: '0.0028', change: '-0.5%', volume: '$45M' },
  { pair: 'LINK/USD', price: '$14.67', change: '+3.2%', volume: '$156M' }
]

export default function AnalyticsPage() {
  const [selectedMetric, setSelectedMetric] = useState('profit')
  const [timeframe, setTimeframe] = useState('30d')

  const timeframes = ['1d', '7d', '30d', '90d', '1y']

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
            <p className="text-gray-300">
              Comprehensive analysis of your trading performance and market insights
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {analyticsData.map((metric, index) => (
              <motion.div
                key={metric.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-effect p-6 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{metric.title}</p>
                    <p className="text-2xl font-bold text-white">{metric.value}</p>
                    <div className="flex items-center mt-1">
                      <ArrowTrendingUpIcon className={`h-4 w-4 mr-1 ${
                        metric.isPositive ? 'text-green-400' : 'text-red-400'
                      }`} />
                      <p className={`text-sm ${metric.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {metric.change} {metric.period}
                      </p>
                    </div>
                  </div>
                  <metric.icon className="h-8 w-8 text-primary-400" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Performance Chart */}
          <div className="mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="glass-effect p-6 rounded-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Performance Overview</h2>
                <div className="flex space-x-2">
                  {timeframes.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        timeframe === tf
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80">
                <PortfolioChart timeframe={timeframe} />
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Top Strategies */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="glass-effect p-6 rounded-xl"
            >
              <h2 className="text-xl font-bold text-white mb-6">Top Performing Strategies</h2>
              <div className="space-y-4">
                {topStrategies.map((strategy, index) => (
                  <div
                    key={strategy.name}
                    className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{strategy.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>Win Rate: {strategy.winRate}</span>
                        <span>Trades: {strategy.trades}</span>
                        <span>APY: {strategy.apy}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-semibold">{strategy.profit}</p>
                      <p className="text-xs text-gray-400">30d profit</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Risk Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="glass-effect p-6 rounded-xl"
            >
              <h2 className="text-xl font-bold text-white mb-6">Risk Analysis</h2>
              <div className="space-y-4">
                {riskMetrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
                  >
                    <span className="text-gray-300">{metric.label}</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-semibold">{metric.value}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        metric.status === 'excellent' ? 'bg-green-900 text-green-300' :
                        metric.status === 'good' ? 'bg-blue-900 text-blue-300' :
                        metric.status === 'moderate' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {metric.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Market Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="glass-effect p-6 rounded-xl"
          >
            <h2 className="text-xl font-bold text-white mb-6">Market Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {marketData.map((market, index) => (
                <div
                  key={market.pair}
                  className="p-4 bg-dark-800 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">{market.pair}</span>
                    <EyeIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-xl font-bold text-white mb-1">{market.price}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${
                      market.change.startsWith('+') ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {market.change}
                    </span>
                    <span className="text-xs text-gray-400">{market.volume}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}