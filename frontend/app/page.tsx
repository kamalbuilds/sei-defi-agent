'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  RocketLaunchIcon, 
  ChartBarIcon, 
  CpuChipIcon,
  BoltIcon,
  ShieldCheckIcon,
  GlobeAltIcon 
} from '@heroicons/react/24/outline'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const features = [
  {
    name: 'AI-Powered Trading',
    description: 'Advanced machine learning algorithms analyze market patterns and execute optimal trades across multiple DeFi protocols.',
    icon: CpuChipIcon,
  },
  {
    name: 'Real-Time Analytics',
    description: 'Comprehensive dashboard with live market data, portfolio performance, and risk assessments.',
    icon: ChartBarIcon,
  },
  {
    name: 'Lightning Fast Execution',
    description: 'Sub-second trade execution with MEV protection and optimal routing across DEXs.',
    icon: BoltIcon,
  },
  {
    name: 'Advanced Security',
    description: 'Multi-signature wallets, smart contract audits, and real-time security monitoring.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Cross-Chain Support',
    description: 'Seamlessly trade across Ethereum, Polygon, Arbitrum, and Optimism networks.',
    icon: GlobeAltIcon,
  },
  {
    name: 'Automated Strategies',
    description: 'Deploy sophisticated arbitrage, yield farming, and portfolio rebalancing strategies.',
    icon: RocketLaunchIcon,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 glass-effect">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                NEXUS AI
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ConnectButton />
              <Link
                href="/dashboard"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Launch App
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-6xl font-bold text-white mb-6">
              The Future of{' '}
              <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                DeFi Trading
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
              Harness the power of artificial intelligence to maximize your DeFi returns.
              Advanced trading algorithms, real-time analytics, and automated strategies
              in one comprehensive platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
              >
                Start Trading Now
              </Link>
              <button className="border border-primary-400 text-primary-400 hover:bg-primary-400 hover:text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all">
                View Documentation
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
          >
            <div className="glass-effect p-8 rounded-2xl">
              <div className="text-4xl font-bold text-primary-400 mb-2">$50M+</div>
              <div className="text-gray-300">Total Value Locked</div>
            </div>
            <div className="glass-effect p-8 rounded-2xl">
              <div className="text-4xl font-bold text-secondary-400 mb-2">15.7%</div>
              <div className="text-gray-300">Average APY</div>
            </div>
            <div className="glass-effect p-8 rounded-2xl">
              <div className="text-4xl font-bold text-accent-400 mb-2">10K+</div>
              <div className="text-gray-300">Active Users</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-white mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Everything you need to succeed in DeFi, powered by cutting-edge AI technology.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 + index * 0.1 }}
                className="glass-effect p-8 rounded-2xl hover:bg-white/5 transition-all"
              >
                <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.name}
                </h3>
                <p className="text-gray-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="glass-effect p-12 rounded-3xl text-center"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Maximize Your DeFi Returns?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of traders already using NEXUS AI to outperform the market.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white px-10 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
            >
              Get Started Today
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 NEXUS AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}