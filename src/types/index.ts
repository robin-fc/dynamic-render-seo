import { Redis } from 'ioredis';

export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    prefix: string;
}

export interface RenderResult {
    html: string;
    ttRenderMs: number;
}

export interface CrawlerInfo {
    name: string;
    userAgent: string;
    type: 'SearchEngine' | 'SocialMedia' | 'Other';
}

// 导出 Redis 类型
export type RedisClient = Redis;