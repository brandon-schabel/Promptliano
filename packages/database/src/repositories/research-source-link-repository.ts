import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db, type DrizzleDb } from '../db'
import {
    researchSourceLinks,
    type InsertResearchSourceLink,
    type ResearchSourceLink
} from '../schema'
import { createBaseRepository, extendRepository } from './base-repository'

const baseResearchSourceLinkRepository = createBaseRepository(
    researchSourceLinks,
    undefined,
    undefined,
    'ResearchSourceLink'
)

export type SourceLinkFilters = {
    status?: ResearchSourceLink['status'][]
    minDepth?: number
    maxDepth?: number
    search?: string
    crawlSessionId?: string
}

export type SourceLinkPaginationParams = {
    sourceId: number
    page?: number
    limit?: number
    sortBy?: 'discoveredAt' | 'depth' | 'relevanceScore'
    sortOrder?: 'asc' | 'desc'
    filters?: SourceLinkFilters
}

export const researchSourceLinksRepository = extendRepository(baseResearchSourceLinkRepository, {
    async insertMany(
        links: InsertResearchSourceLink[],
        dbInstance: DrizzleDb = db
    ): Promise<ResearchSourceLink[]> {
        if (links.length === 0) return []

        const timestamp = Date.now()
        const prepared = links.map(link => ({
            ...link,
            discoveredAt: link.discoveredAt ?? timestamp,
            createdAt: link.createdAt ?? timestamp,
            updatedAt: link.updatedAt ?? timestamp
        }))

        const inserted = await dbInstance
            .insert(researchSourceLinks)
            .values(prepared)
            .onConflictDoUpdate({
                target: [researchSourceLinks.sourceId, researchSourceLinks.url],
                set: {
                    title: sql`excluded.title`,
                    status: sql`excluded.status`,
                    depth: sql`excluded.depth`,
                    parentUrl: sql`excluded.parent_url`,
                    relevanceScore: sql`excluded.relevance_score`,
                    tokenCount: sql`excluded.token_count`,
                    discoveredAt: sql`excluded.discovered_at`,
                    crawlSessionId: sql`excluded.crawl_session_id`,
                    updatedAt: timestamp
                }
            })
            .returning()

        return inserted as ResearchSourceLink[]
    },

    async add(
        link: InsertResearchSourceLink,
        dbInstance: DrizzleDb = db
    ): Promise<ResearchSourceLink | null> {
        const [result] = await researchSourceLinksRepository.insertMany([link], dbInstance)
        return result ?? null
    },

    async getPaginated(params: SourceLinkPaginationParams, dbInstance: DrizzleDb = db) {
        const {
            sourceId,
            page = 1,
            limit = 100,
            sortBy = 'discoveredAt',
            sortOrder = 'desc',
            filters
        } = params

        const offset = (page - 1) * limit

        const whereClauses = [eq(researchSourceLinks.sourceId, sourceId)]

        if (filters?.status?.length) {
            whereClauses.push(inArray(researchSourceLinks.status, filters.status))
        }

        if (typeof filters?.minDepth === 'number') {
            whereClauses.push(sql`${researchSourceLinks.depth} >= ${filters.minDepth}`)
        }

        if (typeof filters?.maxDepth === 'number') {
            whereClauses.push(sql`${researchSourceLinks.depth} <= ${filters.maxDepth}`)
        }

        if (filters?.search) {
            const term = `%${filters.search}%`
            whereClauses.push(
                or(
                    ilike(researchSourceLinks.url, term),
                    ilike(sql<string>`coalesce(${researchSourceLinks.title}, '')`, term)
                )!
            )
        }

        if (filters?.crawlSessionId) {
            whereClauses.push(eq(researchSourceLinks.crawlSessionId, filters.crawlSessionId))
        }

        const where = and(...whereClauses)

        const totalResult = await dbInstance
            .select({ count: sql<number>`count(*)` })
            .from(researchSourceLinks)
            .where(where)
        const total = totalResult[0]?.count ?? 0

        const orderColumn =
            sortBy === 'depth'
                ? researchSourceLinks.depth
                : sortBy === 'relevanceScore'
                    ? researchSourceLinks.relevanceScore
                    : researchSourceLinks.discoveredAt

        const data = await dbInstance
            .select()
            .from(researchSourceLinks)
            .where(where)
            .orderBy(sortOrder === 'desc' ? desc(orderColumn) : orderColumn)
            .limit(limit)
            .offset(offset)

        return {
            links: data as ResearchSourceLink[],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasMore: page * limit < total
            }
        }
    },

    async deleteBySource(sourceId: number, dbInstance: DrizzleDb = db): Promise<number> {
        const result = (await dbInstance
            .delete(researchSourceLinks)
            .where(eq(researchSourceLinks.sourceId, sourceId))
            .run()) as unknown as { changes: number }

        return result.changes ?? 0
    },

    async getSourceSummary(sourceId: number, dbInstance: DrizzleDb = db) {
        const [stats] = await dbInstance
            .select({
                total: sql<number>`count(*)`,
                crawled: sql<number>`sum(case when ${researchSourceLinks.status} = 'crawled' then 1 else 0 end)`,
                failed: sql<number>`sum(case when ${researchSourceLinks.status} = 'failed' then 1 else 0 end)`
            })
            .from(researchSourceLinks)
            .where(eq(researchSourceLinks.sourceId, sourceId))

        const [{ lastDiscoveryAt }] = await dbInstance
            .select({ lastDiscoveryAt: sql<number | null>`max(${researchSourceLinks.discoveredAt})` })
            .from(researchSourceLinks)
            .where(eq(researchSourceLinks.sourceId, sourceId))

        const [{ earliestDiscoveryAt }] = await dbInstance
            .select({ earliestDiscoveryAt: sql<number | null>`min(${researchSourceLinks.discoveredAt})` })
            .from(researchSourceLinks)
            .where(eq(researchSourceLinks.sourceId, sourceId))

        return {
            total: stats?.total ?? 0,
            crawled: stats?.crawled ?? 0,
            failed: stats?.failed ?? 0,
            lastDiscoveryAt: lastDiscoveryAt ?? null,
            earliestDiscoveryAt: earliestDiscoveryAt ?? null
        }
    }
})
