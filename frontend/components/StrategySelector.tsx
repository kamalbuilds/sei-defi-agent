'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  BoltIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BeakerIcon,
  CubeIcon,
  StarIcon,
  ClockIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'

interface Strategy {
  id: string
  name: string
  category: 'arbitrage' | 'portfolio' | 'yield' | 'risk' | 'advanced'
  description: string
  estimatedApy: string
  riskLevel: 'low' | 'medium' | 'high'
  timeHorizon: 'minutes' | 'hours' | 'days' | 'weeks'
  minCapital: string
  features: string[]
  icon: React.ComponentType<{ className?: string }>
  complexity: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
}

const strategies: Strategy[] = [
  {
    id: 'basic-arbitrage',
    name: 'Basic Arbitrage',
    category: 'arbitrage',
    description: 'Simple cross-DEX arbitrage opportunities with automatic execution',
    estimatedApy: '12-18%',
    riskLevel: 'medium',
    timeHorizon: 'minutes',
    minCapital: '$1,000',
    features: ['Cross-DEX scanning', 'Gas optimization', 'MEV protection'],
    icon: BoltIcon,
    complexity: 'beginner',
    tags: ['Popular', 'Quick Returns']
  },
  {
    id: 'portfolio-rebalance',
    name: 'Smart Rebalancing',
    category: 'portfolio',
    description: 'Automated portfolio rebalancing based on market conditions and targets',
    estimatedApy: '8-15%',
    riskLevel: 'low',
    timeHorizon: 'days',
    minCapital: '$5,000',
    features: ['Dynamic allocation', 'Tax optimization', 'Risk management'],
    icon: ChartBarIcon,
    complexity: 'beginner',
    tags: ['Stable', 'Long-term']
  },
  {
    id: 'yield-farming',
    name: 'Yield Farming Pro',
    category: 'yield',
    description: 'Advanced yield farming across multiple protocols with auto-compounding',
    estimatedApy: '20-35%',
    riskLevel: 'high',
    timeHorizon: 'weeks',
    minCapital: '$2,500',
    features: ['Auto-compounding', 'Multi-protocol', 'Impermanent loss protection'],
    icon: BeakerIcon,
    complexity: 'intermediate',
    tags: ['High Yield', 'DeFi 2.0']
  },
  {
    id: 'risk-management',
    name: 'Risk Guardian',
    category: 'risk',
    description: 'Comprehensive risk management with stop-losses and hedging strategies',
    estimatedApy: '5-10%',
    riskLevel: 'low',
    timeHorizon: 'hours',
    minCapital: '$1,500',
    features: ['Stop-loss automation', 'Position hedging', 'Volatility protection'],
    icon: ShieldCheckIcon,
    complexity: 'beginner',
    tags: ['Safe', 'Protection']
  },
  {
    id: 'mev-sandwich',
    name: 'MEV Sandwich',
    category: 'advanced',
    description: 'Advanced MEV extraction through sandwich attacks and frontrunning',
    estimatedApy: '25-50%',
    riskLevel: 'high',
    timeHorizon: 'minutes',
    minCapital: '$10,000',
    features: ['Mempool monitoring', 'Gas auction bidding', 'Profit optimization'],
    icon: CubeIcon,
    complexity: 'advanced',
    tags: ['Expert Only', 'High Risk/Reward']
  },
  {
    id: 'liquidation-bot',
    name: 'Liquidation Hunter',
    category: 'advanced',
    description: 'Automated liquidation bot for lending protocols with profit maximization',
    estimatedApy: '15-30%',
    riskLevel: 'medium',
    timeHorizon: 'hours',
    minCapital: '$7,500',
    features: ['Health factor monitoring', 'Flash loan integration', 'Multi-protocol support'],
    icon: BanknotesIcon,
    complexity: 'intermediate',
    tags: ['Opportunistic', 'DeFi Lending']
  }
]

interface StrategySelectorProps {
  onStrategySelect: (strategy: Strategy) => void
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'low':
      return 'text-green-400'
    case 'medium':
      return 'text-yellow-400'
    case 'high':
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
}

const getComplexityColor = (complexity: string) => {
  switch (complexity) {
    case 'beginner':
      return 'bg-green-900 text-green-300'
    case 'intermediate':
      return 'bg-yellow-900 text-yellow-300'
    case 'advanced':
      return 'bg-red-900 text-red-300'
    default:
      return 'bg-gray-900 text-gray-300'
  }
}

