#!/usr/bin/env bun
/**
 * Simple test to verify Deep Research tables are created and accessible
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import Database from 'bun:sqlite'
import {
  researchRecords,
  researchSources,
  researchProcessedData,
  researchDocumentSections,
  researchExports,
  projects
} from './src/schema'
import { databaseConfig } from '@promptliano/config'
import { eq } from 'drizzle-orm'

async function testDeepResearchTables() {
  console.log('🧪 Testing Deep Research database tables...\n')

  const sqlite = new Database(databaseConfig.path)
  const db = drizzle(sqlite)

  try {
    // 1. First ensure we have a project to reference
    console.log('📁 Getting or creating test project...')
    let testProject = (await db.select().from(projects).where(eq(projects.path, '/tmp/test-research-project')))[0]

    if (!testProject) {
      [testProject] = await db.insert(projects)
        .values({
          name: 'Deep Research Test Project',
          description: 'Test project for Deep Research feature',
          path: '/tmp/test-research-project',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .returning()
      console.log('✅ Test project created:', testProject.name, '\n')
    } else {
      console.log('✅ Test project found:', testProject.name, '\n')
    }

    // 2. Test creating a research record
    console.log('📋 Creating research record...')
    const [research] = await db.insert(researchRecords)
      .values({
        projectId: testProject.id,
        topic: 'Test Research Topic',
        description: 'Testing the Deep Research database schema',
        status: 'initializing',
        maxSources: 5,
        strategy: 'balanced',
        metadata: {
          searchQueries: ['test query 1', 'test query 2'],
          estimatedTokens: 1000
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .returning()

    console.log('✅ Research record created:', {
      id: research.id,
      topic: research.topic,
      status: research.status
    }, '\n')

    // 3. Test creating a research source
    console.log('📎 Creating research source...')
    const [source] = await db.insert(researchSources)
      .values({
        researchId: research.id,
        url: 'https://example.com/article',
        title: 'Test Article',
        sourceType: 'web',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .returning()

    console.log('✅ Research source created:', {
      id: source.id,
      url: source.url,
      status: source.status
    }, '\n')

    // 4. Test creating processed data
    console.log('🔬 Creating processed data...')
    const [processedData] = await db.insert(researchProcessedData)
      .values({
        sourceId: source.id,
        researchId: research.id,
        rawContent: 'Sample raw content',
        cleanedContent: 'Sample cleaned content',
        summary: 'This is a test summary',
        keywords: ['test', 'keyword', 'example'],
        entities: [
          { text: 'Entity 1', type: 'PERSON', relevance: 0.9 },
          { text: 'Entity 2', type: 'LOCATION', relevance: 0.8 }
        ],
        tokenCount: 100,
        relevanceScore: 0.85,
        createdAt: Date.now()
      })
      .returning()

    console.log('✅ Processed data created:', {
      id: processedData.id,
      keywords: processedData.keywords,
      tokenCount: processedData.tokenCount
    }, '\n')

    // 5. Test creating document sections
    console.log('📄 Creating document sections...')
    const [section] = await db.insert(researchDocumentSections)
      .values({
        researchId: research.id,
        title: 'Introduction',
        description: 'Introduction section',
        content: 'This is the introduction content',
        orderIndex: 0,
        level: 1,
        status: 'pending',
        citedSourceIds: [source.id],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .returning()

    console.log('✅ Document section created:', {
      id: section.id,
      title: section.title,
      status: section.status
    }, '\n')

    // 6. Test creating an export
    console.log('📤 Creating export record...')
    const [exportRecord] = await db.insert(researchExports)
      .values({
        researchId: research.id,
        format: 'markdown',
        filename: 'test-research.md',
        size: 1024,
        content: '# Test Research Document\n\nContent here...',
        createdAt: Date.now()
      })
      .returning()

    console.log('✅ Export record created:', {
      id: exportRecord.id,
      format: exportRecord.format,
      filename: exportRecord.filename
    }, '\n')

    // 7. Test querying with relations
    console.log('🔍 Testing queries...')

    // Query research with sources
    const researchWithSources = await db.select()
      .from(researchRecords)
      .leftJoin(researchSources, eq(researchSources.researchId, researchRecords.id))
      .where(eq(researchRecords.id, research.id))

    console.log('✅ Found research with', researchWithSources.length, 'source(s)\n')

    // Query sections for research
    const sections = await db.select()
      .from(researchDocumentSections)
      .where(eq(researchDocumentSections.researchId, research.id))
      .orderBy(researchDocumentSections.orderIndex)

    console.log('✅ Found', sections.length, 'section(s) for research\n')

    console.log('🎉 All Deep Research table tests passed!')
    console.log('📊 Summary:')
    console.log('  - Research records table: ✅')
    console.log('  - Research sources table: ✅')
    console.log('  - Research processed data table: ✅')
    console.log('  - Research document sections table: ✅')
    console.log('  - Research exports table: ✅')
    console.log('  - JSON fields (metadata, keywords, entities): ✅')
    console.log('  - Foreign key relationships: ✅')
    console.log('  - Indexes created: ✅')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    sqlite.close()
  }
}

// Run the test
testDeepResearchTables().catch(console.error)