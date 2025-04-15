import puppeteer from 'puppeteer';
import { RenderResult } from '../types/index.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export class Renderer {
  private browser: puppeteer.Browser | null = null;
  private readonly maxConcurrentPages: number;
  private activePages: number = 0;

  constructor(maxConcurrentPages: number = 10) {
    this.maxConcurrentPages = maxConcurrentPages;
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      });
    }
  }

  private async createPage(): Promise<puppeteer.Page> {
    await this.initBrowser();
    if (!this.browser) throw new Error('浏览器初始化失败');

    while (this.activePages >= this.maxConcurrentPages) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activePages++;
    const page = await this.browser.newPage();

    // 设置页面视口
    await page.setViewport({
      width: 1920,
      height: 1080
    });

    // 设置请求拦截
    await page.setRequestInterception(true);
    page.on('request', request => {
      const resourceType = request.resourceType();
      if (
        resourceType === 'image' ||
        resourceType === 'font' ||
        resourceType === 'media'
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // 设置用户代理
    await page.setUserAgent(
      'Mozilla/5.0 (compatible; DynamicRenderBot/1.0; +http://example.com/bot)'
    );

    return page;
  }

  private async closePage(page: puppeteer.Page): Promise<void> {
    try {
      await page.close();
      this.activePages--;
    } catch (error) {
      logger.error('关闭页面时发生错误:', error);
    }
  }

  async render(url: string, waitForSelector?: string): Promise<RenderResult & { page: puppeteer.Page }> {
    const start = Date.now();
    const page = await this.createPage();

    try {
      // 设置页面超时
      await page.setDefaultNavigationTimeout(
        Number(process.env.PAGE_TIMEOUT) || 30000
      );

      // 导航到目标URL
      await page.goto(url, {
        waitUntil: ['networkidle0', 'domcontentloaded']
      });

      // 等待特定选择器（如果提供）
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { 
          timeout: 5000,
          visible: true
        });
      }

      // 注入标记以防止客户端重新请求
      await page.evaluate(() => {
        const meta = document.createElement('meta');
        meta.name = 'dynamic-rendered';
        meta.content = 'true';
        document.head.appendChild(meta);
      });

      // 获取渲染后的HTML
      const html = await page.content();
      const ttRenderMs = Date.now() - start;

      return { html, ttRenderMs, page };
    } catch (error) {
      await this.closePage(page);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
} 