export default function StrategySelector({ onStrategySelect }: StrategySelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null)

  const categories = [
    { id: 'all', name: 'All Strategies', count: strategies.length },
    { id: 'arbitrage', name: 'Arbitrage', count: strategies.filter(s => s.category === 'arbitrage').length },
    { id: 'portfolio', name: 'Portfolio', count: strategies.filter(s => s.category === 'portfolio').length },
    { id: 'yield', name: 'Yield Farming', count: strategies.filter(s => s.category === 'yield').length },
    { id: 'risk', name: 'Risk Management', count: strategies.filter(s => s.category === 'risk').length },
    { id: 'advanced', name: 'Advanced', count: strategies.filter(s => s.category === 'advanced').length },
  ]

  const filteredStrategies = selectedCategory === 'all' 
    ? strategies 
    : strategies.filter(s => s.category === selectedCategory)

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-primary-600 text-white'
                : 'glass-effect text-gray-300 hover:bg-white/10'
            }`}
          >
            {category.name} ({category.count})
          </button>
        ))}
      </div>

      {/* Strategy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredStrategies.map((strategy, index) => (
          <motion.div
            key={strategy.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`glass-effect p-6 rounded-xl cursor-pointer transition-all hover:bg-white/5 ${
              selectedStrategy === strategy.id ? 'ring-2 ring-primary-500' : ''
            }`}
            onClick={() => setSelectedStrategy(strategy.id)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-primary-600 to-accent-600 rounded-lg flex items-center justify-center">
                  <strategy.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{strategy.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(strategy.complexity)}`}>
                      {strategy.complexity}
                    </span>
                    <span className={`text-sm ${getRiskColor(strategy.riskLevel)}`}>
                      {strategy.riskLevel} risk
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {strategy.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-accent-900 text-accent-300 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-300 text-sm mb-4 line-clamp-2">
              {strategy.description}
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  <StarIcon className="h-4 w-4 text-yellow-400" />
                  <span className="text-gray-400 text-xs">Est. APY</span>
                </div>
                <p className="text-white font-semibold">{strategy.estimatedApy}</p>
              </div>
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  <ClockIcon className="h-4 w-4 text-blue-400" />
                  <span className="text-gray-400 text-xs">Time Horizon</span>
                </div>
                <p className="text-white font-semibold capitalize">{strategy.timeHorizon}</p>
              </div>
            </div>

            {/* Min Capital */}
            <div className="mb-4">
              <div className="flex items-center space-x-1 mb-1">
                <BanknotesIcon className="h-4 w-4 text-green-400" />
                <span className="text-gray-400 text-xs">Min Capital</span>
              </div>
              <p className="text-white font-semibold">{strategy.minCapital}</p>
            </div>

            {/* Features */}
            <div className="mb-4">
              <h4 className="text-gray-400 text-xs mb-2">Key Features:</h4>
              <div className="space-y-1">
                {strategy.features.slice(0, 3).map((feature) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                    <span className="text-gray-300 text-xs">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStrategySelect(strategy)
              }}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
            >
              Deploy Strategy
            </button>
          </motion.div>
        ))}
      </div>

      {/* Strategy Details Modal */}
      {selectedStrategy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-effect p-8 rounded-xl max-w-2xl w-full mx-4"
          >
            {(() => {
              const strategy = strategies.find(s => s.id === selectedStrategy)!
              return (
                <>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-primary-600 to-accent-600 rounded-lg flex items-center justify-center">
                        <strategy.icon className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{strategy.name}</h2>
                        <p className="text-gray-300">{strategy.category}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedStrategy(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-6">
                    <p className="text-gray-300">{strategy.description}</p>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-white font-medium mb-2">Performance</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Est. APY:</span>
                              <span className="text-white">{strategy.estimatedApy}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Risk Level:</span>
                              <span className={getRiskColor(strategy.riskLevel)}>{strategy.riskLevel}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Time Horizon:</span>
                              <span className="text-white">{strategy.timeHorizon}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-white font-medium mb-2">Requirements</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Min Capital:</span>
                              <span className="text-white">{strategy.minCapital}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Complexity:</span>
                              <span className={`px-2 py-1 rounded-full text-xs ${getComplexityColor(strategy.complexity)}`}>
                                {strategy.complexity}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-3">Features</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {strategy.features.map((feature) => (
                          <div key={feature} className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-primary-400 rounded-full" />
                            <span className="text-gray-300 text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={() => setSelectedStrategy(null)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => {
                          onStrategySelect(strategy)
                          setSelectedStrategy(null)
                        }}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                      >
                        Deploy Strategy
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}
          </motion.div>
        </div>
      )}
    </div>
  )
}