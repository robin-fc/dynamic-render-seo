import { CrawlerInfo } from '../types/index.js';

const crawlers: CrawlerInfo[] = [
  {
    name: 'Google',
    userAgent: 'googlebot',
    type: 'SearchEngine'
  },
  {
    name: 'Bing',
    userAgent: 'bingbot',
    type: 'SearchEngine'
  },
  {
    name: 'Baidu',
    userAgent: 'baiduspider',
    type: 'SearchEngine'
  },
  {
    name: '360',
    userAgent: '360spider',
    type: 'SearchEngine'
  },
  {
    name: 'Sogou',
    userAgent: 'sogou',
    type: 'SearchEngine'
  },
  {
    name: 'Facebook',
    userAgent: 'facebookexternalhit',
    type: 'SocialMedia'
  },
  {
    name: 'Twitter',
    userAgent: 'twitterbot',
    type: 'SocialMedia'
  },
  {
    name: 'LinkedIn',
    userAgent: 'linkedinbot',
    type: 'SocialMedia'
  }
];

export const isCrawler = (userAgent: string): boolean => {
  const lowerUA = userAgent.toLowerCase();
  return crawlers.some(crawler => lowerUA.includes(crawler.userAgent));
};

export const getCrawlerInfo = (userAgent: string): CrawlerInfo | null => {
  const lowerUA = userAgent.toLowerCase();
  return crawlers.find(crawler => lowerUA.includes(crawler.userAgent)) || null;
};

export const isSearchEngine = (userAgent: string): boolean => {
  const crawler = getCrawlerInfo(userAgent);
  return crawler?.type === 'SearchEngine';
};

export const isSocialMedia = (userAgent: string): boolean => {
  const crawler = getCrawlerInfo(userAgent);
  return crawler?.type === 'SocialMedia';
}; 