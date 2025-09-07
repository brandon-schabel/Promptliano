// Simple test data factory without external dependencies
const generateId = () => Math.random().toString(36).substring(2, 15)
const generateWords = (count: number) =>
  Array(count)
    .fill(0)
    .map(() => generateId())
    .join(' ')
const generateSentence = () => `This is a test ${generateId()} sentence.`
const generateParagraph = () => `${generateSentence()} ${generateSentence()} ${generateSentence()}`

export const TestDataFactory = {
  project: (overrides = {}) => ({
    name: `Test Project ${generateId()}`,
    description: generateSentence(),
    path: `/test/projects/${generateId()}`,
    ...overrides
  }),

  ticket: (projectId: number, overrides = {}) => ({
    projectId,
    title: generateSentence(),
    overview: generateParagraph(),
    status: 'open',
    priority: 'normal',
    suggestedFileIds: [],
    suggestedAgentIds: [],
    suggestedPromptIds: [],
    ...overrides
  }),

  queue: (projectId: number, overrides = {}) => ({
    projectId,
    name: generateWords(2),
    description: generateSentence(),
    maxParallelItems: 1,
    isActive: true,
    ...overrides
  }),

  chat: (projectId: number, overrides = {}) => ({
    projectId,
    title: generateWords(3),
    ...overrides
  }),

  prompt: (projectId: number, overrides = {}) => ({
    projectId,
    title: generateWords(3),
    content: generateParagraph(),
    description: generateSentence(),
    tags: [generateId(), generateId()],
    ...overrides
  })
}
