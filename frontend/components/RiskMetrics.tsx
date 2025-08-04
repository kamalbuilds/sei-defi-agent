'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon
} from '@heroicons/react/24/outline'

interface RiskMetric {
  label: string
  value: string
  status: 'low' | 'medium' | 'high' | 'critical'
  change?: string
  description: string
  percentage?: number
}

const riskMetrics: RiskMetric[] = [
  {
    label: 'Portfolio Risk',
    value: 'Medium',
    status: 'medium',
    change: '-2.1%',
    description: 'Overall portfolio risk level',
    percentage: 65
  },
  {
    label: 'Liquidation Risk',
    value: 'Low',
    status: 'low',
    change: '+0.5%',
    description: 'Risk of position liquidation',
    percentage: 25
  },
  {
    label: 'Concentration Risk',
    value: 'High',
    status: 'high',
    change: '+5.2%',
    description: 'Asset concentration exposure',
    percentage: 85
  },
  {
    label: 'Market Risk',
    value: 'Medium',
    status: 'medium',
    change: '-1.8%',
    description: 'Exposure to market volatility',
    percentage: 70
  },
  {
    label: 'Smart Contract Risk',
    value: 'Low',
    status: 'low',
    change: '0.0%',
    description: 'Protocol and contract risks',
    percentage: 20
  }
]

const additionalMetrics = [
  { label: 'VaR (95%)', value: '$2,450', status: 'medium' as const },
  { label: 'Max Drawdown', value: '8.5%', status: 'low' as const },
  { label: 'Sharpe Ratio', value: '2.34', status: 'low' as const },
  { label: 'Beta', value: '1.15', status: 'medium' as const }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'low':
      return 'text-green-400'
    case 'medium':
      return 'text-yellow-400'
    case 'high':
      return 'text-orange-400'
    case 'critical':
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
}

const getStatusBgColor = (status: string) => {
  switch (status) {
    case 'low':
      return 'bg-green-400'
    case 'medium':
      return 'bg-yellow-400'
    case 'high':
      return 'bg-orange-400'
    case 'critical':
      return 'bg-red-400'
    default:
      return 'bg-gray-400'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'low':
      return <ShieldCheckIcon className="h-5 w-5 text-green-400" />
    case 'medium':
      return <ShieldExclamationIcon className="h-5 w-5 text-yellow-400" />
    case 'high':
      return <ExclamationTriangleIcon className="h-5 w-5 text-orange-400" />
    case 'critical':
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
    default:
      return <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
  }
}

export default function RiskMetrics() {
  return (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className="text-center mb-6">
        <div className="relative w-24 h-24 mx-auto mb-3">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="rgb(251, 191, 36)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${65 * 2.51} 251`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">65</span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Risk Score</h3>
        <p className="text-yellow-400 text-sm">Medium Risk</p>
      </div>

      {/* Risk Breakdown */}
      <div className="space-y-4">
        {riskMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="p-4 bg-dark-800 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getStatusIcon(metric.status)}
                <span className="text-white font-medium text-sm">{metric.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-semibold ${getStatusColor(metric.status)}`}>
                  {metric.value}
                </span>
                {metric.change && (
                  <div className="flex items-center space-x-1">
                    {metric.change.startsWith('+') ? (
                      <TrendingUpIcon className="h-3 w-3 text-red-400" />
                    ) : (
                      <TrendingDownIcon className="h-3 w-3 text-green-400" />
                    )}
                    <span className={`text-xs ${
                      metric.change.startsWith('+') ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {metric.change}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Progress Bar */}
            {metric.percentage && (
              <div className="mb-2">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${getStatusBgColor(metric.status)}`}
                    style={{ width: `${metric.percentage}%` }}
                  />
                </div>
              </div>
            )}
            
            <p className="text-gray-400 text-xs">{metric.description}</p>
          </motion.div>
        ))}
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-700">
        {additionalMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
            className="text-center p-3 bg-dark-800 rounded-lg"
          >
            <p className="text-gray-400 text-xs mb-1">{metric.label}</p>
            <p className={`font-semibold ${getStatusColor(metric.status)}`}>
              {metric.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Risk Alerts */}
      <div className="mt-6">
        <h4 className="text-white font-medium mb-3 flex items-center space-x-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400" />
          <span>Risk Alerts</span>
        </h4>
        <div className="space-y-2">
          <div className="flex items-start space-x-3 p-3 bg-orange-900/20 border border-orange-400/30 rounded-lg">
            <ExclamationTriangleIcon className="h-4 w-4 text-orange-400 mt-0.5" />
            <div>
              <p className="text-orange-300 text-sm font-medium">High Concentration Risk</p>
              <p className="text-orange-200 text-xs">
                85% of portfolio concentrated in top 3 assets
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-yellow-900/20 border border-yellow-400/30 rounded-lg">
            <ShieldExclamationIcon className="h-4 w-4 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-sm font-medium">Market Volatility Detected</p>
              <p className="text-yellow-200 text-xs">
                Increased volatility in ETH/USDC pair
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Management Actions */}
      <div className="mt-6 space-y-2">
        <h4 className="text-white font-medium mb-3">Quick Actions</h4>
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
          Rebalance Portfolio
        </button>
        <button className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
          Set Stop Losses
        </button>
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
          Hedge Positions
        </button>
      </div>
    </div>
  )
}