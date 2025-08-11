import { EventEmitter } from 'events';

/**
 * Simple PubSub implementation for GraphQL subscriptions
 * Provides publish/subscribe functionality with async iterators
 */
export class PubSub {
  private eventEmitter: EventEmitter;
  private subscriptions: Map<string, Set<AsyncIterator<any>>>;
  private subscriptionId: number;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.subscriptions = new Map();
    this.subscriptionId = 0;
  }

  /**
   * Publish data to a trigger/topic
   * @param triggerName - The topic/trigger name to publish to
   * @param payload - The data payload to publish
   */
  publish(triggerName: string, payload: any): Promise<void> {
    return new Promise((resolve) => {
      setImmediate(() => {
        this.eventEmitter.emit(triggerName, payload);
        resolve();
      });
    });
  }

  /**
   * Subscribe to a trigger/topic
   * @param triggerName - The topic/trigger name to subscribe to
   * @param onMessage - Callback function for incoming messages
   * @returns Subscription ID for unsubscribing
   */
  subscribe(triggerName: string, onMessage: (payload: any) => void): Promise<number> {
    return new Promise((resolve) => {
      const subId = this.subscriptionId++;
      const listener = (payload: any) => {
        onMessage(payload);
      };

      this.eventEmitter.on(triggerName, listener);
      
      // Store reference for cleanup
      if (!this.subscriptions.has(triggerName)) {
        this.subscriptions.set(triggerName, new Set());
      }

      resolve(subId);
    });
  }

  /**
   * Unsubscribe from a trigger/topic
   * @param subId - Subscription ID to unsubscribe
   */
  unsubscribe(subId: number): void {
    // In a real implementation, you'd track subscription IDs
    // For this mock, we'll implement basic cleanup
    this.eventEmitter.removeAllListeners();
  }

  /**
   * Create an async iterator for GraphQL subscriptions
   * @param triggers - Single trigger or array of triggers to listen to
   * @param options - Additional options for filtering
   * @returns AsyncIterator for subscription data
   */
  asyncIterator<T = any>(
    triggers: string | string[],
    options?: {
      filter?: (payload: T, variables?: any, context?: any, info?: any) => boolean;
      resolve?: (payload: T, variables?: any, context?: any, info?: any) => T;
    }
  ): AsyncIterator<T> {
    const triggerNames = Array.isArray(triggers) ? triggers : [triggers];
    const pullQueue: T[] = [];
    const pushQueue: Array<{
      resolve: (result: IteratorResult<T>) => void;
      reject: (error: Error) => void;
    }> = [];
    let listening = true;

    const listeners = triggerNames.map(triggerName => {
      const listener = (payload: T) => {
        // Apply filter if provided
        if (options?.filter && !options.filter(payload)) {
          return;
        }

        // Apply resolve transformation if provided
        const resolvedPayload = options?.resolve ? options.resolve(payload) : payload;

        if (pushQueue.length > 0) {
          const { resolve } = pushQueue.shift()!;
          resolve({ value: resolvedPayload, done: false });
        } else {
          pullQueue.push(resolvedPayload);
        }
      };

      this.eventEmitter.on(triggerName, listener);
      return { triggerName, listener };
    });

    const cleanup = () => {
      listening = false;
      listeners.forEach(({ triggerName, listener }) => {
        this.eventEmitter.removeListener(triggerName, listener);
      });
    };

    return {
      async next(): Promise<IteratorResult<T>> {
        if (!listening) {
          return { value: undefined, done: true };
        }

        if (pullQueue.length > 0) {
          const value = pullQueue.shift()!;
          return { value, done: false };
        }

        return new Promise((resolve, reject) => {
          pushQueue.push({ resolve, reject });
        });
      },

      async return(): Promise<IteratorResult<T>> {
        cleanup();
        return { value: undefined, done: true };
      },

      async throw(error: Error): Promise<IteratorResult<T>> {
        cleanup();
        throw error;
      },

      [Symbol.asyncIterator](): AsyncIterator<T> {
        return this;
      }
    };
  }

  /**
   * Get the number of active listeners for a trigger
   * @param triggerName - The trigger name to check
   * @returns Number of listeners
   */
  getListenerCount(triggerName: string): number {
    return this.eventEmitter.listenerCount(triggerName);
  }

  /**
   * Remove all listeners and clean up resources
   */
  close(): void {
    this.eventEmitter.removeAllListeners();
    this.subscriptions.clear();
  }
}

/**
 * Singleton instance of PubSub for application-wide use
 */
export const pubsub = new PubSub();

/**
 * Common trigger names for the application
 */
export const TRIGGERS = {
  // Agent-related triggers
  AGENT_CREATED: 'AGENT_CREATED',
  AGENT_UPDATED: 'AGENT_UPDATED',
  AGENT_DELETED: 'AGENT_DELETED',
  AGENT_STATUS_CHANGED: 'AGENT_STATUS_CHANGED',
  
  // Portfolio-related triggers
  PORTFOLIO_UPDATED: 'PORTFOLIO_UPDATED',
  POSITION_CHANGED: 'POSITION_CHANGED',
  BALANCE_UPDATED: 'BALANCE_UPDATED',
  
  // Payment-related triggers
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_STATUS_CHANGED: 'PAYMENT_STATUS_CHANGED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  
  // Analytics-related triggers
  ANALYTICS_UPDATED: 'ANALYTICS_UPDATED',
  PERFORMANCE_CALCULATED: 'PERFORMANCE_CALCULATED',
  RISK_ASSESSMENT_UPDATED: 'RISK_ASSESSMENT_UPDATED',
  
  // System-wide triggers
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  SYSTEM_STATUS_CHANGED: 'SYSTEM_STATUS_CHANGED'
} as const;

export type TriggerName = typeof TRIGGERS[keyof typeof TRIGGERS];