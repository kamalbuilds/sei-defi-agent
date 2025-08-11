import Bull, { Job, Queue, QueueOptions } from 'bull';
import { Logger } from '../../utils/logger';
import { AgentMessage } from '../../types';
import Redis from 'ioredis';

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  };
}

export class MessageQueue {
  private queues: Map<string, Queue>;
  private logger: Logger;
  private redis: Redis;
  private config: QueueConfig;
  private isConnected: boolean = false;

  constructor(config?: QueueConfig) {
    this.logger = new Logger('MessageQueue');
    this.config = config || {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    };
    
    this.queues = new Map();
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.setupRedisListeners();
  }

  private setupRedisListeners(): void {
    this.redis.on('connect', () => {
      this.logger.info('Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
    });
  }

  async createQueue(name: string, options?: QueueOptions): Promise<Queue> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Bull(name, {
      redis: this.config.redis,
      defaultJobOptions: this.config.defaultJobOptions,
      ...options
    });

    // Setup event listeners
    queue.on('completed', (job: Job) => {
      this.logger.debug(`Job ${job.id} in queue ${name} completed`);
    });

    queue.on('failed', (job: Job, error: Error) => {
      this.logger.error(`Job ${job.id} in queue ${name} failed:`, error);
    });

    queue.on('stalled', (job: Job) => {
      this.logger.warn(`Job ${job.id} in queue ${name} stalled`);
    });

    this.queues.set(name, queue);
    return queue;
  }

  async addMessage(
    queueName: string,
    message: AgentMessage,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    }
  ): Promise<Job> {
    const queue = await this.getOrCreateQueue(queueName);
    
    const job = await queue.add(message.type, message, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
      attempts: options?.attempts || this.config.defaultJobOptions?.attempts,
      backoff: this.config.defaultJobOptions?.backoff
    });

    this.logger.debug(`Added message ${job.id} to queue ${queueName}`);
    return job;
  }

  async processQueue(
    queueName: string,
    processor: (job: Job<AgentMessage>) => Promise<any>,
    concurrency: number = 1
  ): Promise<void> {
    const queue = await this.getOrCreateQueue(queueName);
    
    queue.process(concurrency, async (job: Job<AgentMessage>) => {
      try {
        this.logger.debug(`Processing job ${job.id} from queue ${queueName}`);
        const result = await processor(job);
        return result;
      } catch (error) {
        this.logger.error(`Error processing job ${job.id}:`, error);
        throw error;
      }
    });
  }

  async addBulkMessages(
    queueName: string,
    messages: AgentMessage[],
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<Job[]> {
    const queue = await this.getOrCreateQueue(queueName);
    
    const jobs = messages.map(message => ({
      name: message.type,
      data: message,
      opts: {
        priority: options?.priority || 0,
        delay: options?.delay || 0,
        attempts: this.config.defaultJobOptions?.attempts,
        backoff: this.config.defaultJobOptions?.backoff
      }
    }));

    const results = await queue.addBulk(jobs);
    this.logger.info(`Added ${results.length} messages to queue ${queueName}`);
    return results;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = await this.getOrCreateQueue(queueName);
    return queue.getJob(jobId);
  }

  async getQueueStatus(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const queue = await this.getOrCreateQueue(queueName);
    
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = await this.getOrCreateQueue(queueName);
    await queue.pause();
    this.logger.info(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = await this.getOrCreateQueue(queueName);
    await queue.resume();
    this.logger.info(`Queue ${queueName} resumed`);
  }

  async cleanQueue(queueName: string, grace: number = 0, status?: 'completed' | 'failed'): Promise<Job[]> {
    const queue = await this.getOrCreateQueue(queueName);
    
    if (status === 'completed') {
      return queue.clean(grace, 'completed');
    } else if (status === 'failed') {
      return queue.clean(grace, 'failed');
    } else {
      const completed = await queue.clean(grace, 'completed');
      const failed = await queue.clean(grace, 'failed');
      return [...completed, ...failed];
    }
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.logger.debug(`Removed job ${jobId} from queue ${queueName}`);
    }
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.retry();
      this.logger.debug(`Retrying job ${jobId} in queue ${queueName}`);
    }
  }

  async getMetrics(): Promise<Map<string, any>> {
    const metrics = new Map();
    
    for (const [name, queue] of this.queues) {
      const status = await this.getQueueStatus(name);
      metrics.set(name, status);
    }
    
    return metrics;
  }

  private async getOrCreateQueue(name: string): Promise<Queue> {
    if (!this.queues.has(name)) {
      return this.createQueue(name);
    }
    return this.queues.get(name)!;
  }

  async close(): Promise<void> {
    this.logger.info('Closing all queues...');
    
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.debug(`Queue ${name} closed`);
    }
    
    await this.redis.quit();
    this.queues.clear();
    this.isConnected = false;
    this.logger.info('All queues closed');
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance for easy use
export const messageQueue = new MessageQueue();

// Export function for custom configuration
export function createMessageQueue(config: QueueConfig): MessageQueue {
  return new MessageQueue(config);
}