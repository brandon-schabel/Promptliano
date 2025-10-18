import { beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import path from 'node:path'

import {
    researchSourceRepository,
    researchSourceLinkRepository
} from '../research-repository'
import { type InsertResearchSourceLink } from '../../schema'

let sqlite: Database
let testDb: ReturnType<typeof drizzle>
let sourceRepo: ReturnType<typeof researchSourceRepository.withDb>

describe('researchSourceLinkRepository', () => {
    beforeEach(async () => {
        if (sqlite) {
            sqlite.close()
        }

        sqlite = new Database(':memory:')
        testDb = drizzle(sqlite)

        await migrate(testDb, {
            migrationsFolder: path.resolve(__dirname, '../../../drizzle')
        })

        sourceRepo = researchSourceRepository.withDb(testDb)
    })

    it('inserts and paginates links with filters', async () => {
        const source = await sourceRepo.create({
            researchId: 1,
            url: 'https://example.com',
            status: 'pending',
            sourceType: 'web'
        })

        const now = Date.now()

        const links: InsertResearchSourceLink[] = Array.from({ length: 10 }, (_, idx) => ({
            sourceId: source.id,
            url: `https://example.com/page-${idx}`,
            status: idx % 2 === 0 ? 'crawled' : 'pending',
            depth: idx,
            discoveredAt: now - idx * 1000,
            createdAt: now - idx * 1000,
            updatedAt: now - idx * 1000
        }))

        await researchSourceLinkRepository.insertMany(links, testDb)

        const result = await researchSourceLinkRepository.getPaginated(
            {
                sourceId: source.id,
                page: 1,
                limit: 5,
                sortBy: 'depth',
                sortOrder: 'desc',
                filters: {
                    status: ['crawled'],
                    minDepth: 2,
                    maxDepth: 8
                }
            },
            testDb
        )

        expect(result.pagination.total).toBeGreaterThan(0)
        expect(result.links.length).toBeLessThanOrEqual(5)
        expect(result.links.every((link) => link.status === 'crawled')).toBe(true)
        expect(
            result.links.every((link) => (link.depth ?? 0) >= 2 && (link.depth ?? 0) <= 8)
        ).toBe(true)
    })

    it('upserts existing links by url for the same source', async () => {
        const source = await sourceRepo.create({
            researchId: 1,
            url: 'https://example.com',
            status: 'pending',
            sourceType: 'web'
        })

        const timestamp = Date.now()

        await researchSourceLinkRepository.insertMany(
            [
                {
                    sourceId: source.id,
                    url: 'https://example.com/unique',
                    status: 'pending',
                    depth: 1,
                    discoveredAt: timestamp,
                    createdAt: timestamp,
                    updatedAt: timestamp
                }
            ],
            testDb
        )

        await researchSourceLinkRepository.insertMany(
            [
                {
                    sourceId: source.id,
                    url: 'https://example.com/unique',
                    status: 'crawled',
                    depth: 2,
                    discoveredAt: timestamp + 1000,
                    createdAt: timestamp + 1000,
                    updatedAt: timestamp + 1000,
                    relevanceScore: 0.9
                }
            ],
            testDb
        )

        const result = await researchSourceLinkRepository.getPaginated(
            {
                sourceId: source.id,
                limit: 10
            },
            testDb
        )

        expect(result.links.length).toBe(1)
        expect(result.links[0]?.status).toBe('crawled')
        expect(result.links[0]?.relevanceScore).toBeCloseTo(0.9)
    })
})

