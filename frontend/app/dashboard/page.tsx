'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ChartBarIcon,
  CpuChipIcon,
  WalletIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import AgentCard from '@/components/AgentCard'
import PortfolioChart from '@/components/charts/PortfolioChart'
import ArbitrageMonitor from '@/components/ArbitrageMonitor'
import RiskMetrics from '@/components/RiskMetrics'
import Navigation from '@/components/ui/Navigation'

const mockAgents = [
  {
    id: '1',
    name: 'Arbitrage Hunter',
    type: 'arbitrage',
    status: 'active',
    performance: '+12.5%',
    lastAction: '2 minutes ago',
    description: 'Scanning for arbitrage opportunities across DEXs'
  },
  {
    id: '2',
    name: 'Portfolio Optimizer',
    type: 'portfolio',
    status: 'active',
    performance: '+8.3%',
    lastAction: '5 minutes ago',
    description: 'Optimizing asset allocation and rebalancing'
  },
  {
    id: '3',
    name: 'Risk Manager',
    type: 'risk',
    status: 'idle',
    performance: '+3.1%',
    lastAction: '15 minutes ago',
    description: 'Monitoring portfolio risk and setting stop-losses'
  },
  {
    id: '4',
    name: 'Yield Farmer',
    type: 'yield',
    status: 'active',
    performance: '+15.7%',
    lastAction: '1 minute ago',
    description: 'Maximizing yield farming opportunities'
  }
]

const statsData = [
  {
    title: 'Total Portfolio Value',
    value: '$125,430.50',
    change: '+12.5%',
    icon: WalletIcon,
    color: 'text-green-400'
  },
  {
    title: 'Active Agents',
    value: '3/4',
    change: '75%',
    icon: CpuChipIcon,
    color: 'text-blue-400'
  },
  {
    title: '24h P&L',
    value: '+$2,345.67',
    change: '+1.9%',
    icon: ChartBarIcon,
    color: 'text-green-400'
  },
  {
    title: 'Gas Saved',
    value: '$89.23',
    change: 'Today',
    icon: BoltIcon,
    color: 'text-yellow-400'
  }
]

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const [alerts, setAlerts] = useState([
    {
      id: 1,
      type: 'success',
      message: 'Arbitrage opportunity executed successfully',
      timestamp: new Date().toLocaleTimeString()
    },
    {
      id: 2,
      type: 'warning',
      message: 'High gas fees detected on Ethereum',
      timestamp: new Date().toLocaleTimeString()
    }
  ])

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

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, Trader
            </h1>
            <p className="text-gray-300">
              Monitor your AI agents and portfolio performance
            </p>
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
                <PortfolioChart />
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
                <RiskMetrics />
              </motion.div>
            </div>
          </div>

          {/* Agents Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">AI Agents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mockAgents.map((agent, index) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Arbitrage Monitor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="glass-effect p-6 rounded-xl"
            >
              <h2 className="text-xl font-bold text-white mb-4">Arbitrage Opportunities</h2>
              <ArbitrageMonitor />
            </motion.div>

            {/* Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="glass-effect p-6 rounded-xl"
            >
              <h2 className="text-xl font-bold text-white mb-4">Recent Alerts</h2>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start space-x-3">
                    {alert.type === 'success' && (
                      <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5" />
                    )}
                    {alert.type === 'warning' && (
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                    )}
                    {alert.type === 'error' && (
                      <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-white text-sm">{alert.message}</p>
                      <p className="text-gray-400 text-xs">{alert.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}