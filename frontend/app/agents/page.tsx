'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  PlusIcon,
  CpuChipIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  Cog6ToothIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import Navigation from '@/components/ui/Navigation'
import AgentCard from '@/components/AgentCard'
import StrategySelector from '@/components/StrategySelector'

const mockAgents = [
  {
    id: '1',
    name: 'Arbitrage Hunter Pro',
    type: 'arbitrage',
    status: 'active',
    performance: '+12.5%',
    lastAction: '2 minutes ago',
    description: 'Advanced cross-DEX arbitrage with MEV protection',
    config: {
      minProfitThreshold: 0.5,
      maxSlippage: 0.1,
      gasLimit: 500000
    }
  },
  {
    id: '2',
    name: 'Portfolio Balancer',
    type: 'portfolio',
    status: 'active',
    performance: '+8.3%',
    lastAction: '5 minutes ago',
    description: 'Automated portfolio rebalancing and optimization',
    config: {
      rebalanceThreshold: 5,
      targetAllocations: { ETH: 40, BTC: 30, USDC: 30 }
    }
  },
  {
    id: '3',
    name: 'Risk Guardian',
    type: 'risk',
    status: 'idle',
    performance: '+3.1%',
    lastAction: '15 minutes ago',
    description: 'Real-time risk monitoring and stop-loss execution',
    config: {
      maxDrawdown: 5,
      stopLossThreshold: 10
    }
  },
  {
    id: '4',
    name: 'Yield Maximizer',
    type: 'yield',
    status: 'active',
    performance: '+15.7%',
    lastAction: '1 minute ago',
    description: 'Automated yield farming across multiple protocols',
    config: {
      minApy: 8,
      autoCompound: true
    }
  },
  {
    id: '5',
    name: 'Liquidation Bot',
    type: 'liquidation',
    status: 'paused',
    performance: '+22.1%',
    lastAction: '1 hour ago',
    description: 'Monitors and executes profitable liquidations',
    config: {
      healthFactorThreshold: 1.1,
      gasBuffer: 20
    }
  },
  {
    id: '6',
    name: 'MEV Sandwich',
    type: 'mev',
    status: 'error',
    performance: '-2.3%',
    lastAction: '30 minutes ago',
    description: 'Sandwich attack detection and execution',
    config: {
      minProfit: 100,
      maxGasPrice: 150
    }
  }
]

const agentTypes = [
  { id: 'arbitrage', name: 'Arbitrage', description: 'Cross-DEX price differences' },
  { id: 'portfolio', name: 'Portfolio Management', description: 'Automated rebalancing' },
  { id: 'risk', name: 'Risk Management', description: 'Stop-loss and hedging' },
  { id: 'yield', name: 'Yield Farming', description: 'Maximize farming rewards' },
  { id: 'liquidation', name: 'Liquidation', description: 'Profitable liquidations' },
  { id: 'mev', name: 'MEV', description: 'Maximal extractable value' },
]

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState('all')

  const filteredAgents = mockAgents.filter(agent => 
    filter === 'all' || agent.status === filter || agent.type === filter
  )

  const handleAgentAction = (agentId: string, action: 'start' | 'pause' | 'stop' | 'configure') => {
    console.log(`${action} agent ${agentId}`)
    // Implementation would go here
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">AI Agents</h1>
              <p className="text-gray-300">
                Manage your automated trading and portfolio agents
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Create Agent</span>
            </button>
          </div>

          {/* Filters */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              {['all', 'active', 'idle', 'paused', 'error', ...agentTypes.map(t => t.id)].map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === filterOption
                      ? 'bg-primary-600 text-white'
                      : 'glass-effect text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredAgents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <AgentCard 
                  agent={agent} 
                  onSelect={() => setSelectedAgent(agent.id)}
                  isSelected={selectedAgent === agent.id}
                />
                
                {/* Agent Controls */}
                <div className="absolute top-4 right-4 flex space-x-2">
                  {agent.status === 'active' ? (
                    <button
                      onClick={() => handleAgentAction(agent.id, 'pause')}
                      className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                      title="Pause Agent"
                    >
                      <PauseIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAgentAction(agent.id, 'start')}
                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      title="Start Agent"
                    >
                      <PlayIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleAgentAction(agent.id, 'configure')}
                    className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    title="Configure Agent"
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleAgentAction(agent.id, 'stop')}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    title="Stop Agent"
                  >
                    <StopIcon className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Agent Details */}
          {selectedAgent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-effect p-8 rounded-xl mb-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Agent Configuration</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration Form */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
                  <div className="space-y-4">
                    {Object.entries(mockAgents.find(a => a.id === selectedAgent)?.config || {}).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </label>
                        <input
                          type={typeof value === 'number' ? 'number' : 'text'}
                          defaultValue={typeof value === 'object' ? JSON.stringify(value) : value}
                          className="w-full bg-dark-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex space-x-4">
                    <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors">
                      Save Configuration
                    </button>
                    <button className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors">
                      Reset to Default
                    </button>
                  </div>
                </div>

                {/* Performance Chart */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Performance History</h3>
                  <div className="bg-dark-800 rounded-lg p-4 h-64 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <ChartBarIcon className="h-12 w-12 mx-auto mb-2" />
                      <p>Performance chart would go here</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Strategy Templates */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Strategy Templates</h2>
            <StrategySelector onStrategySelect={(strategy) => console.log('Selected strategy:', strategy)} />
          </div>
        </div>
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-effect p-8 rounded-xl max-w-2xl w-full mx-4"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Create New Agent</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {agentTypes.map((type) => (
                <button
                  key={type.id}
                  className="glass-effect p-4 rounded-lg text-left hover:bg-white/10 transition-colors"
                >
                  <h3 className="text-white font-semibold mb-2">{type.name}</h3>
                  <p className="text-gray-300 text-sm">{type.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors">
                Create Agent
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}