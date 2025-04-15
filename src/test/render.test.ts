import { CacheService } from '../services/cache.js';
import { Renderer } from '../services/renderer.js';
import { isCrawler, isSearchEngine, isSocialMedia } from '../utils/crawlerDetector.js';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

// 配置日志
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// 测试配置
const TEST_URL = 'http://localhost:3002'; // 目标网站地址
const TEST_PATHS = [
  '/',
  '/aigc-publish?type=text2Img&abilityId=ddb981f9-f5b0-11ef-8d3b-0242ac110007',
  '/agent',
  '/contact',
  '/chatroom?agentId=dbec6892-4001-453a-b903-96e54c491f2f'
];

// 创建输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'test-output');
const HTML_DIR = path.join(OUTPUT_DIR, 'html');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');

// 确保目录存在
[OUTPUT_DIR, HTML_DIR, SCREENSHOT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// 生成带时间戳的文件名
function generateFileName(url: string, extension: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const pathPart = url
    .replace(TEST_URL, '')
    .replace(/\?/g, '_')
    .replace(/=/g, '-')
    .replace(/&/g, '_')
    .replace(/\//g, '_');
  
  return `${pathPart}_${timestamp}${extension}`;
}

// 保存 HTML 到文件
function saveHtmlToFile(url: string, html: string) {
  const fileName = generateFileName(url, '.html');
  const filePath = path.join(HTML_DIR, fileName);
  fs.writeFileSync(filePath, html);
  logger.info(`HTML 已保存到: ${filePath}`);
}

// 保存截图
async function saveScreenshot(page: any, url: string) {
  const fileName = generateFileName(url, '.png');
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ 
    path: filePath,
    fullPage: true,
    type: 'png'
  });
  logger.info(`截图已保存到: ${filePath}`);
}

// 测试 User-Agent
const TEST_USER_AGENTS = {
  google: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bing: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  twitter: 'Twitterbot/1.0',
  normal: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

async function testCrawlerDetection() {
  logger.info('开始测试爬虫检测...');
  
  for (const [name, userAgent] of Object.entries(TEST_USER_AGENTS)) {
    const isBot = isCrawler(userAgent);
    const isSE = isSearchEngine(userAgent);
    const isSM = isSocialMedia(userAgent);
    
    logger.info(`测试 User-Agent: ${name}`);
    logger.info(`是否为爬虫: ${isBot}`);
    logger.info(`是否为搜索引擎: ${isSE}`);
    logger.info(`是否为社交媒体: ${isSM}`);
    logger.info('------------------------');
  }
}

async function testRendering() {
  logger.info('开始测试页面渲染...');
  const renderer = new Renderer(5);

  for (const path of TEST_PATHS) {
    const url = `${TEST_URL}${path}`;
    logger.info(`渲染页面: ${url}`);
    
    try {
      const startTime = Date.now();
      const { html, ttRenderMs, page } = await renderer.render(url, '#root');
      const totalTime = Date.now() - startTime;
      
      // 保存 HTML 和截图
      saveHtmlToFile(url, html);
      await saveScreenshot(page, url);
      
      logger.info(`渲染完成: ${path}`);
      logger.info(`渲染时间: ${ttRenderMs}ms`);
      logger.info(`总耗时: ${totalTime}ms`);
      logger.info(`HTML 长度: ${html.length} 字符`);
      logger.info('------------------------');
    } catch (error) {
      logger.error(`渲染失败: ${path}`, error);
    }
  }

  await renderer.close();
}

async function testCache() {
  logger.info('开始测试缓存功能...');
  const cacheService = new CacheService({
    enabled: true,
    ttl: 60,
    prefix: 'test-cache'
  });

  const testKey = 'test-key';
  const testValue = 'test-value';

  try {
    // 测试设置缓存
    await cacheService.set(testKey, testValue);
    logger.info('缓存设置成功');

    // 测试获取缓存
    const cachedValue = await cacheService.get(testKey);
    logger.info(`获取缓存: ${cachedValue === testValue ? '成功' : '失败'}`);

    // 测试删除缓存
    await cacheService.del(testKey);
    const deletedValue = await cacheService.get(testKey);
    logger.info(`删除缓存: ${deletedValue === null ? '成功' : '失败'}`);
  } catch (error) {
    logger.error('缓存测试失败:', error);
  } finally {
    await cacheService.close();
  }
}

async function runTests() {
  logger.info('开始测试动态渲染 SEO 服务...');
  
  try {
    await testCrawlerDetection();
    await testRendering();
    await testCache();
    
    logger.info('所有测试完成');
  } catch (error) {
    logger.error('测试过程中发生错误:', error);
  }
}

// 运行测试
runTests().catch(console.error); 