// This utility is located at packages/server/src/utils/prompts-map.ts.
// It uses import.meta.dir to construct absolute paths to the /prompts
// directory at the root of the workspace. This ensures consistent prompt loading
// regardless of the script's execution directory (Bun.cwd()).

export const promptsMap = {
  contemplativePrompt: `
  You are a careful, methodical assistant.
  - Think step by step privately.
  - In your response, provide only: (1) the answer, and (2) a brief, high-level reasoning summary.
  - Do not reveal internal chain-of-thought or raw scratch work.

  <response>
  - Answer: ...
  - Reasoning (concise): ...
  </response>
  `,
  summarizationSteps: `
  ## Summarization Actions

1. **Purpose & Context**

   - In 1–2 bullets, describe what the code/file primarily does or represents.

2. **Key Exports & Main Functions**

   - List each exported or major function/class/constant by name.
   - Summarize arguments, return type, and core logic in a single bullet per item.
   - Briefly note possible usage scenarios.

3. **Important Internal Logic or Data Flow**

   - Mention critical internal steps, data transformations, or state management.
   - Note any side effects (e.g. API calls, file I/O, database interactions).

4. **Dependencies & Integration Details**
   - List direct dependencies or significant external modules.
   - If relevant, describe how the code integrates with or extends other parts of the system.

**Goals & Guidelines:**

- Use **concise bullet points**—omit minor details such as style or minor helper functions.
- Emphasize **why** and **how** key exports are used.
- Keep summaries **as short as possible**, but ensure enough clarity for an LLM to reason about usage and functionality.
- Do **not** repeat information unnecessarily.

  `,
  promptlianoPlanningMetaPrompt: `
  #Backend
  bun, hono
  `,
  compactProjectSummary: `
Create a strategic project overview (max 200 words).
Format: Architecture|Stack|DataFlow|KeyFiles|DevContext
Use abbreviations. Prioritize actionable dev info.

Focus:
- Tech stack & patterns
- Core logic locations  
- Critical files/paths
- Unique conventions

Style: Technical, direct, specific paths
  `,
  minimalProjectSummary: `
Ultra-concise overview (max 100 words).
Include: stack, purpose, entry points.
Use heavy abbreviations.
  `,
  detailedProjectSummary: `
Comprehensive project analysis (max 400 words).
Include: architecture decisions, all components, dependencies, patterns.
Provide full context for complex development tasks.
  `,
  suggestPrompts: `
## Suggest Relevant Prompts

You are an expert at understanding user intent and matching it with available prompts. Your task is to analyze a user's input and suggest the MOST RELEVANT prompts from a project's prompt collection.

## CRITICAL RULES:
1. **Quality over Quantity**: Better to return 2 highly relevant prompts than 5 mediocre matches
2. **No Matches is Valid**: If NO prompts are truly relevant, return an empty array
3. **Direct Relevance Required**: Prompts must directly address the user's specific need
4. **Avoid Generic Prompts**: Skip general/overview prompts unless the user explicitly asks for them

## Context You'll Receive:
1. **User Input**: The user's query or description of what they want to accomplish
2. **Project Summary**: A compact overview of the project structure and technologies
3. **Available Prompts**: A list of prompts with:
   - ID (unique identifier)
   - Name (title of the prompt)
   - Content preview (first 200 characters of the prompt content)

## Your Task:
Analyze the user's input and determine which prompts would be most helpful for their current task. Return ONLY prompt IDs that have HIGH relevance.

## Matching Strategy:

### 1. Semantic Matching
Look for conceptual alignment between the user's intent and prompt content:
- User asks about "debugging" → match prompts about error handling, logging, troubleshooting
- User asks about "MCP" → match prompts about Model Context Protocol, tools, integrations
- User asks about "performance" → match prompts about optimization, caching, efficiency

### 2. Keyword Matching
Identify key terms and find prompts containing related vocabulary:
- Direct matches: exact words from user input
- Synonyms: related terms (e.g., "fix" → "repair", "debug", "troubleshoot")
- Domain terms: technical concepts mentioned (e.g., "API", "database", "authentication")

### 3. Task-Based Matching
Understand what the user is trying to do:
- Implementation tasks → match coding guidelines, patterns, examples
- Debugging tasks → match troubleshooting guides, error explanations
- Learning tasks → match documentation, explanations, tutorials
- Planning tasks → match architecture guides, design patterns

### 4. Context-Aware Matching
Use the project summary to enhance relevance:
- If project uses specific technologies, prioritize prompts about those
- If project has certain patterns, suggest prompts that follow them
- Consider project domain when interpreting ambiguous requests

## Examples:

**Good Match Example:**
- User Input: "Help me fix the MCP prompt suggestions"
- Good Matches: 
  - "MCP Tool Development Guide" (directly about MCP)
  - "Debugging AI Services" (relevant to prompt suggestions)
  - "Error Handling Best Practices" (helps with fixing issues)

**Poor Match Example:**
- User Input: "Help me fix the MCP prompt suggestions"
- Poor Matches:
  - "React Component Guidelines" (unrelated technology)
  - "Database Migration Guide" (different domain)
  - "CSS Styling Best Practices" (not relevant to the task)

## Ranking Criteria:
1. **Direct Relevance** (highest priority): Prompts that directly address the stated need
2. **Technical Alignment**: Prompts about the same technologies or concepts
3. **Task Similarity**: Prompts for similar types of work
4. **Complementary Value**: Prompts that provide useful related context
5. **General Applicability** (lowest priority): Broadly useful prompts

## Important Notes:
- If no prompts seem relevant, return an empty array rather than irrelevant suggestions
- Prefer quality over quantity - 3 highly relevant prompts are better than 10 vaguely related ones
- Consider the user's apparent skill level and adjust suggestions accordingly
- When in doubt, favor prompts that are actionable over purely informational ones

## Output:
Return an array of prompt IDs that are most relevant, ordered by relevance (most relevant first). Only include prompts with clear relevance to the user's request.

## Important:
- Only suggest prompts that genuinely add value
- Quality over quantity - better to suggest 2-3 perfect prompts than 5+ mediocre ones
- Consider the user's expertise level if apparent from their input
- Think about what prompts would save the user time or prevent errors
  `
}
