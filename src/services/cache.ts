import { Redis } from "ioredis";
import { CacheConfig } from "../types/index.js";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export class CacheService {
  private redis: Redis;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      reconnectOnError: (err: Error) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    this.redis.on("error", (err: Error) => {
      logger.error("Redis连接错误:", err);
    });

    this.redis.on("connect", () => {
      logger.info("Redis连接成功");
    });
  }

  private getKey(key: string): string {
    return `${this.config.prefix}:${key}`;
  }

  async get(key: string): Promise<string | null> {
    if (!this.config.enabled) return null;
    try {
      return await this.redis.get(this.getKey(key));
    } catch (error) {
      logger.error("Redis获取缓存错误:", error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const actualTtl = ttl || this.config.ttl;
      await this.redis.set(this.getKey(key), value, "EX", actualTtl);
      logger.debug(`缓存设置成功: ${key}, TTL: ${actualTtl}秒`);
    } catch (error) {
      logger.error("Redis设置缓存错误:", error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.config.enabled) return;
    try {
      await this.redis.del(this.getKey(key));
      logger.debug(`缓存删除成功: ${key}`);
    } catch (error) {
      logger.error("Redis删除缓存错误:", error);
    }
  }

  async clear(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const keys = await this.redis.keys(`${this.config.prefix}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`清除了 ${keys.length} 个缓存键`);
      }
    } catch (error) {
      logger.error("Redis清除缓存错误:", error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info("Redis连接已关闭");
    } catch (error) {
      logger.error("Redis关闭连接错误:", error);
    }
  }
}
