'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ChartBarIcon,
  CpuChipIcon,
  WalletIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import AgentCard from '@/components/AgentCard'
import PortfolioChart from '@/components/charts/PortfolioChart'
import ArbitrageMonitor from '@/components/ArbitrageMonitor'
import RiskMetrics from '@/components/RiskMetrics'
import Navigation from '@/components/ui/Navigation'
import useNexusData from '@/hooks/useNexusData'

export default function RealtimeDashboardPage() {
  const { address, isConnected } = useAccount()
  const {
    agents,
    portfolio,
    arbitrageOpportunities,
    alerts,
    metrics,
    isConnected: wsConnected,
    isLoading,
    executeArbitrage,
    startAgent,
    stopAgent,
    updateAgentConfig,
  } = useNexusData()

  // Calculate stats from real data
  const statsData = [
    {
      title: 'Total Portfolio Value',
      value: portfolio?.totalValue || '$0.00',
      change: portfolio?.performance?.daily ? `${portfolio.performance.daily > 0 ? '+' : ''}${portfolio.performance.daily.toFixed(2)}%` : '0%',
      icon: WalletIcon,
      color: portfolio?.performance?.daily && portfolio.performance.daily > 0 ? 'text-green-400' : 'text-red-400'
    },
    {
      title: 'Active Agents',
      value: `${agents.filter(a => a.status === 'active').length}/${agents.length}`,
      change: agents.length > 0 ? `${Math.round((agents.filter(a => a.status === 'active').length / agents.length) * 100)}%` : '0%',
      icon: CpuChipIcon,
      color: 'text-blue-400'
    },
    {
      title: '24h P&L',
      value: portfolio?.performance?.daily ? 
        `${portfolio.performance.daily > 0 ? '+' : ''}$${Math.abs(parseFloat(portfolio.totalValue.replace(/[^0-9.-]/g, '')) * portfolio.performance.daily / 100).toFixed(2)}` 
        : '$0.00',
      change: portfolio?.performance?.daily ? `${portfolio.performance.daily > 0 ? '+' : ''}${portfolio.performance.daily.toFixed(2)}%` : '0%',
      icon: ChartBarIcon,
      color: portfolio?.performance?.daily && portfolio.performance.daily > 0 ? 'text-green-400' : 'text-red-400'
    },
    {
      title: 'Gas Saved',
      value: metrics?.gasSaved || '$0.00',
      change: 'Today',
      icon: BoltIcon,
      color: 'text-yellow-400'
    }
  ]

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-6">
            Connect Your Wallet to Access Dashboard
          </h1>
          <ConnectButton />
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mb-4 mx-auto"></div>
          <h2 className="text-xl text-white">Loading dashboard data...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with connection status */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Welcome back, {address?.slice(0, 6)}...{address?.slice(-4)}
                </h1>
                <p className="text-gray-300">
                  Monitor your AI agents and portfolio performance
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-sm text-gray-300">
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statsData.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-effect p-6 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className={`text-sm ${stat.color}`}>{stat.change}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Portfolio Chart */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="glass-effect p-6 rounded-xl"
              >
                <h2 className="text-xl font-bold text-white mb-4">Portfolio Performance</h2>
                <PortfolioChart portfolio={portfolio} />
              </motion.div>
            </div>

            {/* Risk Metrics */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="glass-effect p-6 rounded-xl"
              >
                <h2 className="text-xl font-bold text-white mb-4">Risk Analysis</h2>
                <RiskMetrics portfolio={portfolio} />
              </motion.div>
            </div>
          </div>

          {/* Agents Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              AI Agents {agents.length === 0 && '(No agents detected - check backend connection)'}
            </h2>
            {agents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {agents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                  >
                    <AgentCard 
                      agent={agent} 
                      onStart={() => startAgent(agent.id)}
                      onStop={() => stopAgent(agent.id)}
                      onConfigure={(config) => updateAgentConfig(agent.id, config)}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="glass-effect p-8 rounded-xl text-center">
                <p className="text-gray-400">No agents available. Make sure the backend is running.</p>
              </div>
            )}
          </div>

          {/* Arbitrage Monitor and Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="glass-effect p-6 rounded-xl"
            >
              <h2 className="text-xl font-bold text-white mb-4">
                Arbitrage Opportunities ({arbitrageOpportunities.length})
              </h2>
              {arbitrageOpportunities.length > 0 ? (
                <ArbitrageMonitor 
                  opportunities={arbitrageOpportunities}
                  onExecute={executeArbitrage}
                />
              ) : (
                <p className="text-gray-400">No arbitrage opportunities detected</p>
              )}
            </motion.div>

            {/* Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="glass-effect p-6 rounded-xl"
            >
              <h2 className="text-xl font-bold text-white mb-4">
                Recent Alerts ({alerts.length})
              </h2>
              {alerts.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3">
                      {alert.type === 'success' && (
                        <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                      )}
                      {alert.type === 'warning' && (
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                      )}
                      {alert.type === 'error' && (
                        <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      {alert.type === 'info' && (
                        <InformationCircleIcon className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-white text-sm">{alert.message}</p>
                        <p className="text-gray-400 text-xs">{alert.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No alerts yet</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}