import { Logger } from '../../utils/logger';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  database: number;
  keyPrefix: string;
  defaultTTL: number;
  maxRetries: number;
  retryDelayOnFailover: number;
}

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  serialize?: boolean;
  namespace?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
  memoryUsage: number;
  uptime: number;
}

export interface CacheEntry<T = any> {
  value: T;
  createdAt: Date;
  expiresAt: Date;
  compressed?: boolean;
  size: number;
}

export class CacheService {
  private logger = new Logger('CacheService');
  private config: CacheConfig;
  private connected: boolean = false;
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    keys: 0,
    hitRate: 0,
    memoryUsage: 0,
    uptime: 0
  };
  private startTime: Date = new Date();

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.CACHE_PREFIX || 'nexus:',
      defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'), // 1 hour
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      ...config
    };

    this.logger.info('Cache service initialized', { 
      host: this.config.host, 
      prefix: this.config.keyPrefix 
    });

    // Start cleanup interval
    this.startCleanupInterval();
  }

  async connect(): Promise<void> {
    try {
      // Mock connection - in production, use Redis client
      this.connected = true;
      this.startTime = new Date();
      
      this.logger.info('Connected to cache', { 
        host: this.config.host,
        database: this.config.database
      });
    } catch (error) {
      this.logger.error('Failed to connect to cache', { error: (error as any).message });
      throw new Error('Cache connection failed');
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.connected = false;
      this.logger.info('Disconnected from cache');
    } catch (error) {
      this.logger.error('Error disconnecting from cache', { error: (error as any).message });
    }
  }

  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace ? `${namespace}:` : '';
    return `${this.config.keyPrefix}${ns}${key}`;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const fullKey = this.getFullKey(key, options.namespace);
    const ttl = options.ttl || this.config.defaultTTL;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    let serializedValue = value;
    let compressed = false;

    // Serialize if requested or if value is not a string
    if (options.serialize || typeof value !== 'string') {
      serializedValue = JSON.stringify(value) as any;
    }

    // Mock compression
    if (options.compress && typeof serializedValue === 'string' && serializedValue.length > 1000) {
      compressed = true;
      // In production, use actual compression library
    }

    const entry: CacheEntry<T> = {
      value: serializedValue,
      createdAt: new Date(),
      expiresAt,
      compressed,
      size: this.calculateSize(serializedValue)
    };

    this.cache.set(fullKey, entry);
    this.updateStats();

    this.logger.debug('Cache entry set', { 
      key: fullKey, 
      ttl, 
      size: entry.size,
      compressed 
    });
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.connected) {
      await this.connect();
    }

    const fullKey = this.getFullKey(key, options.namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      this.logger.debug('Cache miss', { key: fullKey });
      return null;
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      this.updateHitRate();
      this.logger.debug('Cache expired', { key: fullKey });
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();

    let value = entry.value;

    // Decompress if needed
    if (entry.compressed) {
      // In production, use actual decompression
    }

    // Deserialize if it's a string that looks like JSON
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        value = JSON.parse(value);
      } catch (error) {
        this.logger.warn('Failed to parse cached JSON', { key: fullKey });
      }
    }

    this.logger.debug('Cache hit', { key: fullKey, size: entry.size });
    return value as T;
  }

  async del(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.getFullKey(key, options.namespace);
    const deleted = this.cache.delete(fullKey);
    
    if (deleted) {
      this.updateStats();
      this.logger.debug('Cache entry deleted', { key: fullKey });
    }
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.getFullKey(key, options.namespace);
    const entry = this.cache.get(fullKey);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.getFullKey(key, options.namespace);
    const entry = this.cache.get(fullKey);
    
    if (entry) {
      entry.expiresAt = new Date(Date.now() + ttl * 1000);
      this.cache.set(fullKey, entry);
      this.logger.debug('Cache entry TTL updated', { key: fullKey, ttl });
    }
  }

  async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    const fullKey = this.getFullKey(key, options.namespace);
    const entry = this.cache.get(fullKey);
    
    if (!entry) {
      return -2; // Key doesn't exist
    }

    const remainingTime = Math.max(0, entry.expiresAt.getTime() - Date.now());
    return Math.floor(remainingTime / 1000);
  }

  async keys(pattern: string = '*', options: CacheOptions = {}): Promise<string[]> {
    const prefix = this.getFullKey('', options.namespace);
    const keys: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        const cleanKey = key.replace(prefix, '');
        if (this.matchesPattern(cleanKey, pattern)) {
          keys.push(cleanKey);
        }
      }
    }

    this.logger.debug('Keys retrieved', { pattern, count: keys.length });
    return keys;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    // Simple pattern matching - in production, use more sophisticated matching
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(key);
  }

  async flush(namespace?: string): Promise<void> {
    if (namespace) {
      const prefix = this.getFullKey('', { namespace });
      const keysToDelete: string[] = [];
      
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.cache.delete(key));
      this.logger.info('Cache namespace flushed', { namespace, count: keysToDelete.length });
    } else {
      this.cache.clear();
      this.stats = {
        hits: 0,
        misses: 0,
        keys: 0,
        hitRate: 0,
        memoryUsage: 0,
        uptime: 0
      };
      this.logger.info('Cache flushed completely');
    }
  }

  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      const value = await this.get<T>(key, options);
      results.push(value);
    }

    this.logger.debug('Multi-get completed', { keyCount: keys.length });
    return results;
  }

  async mset(keyValuePairs: Array<[string, any]>, options: CacheOptions = {}): Promise<void> {
    for (const [key, value] of keyValuePairs) {
      await this.set(key, value, options);
    }

    this.logger.debug('Multi-set completed', { pairCount: keyValuePairs.length });
  }

  async increment(key: string, by: number = 1, options: CacheOptions = {}): Promise<number> {
    const current = await this.get<number>(key, options) || 0;
    const newValue = current + by;
    await this.set(key, newValue, options);
    
    this.logger.debug('Cache value incremented', { key, by, newValue });
    return newValue;
  }

  async decrement(key: string, by: number = 1, options: CacheOptions = {}): Promise<number> {
    return this.increment(key, -by, options);
  }

  async setIfNotExists<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const exists = await this.exists(key, options);
    
    if (!exists) {
      await this.set(key, value, options);
      return true;
    }
    
    return false;
  }

  async getStats(): Promise<CacheStats> {
    this.updateStats();
    return { ...this.stats };
  }

  private updateStats(): void {
    this.stats.keys = this.cache.size;
    this.stats.uptime = Date.now() - this.startTime.getTime();
    
    // Calculate memory usage
    this.stats.memoryUsage = 0;
    for (const entry of this.cache.values()) {
      this.stats.memoryUsage += entry.size;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private calculateSize(value: any): number {
    // Simple size calculation - in production, use more accurate method
    if (typeof value === 'string') {
      return value.length * 2; // Approximate UTF-16 size
    }
    
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 100; // Fallback estimate
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  private cleanupExpired(): void {
    const now = new Date();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug('Expired cache entries cleaned up', { count: keysToDelete.length });
      this.updateStats();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testKey = 'health_check';
      const testValue = Date.now();
      
      await this.set(testKey, testValue, { ttl: 10 });
      const retrieved = await this.get<number>(testKey);
      await this.del(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      this.logger.error('Cache health check failed', { error: (error as any).message });
      return false;
    }
  }

  // Utility methods for common caching patterns
  async cacheFunction<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, options);
    
    return result;
  }

  async invalidatePattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    const keys = await this.keys(pattern, options);
    
    for (const key of keys) {
      await this.del(key, options);
    }

    this.logger.info('Cache pattern invalidated', { pattern, count: keys.length });
  }

  // Specialized methods for the application
  async cacheUserSession(userId: string, sessionData: any, ttl: number = 3600): Promise<void> {
    await this.set(`session:${userId}`, sessionData, { ttl, namespace: 'user' });
  }

  async getUserSession(userId: string): Promise<any> {
    return this.get(`session:${userId}`, { namespace: 'user' });
  }

  async cacheMarketData(symbol: string, data: any, ttl: number = 60): Promise<void> {
    await this.set(`price:${symbol}`, data, { ttl, namespace: 'market' });
  }

  async getMarketData(symbol: string): Promise<any> {
    return this.get(`price:${symbol}`, { namespace: 'market' });
  }

  async cacheAgentPerformance(agentId: string, performance: any, ttl: number = 300): Promise<void> {
    await this.set(`performance:${agentId}`, performance, { ttl, namespace: 'agent' });
  }

  async getAgentPerformance(agentId: string): Promise<any> {
    return this.get(`performance:${agentId}`, { namespace: 'agent' });
  }

  async cacheAnalytics(userId: string, type: string, data: any, ttl: number = 1800): Promise<void> {
    await this.set(`analytics:${userId}:${type}`, data, { ttl, namespace: 'analytics' });
  }

  async getAnalytics(userId: string, type: string): Promise<any> {
    return this.get(`analytics:${userId}:${type}`, { namespace: 'analytics' });
  }
}