'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  CpuChipIcon,
  ChartBarIcon,
  PlayIcon,
  PauseIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface Agent {
  id: string
  name: string
  type: string
  status: 'active' | 'idle' | 'paused' | 'error'
  performance: string
  lastAction: string
  description: string
}

interface AgentCardProps {
  agent: Agent
  onSelect?: () => void
  isSelected?: boolean
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-green-400'
    case 'idle':
      return 'text-yellow-400'
    case 'paused':
      return 'text-blue-400'
    case 'error':
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active':
      return <CheckCircleIcon className="h-5 w-5 text-green-400" />
    case 'idle':
      return <PauseIcon className="h-5 w-5 text-yellow-400" />
    case 'paused':
      return <PauseIcon className="h-5 w-5 text-blue-400" />
    case 'error':
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
    default:
      return <CpuChipIcon className="h-5 w-5 text-gray-400" />
  }
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'arbitrage':
      return '⚡'
    case 'portfolio':
      return '📊'
    case 'risk':
      return '🛡️'
    case 'yield':
      return '🌱'
    case 'liquidation':
      return '💥'
    case 'mev':
      return '🎯'
    default:
      return '🤖'
  }
}

export default function AgentCard({ agent, onSelect, isSelected = false }: AgentCardProps) {
  const isPositivePerformance = agent.performance.startsWith('+')

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`glass-effect p-6 rounded-xl cursor-pointer transition-all duration-300 ${
        isSelected ? 'ring-2 ring-primary-500' : 'hover:bg-white/5'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-primary-600 to-accent-600 rounded-lg flex items-center justify-center text-2xl">
            {getTypeIcon(agent.type)}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">{agent.name}</h3>
            <p className="text-gray-400 text-sm capitalize">{agent.type}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getStatusIcon(agent.status)}
          <span className={`text-sm font-medium capitalize ${getStatusColor(agent.status)}`}>
            {agent.status}
          </span>
        </div>
      </div>

      {/* Performance */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">Performance</span>
          <div className="flex items-center space-x-1">
            {isPositivePerformance ? (
              <ChartBarIcon className="h-4 w-4 text-green-400" />
            ) : (
              <ChartBarIcon className="h-4 w-4 text-red-400" />
            )}
            <span className={`font-bold ${
              isPositivePerformance ? 'text-green-400' : 'text-red-400'
            }`}>
              {agent.performance}
            </span>
          </div>
        </div>
        
        {/* Performance Bar */}
        <div className="mt-2 bg-dark-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              isPositivePerformance ? 'bg-green-400' : 'bg-red-400'
            }`}
            style={{
              width: `${Math.min(Math.abs(parseFloat(agent.performance.replace('%', ''))), 100)}%`
            }}
          />
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm mb-4 line-clamp-2">
        {agent.description}
      </p>

      {/* Last Action */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Last action:</span>
        <span className="text-gray-300">{agent.lastAction}</span>
      </div>

      {/* Status Indicator */}
      <div className="mt-4 flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          agent.status === 'active' ? 'bg-green-400 animate-pulse' :
          agent.status === 'idle' ? 'bg-yellow-400' :
          agent.status === 'paused' ? 'bg-blue-400' :
          'bg-red-400 animate-pulse'
        }`} />
        <span className="text-xs text-gray-400">
          {agent.status === 'active' ? 'Running...' :
           agent.status === 'idle' ? 'Waiting for opportunities' :
           agent.status === 'paused' ? 'Paused by user' :
           'Error - needs attention'}
        </span>
      </div>
    </motion.div>
  )
}