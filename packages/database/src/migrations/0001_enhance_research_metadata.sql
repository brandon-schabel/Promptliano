-- Migration: Enhance Research Source Metadata for Crawling Statistics
-- This migration updates the metadata field structure for research_sources table
-- The metadata field is already a JSON field, so we don't need schema changes
-- This is a documentation migration to track the metadata structure enhancement

-- Note: The metadata field in research_sources table now supports enhanced crawling statistics:
--
-- 1. Crawl Status Information:
--    - crawlStatus: idle | queued | active | completed | failed | paused
--    - lastCrawlStartedAt: timestamp
--    - lastCrawlEndedAt: timestamp
--    - currentCrawlSessionId: string
--
-- 2. Crawl Progress Metrics:
--    - totalLinksDiscovered: number
--    - totalPagesCrawled: number
--    - pagesRemainingInQueue: number
--    - currentDepth: number
--    - maxDepthConfigured: number
--    - linksPerDepth: array of depth statistics
--
-- 3. Performance Stats:
--    - avgCrawlTimeMs: number
--    - successRate: percentage
--    - failedPagesCount: number
--    - totalTokens: number
--    - avgTokensPerPage: number
--    - totalContentSizeBytes: number
--
-- 4. Link Discovery Timeline:
--    - recentDiscoveries: array of last 100 discovered links
--    - linkDiscoveryRatePerMinute: number
--    - lastLinkDiscoveredAt: timestamp
--
-- 5. Error Tracking:
--    - totalErrorCount: number
--    - lastErrorMessage: string
--    - failedUrls: array of last 50 errors
--    - errorsByType: error type counts
--
-- The application code handles backward compatibility with old metadata structure

-- Create index for efficient crawl status queries if not exists
CREATE INDEX IF NOT EXISTS idx_research_sources_status_metadata
ON research_sources(status, json_extract(metadata, '$.crawlStatus'));

-- Create index for active crawls if not exists
CREATE INDEX IF NOT EXISTS idx_research_sources_active_crawls
ON research_sources(research_id)
WHERE json_extract(metadata, '$.crawlStatus') IN ('active', 'queued');