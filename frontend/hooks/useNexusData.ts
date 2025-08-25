import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import apiClient, { Agent, Portfolio, ArbitrageOpportunity } from '../lib/api-client';

export interface NexusData {
  agents: Agent[];
  portfolio: Portfolio | null;
  arbitrageOpportunities: ArbitrageOpportunity[];
  alerts: Alert[];
  metrics: any;
  isConnected: boolean;
  isLoading: boolean;
}

export interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export function useNexusData() {
  const { address } = useAccount();
  const [data, setData] = useState<NexusData>({
    agents: [],
    portfolio: null,
    arbitrageOpportunities: [],
    alerts: [],
    metrics: {},
    isConnected: false,
    isLoading: true,
  });

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!address) return;

    try {
      const [agents, portfolio, opportunities, metrics] = await Promise.all([
        apiClient.getAgents(),
        apiClient.getPortfolio(address),
        apiClient.getArbitrageOpportunities(),
        apiClient.getMetrics(),
      ]);

      setData(prev => ({
        ...prev,
        agents,
        portfolio,
        arbitrageOpportunities: opportunities,
        metrics,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [address]);

  // Set up WebSocket connection
  useEffect(() => {
    const socket = apiClient.connectWebSocket(
      () => {
        setData(prev => ({ ...prev, isConnected: true }));
      },
      () => {
        setData(prev => ({ ...prev, isConnected: false }));
      },
      (error) => {
        console.error('WebSocket error:', error);
        addAlert('error', 'WebSocket connection error');
      }
    );

    // Subscribe to real-time updates
    apiClient.subscribeToPortfolioUpdates((portfolio) => {
      setData(prev => ({ ...prev, portfolio }));
    });

    apiClient.subscribeToArbitrage((opportunity) => {
      setData(prev => ({
        ...prev,
        arbitrageOpportunities: [opportunity, ...prev.arbitrageOpportunities].slice(0, 10),
      }));
      addAlert('info', `New arbitrage opportunity: ${opportunity.token} - Est. profit: ${opportunity.profitEstimate}`);
    });

    apiClient.subscribeToAlerts((alert) => {
      addAlert(alert.type || 'info', alert.message);
    });

    // Subscribe to each agent's updates
    data.agents.forEach(agent => {
      apiClient.subscribeToAgentUpdates(agent.id, (update) => {
        setData(prev => ({
          ...prev,
          agents: prev.agents.map(a => 
            a.id === agent.id ? { ...a, ...update } : a
          ),
        }));
      });
    });

    fetchData();

    // Refresh data periodically
    const interval = setInterval(fetchData, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
      apiClient.disconnect();
    };
  }, [address, fetchData]);

  const addAlert = useCallback((type: Alert['type'], message: string) => {
    const alert: Alert = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };

    setData(prev => ({
      ...prev,
      alerts: [alert, ...prev.alerts].slice(0, 20), // Keep last 20 alerts
    }));
  }, []);

  const executeArbitrage = useCallback(async (opportunityId: string) => {
    try {
      const success = await apiClient.executeArbitrage(opportunityId);
      if (success) {
        addAlert('success', 'Arbitrage executed successfully');
        // Remove the opportunity from the list
        setData(prev => ({
          ...prev,
          arbitrageOpportunities: prev.arbitrageOpportunities.filter(o => o.id !== opportunityId),
        }));
      } else {
        addAlert('error', 'Failed to execute arbitrage');
      }
    } catch (error) {
      console.error('Error executing arbitrage:', error);
      addAlert('error', 'Error executing arbitrage');
    }
  }, [addAlert]);

  const startAgent = useCallback(async (agentId: string) => {
    try {
      const success = await apiClient.startAgent(agentId);
      if (success) {
        addAlert('success', `Agent ${agentId} started`);
        setData(prev => ({
          ...prev,
          agents: prev.agents.map(a => 
            a.id === agentId ? { ...a, status: 'active' } : a
          ),
        }));
      } else {
        addAlert('error', `Failed to start agent ${agentId}`);
      }
    } catch (error) {
      console.error('Error starting agent:', error);
      addAlert('error', 'Error starting agent');
    }
  }, [addAlert]);

  const stopAgent = useCallback(async (agentId: string) => {
    try {
      const success = await apiClient.stopAgent(agentId);
      if (success) {
        addAlert('info', `Agent ${agentId} stopped`);
        setData(prev => ({
          ...prev,
          agents: prev.agents.map(a => 
            a.id === agentId ? { ...a, status: 'idle' } : a
          ),
        }));
      } else {
        addAlert('error', `Failed to stop agent ${agentId}`);
      }
    } catch (error) {
      console.error('Error stopping agent:', error);
      addAlert('error', 'Error stopping agent');
    }
  }, [addAlert]);

  const updateAgentConfig = useCallback(async (agentId: string, config: any) => {
    try {
      const success = await apiClient.updateAgentConfig(agentId, config);
      if (success) {
        addAlert('success', `Agent ${agentId} configuration updated`);
        fetchData(); // Refresh data to get updated config
      } else {
        addAlert('error', `Failed to update agent ${agentId} configuration`);
      }
    } catch (error) {
      console.error('Error updating agent config:', error);
      addAlert('error', 'Error updating agent configuration');
    }
  }, [addAlert, fetchData]);

  return {
    ...data,
    executeArbitrage,
    startAgent,
    stopAgent,
    updateAgentConfig,
    addAlert,
    refreshData: fetchData,
  };
}

export default useNexusData;