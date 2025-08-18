import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { promptStorage } from './prompt-storage'
import { type Prompt, type PromptProject } from '@promptliano/schemas'
import { DatabaseManager, getDb } from './database-manager'

describe('Prompt Storage (SQLite)', () => {
  let testPromptId: number
  let db: DatabaseManager

  beforeEach(async () => {
    // Get fresh database instance and run migrations
    db = getDb()
    const { runMigrations } = await import('./migrations/run-migrations')
    await runMigrations()

    testPromptId = Date.now()
  })

  afterEach(async () => {
    // Clean up test data using our test utilities
    const { clearAllData } = await import('./test-utils')
    await clearAllData()
  })

  it('should create and read prompts', async () => {
    const testPrompt: Prompt = {
      id: testPromptId,
      name: 'Test Prompt',
      content: 'This is a test prompt',
      created: testPromptId,
      updated: testPromptId
    }

    // Write prompt
    const prompts = await promptStorage.readPrompts()
    prompts[String(testPromptId)] = testPrompt
    await promptStorage.writePrompts(prompts)

    // Read prompts
    const retrievedPrompts = await promptStorage.readPrompts()
    expect(retrievedPrompts[String(testPromptId)]).toEqual(testPrompt)
  })

  it('should handle prompt-project associations', async () => {
    const promptId = testPromptId
    const projectId = testPromptId + 1

    // First, create the parent prompt
    const testPrompt: Prompt = {
      id: promptId,
      name: 'Test Prompt for Association',
      content: 'This is a test prompt for association',
      created: promptId,
      updated: promptId
    }
    await promptStorage.writePrompts({ [promptId]: testPrompt })

    // Create the parent project record
    const database = db.getDatabase()
    database.prepare(`
      INSERT INTO projects (id, name, description, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, 'Test Project', 'Test Description', '/test/path', projectId, projectId)

    const association: PromptProject = {
      id: testPromptId + 2, // This will be ignored during insert, auto-generated
      promptId: promptId,
      projectId: projectId
    }

    // Write association
    await promptStorage.writePromptProjectAssociations([association])

    // Read associations
    const retrievedAssociations = await promptStorage.readPromptProjectAssociations()
    expect(retrievedAssociations).toHaveLength(1)
    
    // Check that the association has the correct foreign keys (ID will be auto-generated)
    const retrieved = retrievedAssociations[0]
    expect(retrieved.promptId).toBe(promptId)
    expect(retrieved.projectId).toBe(projectId)
    expect(retrieved.id).toBeDefined()
    expect(typeof retrieved.id).toBe('number')
  })

  it('should update prompts', async () => {
    const testPrompt: Prompt = {
      id: testPromptId,
      name: 'Original Name',
      content: 'Original content',
      created: testPromptId,
      updated: testPromptId
    }

    // Create prompt
    const prompts = { [String(testPromptId)]: testPrompt }
    await promptStorage.writePrompts(prompts)

    // Update prompt
    const updatedPrompt: Prompt = {
      ...testPrompt,
      name: 'Updated Name',
      content: 'Updated content',
      updated: Date.now()
    }

    const updatedPrompts = { [String(testPromptId)]: updatedPrompt }
    await promptStorage.writePrompts(updatedPrompts)

    // Verify update
    const retrievedPrompts = await promptStorage.readPrompts()
    expect(retrievedPrompts[String(testPromptId)]?.name).toBe('Updated Name')
    expect(retrievedPrompts[String(testPromptId)]?.content).toBe('Updated content')
  })

  it('should delete prompts', async () => {
    const prompt1: Prompt = {
      id: testPromptId,
      name: 'Prompt 1',
      content: 'Content 1',
      created: testPromptId,
      updated: testPromptId
    }

    const prompt2: Prompt = {
      id: testPromptId + 1,
      name: 'Prompt 2',
      content: 'Content 2',
      created: testPromptId + 1,
      updated: testPromptId + 1
    }

    // Create prompts
    const prompts = {
      [String(prompt1.id)]: prompt1,
      [String(prompt2.id)]: prompt2
    }
    await promptStorage.writePrompts(prompts)

    // Delete one prompt
    delete prompts[String(prompt1.id)]
    await promptStorage.writePrompts(prompts)

    // Verify deletion
    const retrievedPrompts = await promptStorage.readPrompts()
    expect(retrievedPrompts[String(prompt1.id)]).toBeUndefined()
    expect(retrievedPrompts[String(prompt2.id)]).toEqual(prompt2)
  })

  it('should handle multiple prompt-project associations', async () => {
    const promptId1 = testPromptId
    const promptId2 = testPromptId + 1
    const projectId1 = testPromptId + 100
    const projectId2 = testPromptId + 101

    // Create parent prompts
    const testPrompt1: Prompt = {
      id: promptId1,
      name: 'Test Prompt 1',
      content: 'Content 1',
      created: promptId1,
      updated: promptId1
    }
    const testPrompt2: Prompt = {
      id: promptId2,
      name: 'Test Prompt 2',
      content: 'Content 2',
      created: promptId2,
      updated: promptId2
    }
    await promptStorage.writePrompts({ 
      [promptId1]: testPrompt1,
      [promptId2]: testPrompt2
    })

    // Create parent projects
    const database = db.getDatabase()
    database.prepare(`
      INSERT INTO projects (id, name, description, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId1, 'Test Project 1', 'Description 1', '/test/path1', projectId1, projectId1)
    
    database.prepare(`
      INSERT INTO projects (id, name, description, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId2, 'Test Project 2', 'Description 2', '/test/path2', projectId2, projectId2)

    const associations: PromptProject[] = [
      {
        id: 0, // Will be auto-generated
        promptId: promptId1,
        projectId: projectId1
      },
      {
        id: 0, // Will be auto-generated
        promptId: promptId1,
        projectId: projectId2
      },
      {
        id: 0, // Will be auto-generated
        promptId: promptId2,
        projectId: projectId1
      }
    ]

    // Write associations
    await promptStorage.writePromptProjectAssociations(associations)

    // Read and verify
    const retrievedAssociations = await promptStorage.readPromptProjectAssociations()
    expect(retrievedAssociations).toHaveLength(3)

    // Check that all associations are preserved
    const prompt1Associations = retrievedAssociations.filter((a) => a.promptId === promptId1)
    expect(prompt1Associations).toHaveLength(2)

    const project1Associations = retrievedAssociations.filter((a) => a.projectId === projectId1)
    expect(project1Associations).toHaveLength(2)
    
    // Verify all associations have auto-generated IDs
    for (const assoc of retrievedAssociations) {
      expect(assoc.id).toBeDefined()
      expect(typeof assoc.id).toBe('number')
      expect(assoc.id).toBeGreaterThan(0)
    }
  })

  it('should generate unique IDs', () => {
    const id1 = promptStorage.generateId()
    const id2 = promptStorage.generateId()

    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
    expect(id2).toBeGreaterThan(id1)
  })
})
