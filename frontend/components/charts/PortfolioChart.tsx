'use client'

import React, { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PortfolioChartProps {
  timeframe?: string
  type?: 'line' | 'bar'
}

// Mock data generation
const generatePortfolioData = (timeframe: string) => {
  const dataPoints = timeframe === '1h' ? 24 : 
                    timeframe === '24h' ? 24 : 
                    timeframe === '7d' ? 7 : 
                    timeframe === '30d' ? 30 : 
                    timeframe === '90d' ? 90 : 365

  const labels = []
  const values = []
  const baseValue = 82000

  for (let i = 0; i < dataPoints; i++) {
    let label = ''
    if (timeframe === '1h') {
      label = `${23 - i}:00`
    } else if (timeframe === '24h') {
      label = `${23 - i}:00`
    } else if (timeframe === '7d') {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      label = date.toLocaleDateString('en-US', { weekday: 'short' })
    } else if (timeframe === '30d') {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      const date = new Date()
      date.setDate(date.getDate() - (dataPoints - 1 - i))
      label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    
    labels.push(label)
    
    // Generate realistic portfolio growth with some volatility
    const trend = baseValue * (1 + (i / dataPoints) * 0.15) // 15% overall growth
    const volatility = (Math.random() - 0.5) * 0.05 * baseValue // 5% daily volatility
    values.push(Math.max(trend + volatility, baseValue * 0.9))
  }

  return { labels, values }
}

export default function PortfolioChart({ timeframe = '30d', type = 'line' }: PortfolioChartProps) {
  const { labels, values } = generatePortfolioData(timeframe)

  const data = {
    labels,
    datasets: [
      {
        label: 'Portfolio Value',
        data: values,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: type === 'line' 
          ? 'rgba(59, 130, 246, 0.1)' 
          : 'rgba(59, 130, 246, 0.8)',
        borderWidth: 2,
        fill: type === 'line',
        tension: 0.4,
        pointRadius: type === 'line' ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'rgba(255, 255, 255, 0.8)',
        pointBorderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            return `$${context.parsed.y.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 11,
          },
          maxTicksLimit: 8,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 11,
          },
          callback: (value: any) => {
            return `$${(value / 1000).toFixed(0)}k`
          },
        },
        beginAtZero: false,
      },
    },
    elements: {
      point: {
        hoverRadius: 8,
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  const ChartComponent = type === 'line' ? Line : Bar

  return (
    <div className="h-64 w-full">
      <ChartComponent data={data} options={options} />
    </div>
  )
}