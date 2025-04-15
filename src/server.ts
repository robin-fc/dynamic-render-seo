import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from 'dotenv';
import { Renderer } from './services/renderer.js';
import { isCrawler, isSearchEngine, isSocialMedia } from './utils/crawlerDetector.js';
import { CacheService } from './services/cache.js';
import winston from 'winston';

// 加载环境变量
config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const app = express();
const port = process.env.PORT || 3000;
const targetHost = process.env.TARGET_HOST || 'http://localhost:3002';

// 初始化渲染器
const renderer = new Renderer(Number(process.env.MAX_CONCURRENT_PAGES) || 10);

// 初始化缓存服务
const cacheService = new CacheService({
  enabled: process.env.CACHE_ENABLED === 'true',
  ttl: parseInt(process.env.CACHE_TTL || '600', 10),
  prefix: 'dynamic-render'
});

// 中间件
app.use(helmet());
app.use(cors());
app.use(compression());

// 静态资源处理
const staticPaths = ['/static/*', '/assets/*', '/favicon.ico', '/manifest.json'];
staticPaths.forEach(path => {
  app.get(path, (req: Request, res: Response) => {
    const targetUrl = `${targetHost}${req.originalUrl}`;
    res.redirect(targetUrl);
  });
});

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// 获取渲染配置
const getRenderConfig = (userAgent: string) => {
  const config = {
    waitTime: 0,
    cacheTime: parseInt(process.env.CACHE_TTL || '600', 10),
    waitForSelector: process.env.WAIT_FOR_SELECTOR || '#root'
  };

  if (isSearchEngine(userAgent)) {
    // 搜索引擎爬虫需要更完整的内容
    config.waitTime = 2000; // 额外等待时间，确保动态内容加载
    config.cacheTime = 3600; // 搜索引擎缓存时间更长
  } else if (isSocialMedia(userAgent)) {
    // 社交媒体爬虫主要关注预览信息
    config.waitForSelector = 'meta[property^="og:"], meta[name^="twitter:"]';
    config.cacheTime = 1800; // 社交媒体缓存时间适中
  }

  return config;
};

// 主要渲染路由
app.get('*', async (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] || '';
  const url = `${targetHost}${req.originalUrl}`;

  // 检查是否为爬虫
  if (!isCrawler(userAgent)) {
    // 非爬虫请求直接代理到目标服务器
    return res.redirect(url);
  }

  try {
    const renderConfig = getRenderConfig(userAgent);
    const cacheKey = `${req.originalUrl}:${isSearchEngine(userAgent) ? 'se' : isSocialMedia(userAgent) ? 'sm' : 'bot'}`;

    // 尝试从缓存获取
    const cachedHtml = await cacheService.get(cacheKey);
    if (cachedHtml) {
      logger.info(`从缓存返回页面: ${req.originalUrl}, 爬虫类型: ${isSearchEngine(userAgent) ? '搜索引擎' : isSocialMedia(userAgent) ? '社交媒体' : '其他爬虫'}`);
      return res.send(cachedHtml);
    }

    // 渲染页面
    logger.info(`开始渲染页面: ${url}, 爬虫类型: ${isSearchEngine(userAgent) ? '搜索引擎' : isSocialMedia(userAgent) ? '社交媒体' : '其他爬虫'}`);
    const { html, ttRenderMs } = await renderer.render(url, renderConfig.waitForSelector);

    // 如果配置了额外等待时间
    if (renderConfig.waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, renderConfig.waitTime));
    }

    // 设置缓存
    await cacheService.set(cacheKey, html, renderConfig.cacheTime);

    // 设置响应头
    res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="动态渲染耗时(ms)"`);
    res.set('X-Rendered-By', 'Dynamic-Render-SEO');
    res.set('Cache-Control', `public, max-age=${renderConfig.cacheTime}`);
    res.set('X-Crawler-Type', isSearchEngine(userAgent) ? 'SearchEngine' : isSocialMedia(userAgent) ? 'SocialMedia' : 'Bot');

    return res.send(html);
  } catch (error) {
    logger.error('渲染错误:', error);
    return res.redirect(url);
  }
});

// 优雅关闭
const gracefulShutdown = async () => {
  logger.info('收到关闭信号，准备关闭服务...');
  try {
    await Promise.all([
      renderer.close(),
      cacheService.close()
    ]);
    logger.info('服务已安全关闭');
    process.exit(0);
  } catch (error) {
    logger.error('关闭服务时发生错误:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.listen(port, () => {
  logger.info(`服务启动在端口 ${port}`);
}); 