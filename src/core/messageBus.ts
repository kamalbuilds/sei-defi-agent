// Message Bus for Agent Communication
import EventEmitter from 'events';
import { logger } from '../utils/logger';
import { AgentMessage } from '../types';

class MessageBus extends EventEmitter {
  private subscribers: Map<string, Set<string>> = new Map();
  
  constructor() {
    super();
    this.setMaxListeners(100); // Support many agents
  }
  
  // Subscribe an agent to a topic
  subscribe(agentId: string, topic: string): void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(agentId);
    logger.debug(`Agent ${agentId} subscribed to topic: ${topic}`);
  }
  
  // Unsubscribe an agent from a topic
  unsubscribe(agentId: string, topic: string): void {
    const topicSubs = this.subscribers.get(topic);
    if (topicSubs) {
      topicSubs.delete(agentId);
      if (topicSubs.size === 0) {
        this.subscribers.delete(topic);
      }
    }
  }
  
  // Publish a message to a topic
  publish(topic: string, message: AgentMessage): void {
    const subscribers = this.subscribers.get(topic);
    if (subscribers && subscribers.size > 0) {
      this.emit(topic, message);
      logger.debug(`Message published to ${topic} for ${subscribers.size} subscribers`);
    }
  }
  
  // Send direct message to an agent
  send(agentId: string, message: AgentMessage): void {
    this.emit(`agent:${agentId}`, message);
  }
  
  // Broadcast to all agents
  broadcast(message: AgentMessage): void {
    this.emit('broadcast', message);
    logger.debug('Message broadcasted to all agents');
  }
  
  // Get all topics
  getTopics(): string[] {
    return Array.from(this.subscribers.keys());
  }
  
  // Get subscribers for a topic
  getSubscribers(topic: string): string[] {
    const subs = this.subscribers.get(topic);
    return subs ? Array.from(subs) : [];
  }
}

// Export singleton instance
export const messageBus = new MessageBus();

export default messageBus;