/**
 * Test data fixtures for Prompt Management Page E2E testing
 *
 * This module provides comprehensive test data for testing all aspects
 * of prompt management including import, CRUD operations, search/sort,
 * bulk operations, and performance scenarios.
 */

export interface PromptTestData {
  title: string
  content: string
  tags: string[]
  category: string
  tokenCount: number
}

export interface ImportTestFile {
  filename: string
  content: string
}

export interface SortingScenario {
  field: string
  direction: 'asc' | 'desc'
  expected: string[] | string
}

export interface SearchQuery {
  query: string
  expectedResults: string[]
}

/**
 * Comprehensive test data for prompt management testing
 */
export const PromptManagementTestData = {
  // Sample prompts for testing different scenarios
  testPrompts: [
    {
      title: 'Code Review Assistant',
      content: `# Code Review Checklist

Please review the following {{language}} code for:

## Security Issues
- Input validation
- SQL injection prevention
- XSS vulnerabilities

## Best Practices
- Code organization
- Error handling
- Performance considerations

## Code to Review:
{{code}}

## Additional Context:
{{context}}`,
      tags: ['code-review', 'development', 'quality-assurance'],
      category: 'Development',
      tokenCount: 145
    },
    {
      title: 'Documentation Generator',
      content: `Generate comprehensive documentation for {{feature_name}}.

## Requirements:
- Overview and purpose
- Installation instructions  
- Usage examples
- API reference (if applicable)
- Troubleshooting guide

## Input Details:
{{feature_details}}

## Target Audience:
{{audience_level}}`,
      tags: ['documentation', 'technical-writing'],
      category: 'Documentation',
      tokenCount: 98
    },
    {
      title: 'Bug Report Analyzer',
      content: `Analyze the following bug report and provide:

1. **Root Cause Analysis**
2. **Reproduction Steps**
3. **Potential Solutions**
4. **Prevention Strategies**

## Bug Report:
{{bug_description}}

## Environment Details:
{{environment_info}}

## Steps Already Tried:
{{attempted_solutions}}`,
      tags: ['debugging', 'troubleshooting', 'analysis'],
      category: 'Support',
      tokenCount: 87
    },
    {
      title: 'Test Case Generator',
      content: `Create comprehensive test cases for {{functionality}}.

Include:
- Unit tests
- Integration tests  
- Edge cases
- Error scenarios

## Functionality Description:
{{description}}

## Expected Behavior:
{{expected_output}}`,
      tags: ['testing', 'qa', 'automation'],
      category: 'Testing',
      tokenCount: 76
    }
  ] as PromptTestData[],

  // Sample markdown files for import testing
  importTestFiles: [
    {
      filename: 'code-review-prompts.md',
      content: `# Code Review Prompts

## Security Review
Review this code for security vulnerabilities:
{{code}}

## Performance Review  
Analyze this code for performance issues:
{{code}}

## Best Practices Review
Check if this code follows best practices:
{{code}}`
    },
    {
      filename: 'project-management-prompts.md',
      content: `# Project Management Templates

## Sprint Planning
Plan the next sprint based on:
- Team capacity: {{capacity}}
- Priority items: {{priorities}}
- Dependencies: {{dependencies}}

## Retrospective Facilitator
Facilitate a team retrospective covering:
- What went well: {{successes}}
- What to improve: {{improvements}} 
- Action items: {{actions}}`
    }
  ] as ImportTestFile[],

  // Sort and filter test scenarios
  sortingScenarios: [
    {
      field: 'title',
      direction: 'asc',
      expected: ['Bug Report Analyzer', 'Code Review Assistant', 'Documentation Generator']
    },
    {
      field: 'title',
      direction: 'desc',
      expected: ['Test Case Generator', 'Documentation Generator', 'Code Review Assistant']
    },
    { field: 'created_at', direction: 'desc', expected: 'chronological' },
    { field: 'token_count', direction: 'asc', expected: 'ascending by tokens' }
  ] as SortingScenario[],

  // Search test queries
  searchQueries: [
    { query: 'code', expectedResults: ['Code Review Assistant', 'Bug Report Analyzer'] },
    { query: 'documentation', expectedResults: ['Documentation Generator'] },
    { query: 'test', expectedResults: ['Test Case Generator'] },
    { query: 'review analysis', expectedResults: ['Code Review Assistant', 'Bug Report Analyzer'] },
    { query: 'nonexistent', expectedResults: [] }
  ] as SearchQuery[],

  // Performance test data
  performancePrompts: {
    large: {
      title: 'Large Content Prompt',
      content:
        Array(500).fill('This is a line of content in a large prompt. ').join('\n') +
        'Variables: {{var1}} {{var2}} {{var3}} {{var4}} {{var5}}',
      tags: ['performance', 'large-content', 'testing'],
      category: 'Performance',
      tokenCount: 2500
    },
    manyVariables: {
      title: 'Variable Heavy Prompt',
      content: Array(50)
        .fill(0)
        .map((_, i) => `Variable ${i + 1}: {{var${i + 1}}}`)
        .join('\n'),
      tags: ['variables', 'templates', 'performance'],
      category: 'Templates',
      tokenCount: 300
    }
  },

  // Bulk operations test set
  bulkOperationPrompts: Array.from({ length: 10 }, (_, i) => ({
    title: `Bulk Test Prompt ${i + 1}`,
    content: `This is bulk test prompt number ${i + 1}.\n\nContent: {{content_${i + 1}}}`,
    tags: [`bulk-${i + 1}`, 'bulk-test', i % 2 === 0 ? 'even' : 'odd'],
    category: i % 3 === 0 ? 'Category A' : i % 3 === 1 ? 'Category B' : 'Category C',
    tokenCount: 25 + i * 5
  })) as PromptTestData[],

  // Edge case prompts for validation testing
  edgeCasePrompts: {
    minimal: {
      title: 'Minimal Prompt',
      content: 'A',
      tags: [],
      category: 'Minimal',
      tokenCount: 1
    },
    unicodeContent: {
      title: '🚀 Unicode Test Prompt',
      content: 'Testing unicode: 🎉 émojis, åccénts, 中文, العربية, Русский\n\n{{unicode_var}} 🌟',
      tags: ['unicode', '测试', 'тест'],
      category: 'Unicode',
      tokenCount: 45
    },
    specialCharacters: {
      title: 'Special Characters Test',
      content: 'Testing: <>&"\'`\n{{var_with_<special>_chars}}\n\n```javascript\nconst test = "special";\n```',
      tags: ['special-chars', 'html-entities', 'code'],
      category: 'Edge Cases',
      tokenCount: 30
    },
    longTitle: {
      title: 'Very Long Title That Tests Character Limits And Wrapping Behavior In The UI Components',
      content: 'Content for testing long title handling.',
      tags: ['long-title', 'ui-testing'],
      category: 'UI Testing',
      tokenCount: 15
    }
  },

  // Validation test scenarios
  validationScenarios: {
    emptyTitle: {
      title: '',
      content: 'Valid content but empty title',
      tags: ['validation'],
      category: 'Validation',
      tokenCount: 10
    },
    emptyContent: {
      title: 'Valid Title',
      content: '',
      tags: ['validation'],
      category: 'Validation',
      tokenCount: 0
    },
    duplicateTitle: {
      title: 'Code Review Assistant', // Matches existing prompt
      content: 'Different content with duplicate title',
      tags: ['duplicate', 'validation'],
      category: 'Validation',
      tokenCount: 12
    }
  },

  // Complex search scenarios
  complexSearchScenarios: [
    {
      query: 'code AND review',
      expectedResults: ['Code Review Assistant'],
      description: 'Boolean AND search'
    },
    {
      query: 'documentation OR test',
      expectedResults: ['Documentation Generator', 'Test Case Generator'],
      description: 'Boolean OR search'
    },
    {
      query: '"root cause analysis"',
      expectedResults: ['Bug Report Analyzer'],
      description: 'Exact phrase search'
    },
    {
      query: 'tag:development',
      expectedResults: ['Code Review Assistant'],
      description: 'Tag-specific search'
    },
    {
      query: 'category:Documentation',
      expectedResults: ['Documentation Generator'],
      description: 'Category-specific search'
    }
  ]
}

/**
 * Factory functions for creating test data
 */
export class PromptManagementDataFactory {
  private static counter = 0

  private static getUniqueId(): number {
    return ++this.counter + Date.now()
  }

  /**
   * Create a unique prompt for testing
   */
  static createUniquePrompt(overrides: Partial<PromptTestData> = {}): PromptTestData {
    const id = this.getUniqueId()
    return {
      title: `Test Prompt ${id}`,
      content: `This is test prompt content ${id}.\n\nVariables: {{test_var_${id}}}`,
      tags: [`test-${id}`, 'automated-test'],
      category: 'Test Category',
      tokenCount: 25,
      ...overrides
    }
  }

  /**
   * Create multiple unique prompts
   */
  static createMultiplePrompts(count: number, overrides: Partial<PromptTestData> = {}): PromptTestData[] {
    return Array.from({ length: count }, (_, i) =>
      this.createUniquePrompt({
        title: `Generated Prompt ${i + 1}`,
        ...overrides
      })
    )
  }

  /**
   * Create prompts for sorting tests
   */
  static createSortingTestPrompts(): PromptTestData[] {
    return [
      this.createUniquePrompt({
        title: 'Alpha First',
        tokenCount: 100,
        category: 'Category A'
      }),
      this.createUniquePrompt({
        title: 'Zebra Last',
        tokenCount: 50,
        category: 'Category Z'
      }),
      this.createUniquePrompt({
        title: 'Middle Item',
        tokenCount: 75,
        category: 'Category M'
      })
    ]
  }

  /**
   * Create prompts for search testing
   */
  static createSearchTestPrompts(): PromptTestData[] {
    return [
      this.createUniquePrompt({
        title: 'JavaScript Development',
        content: 'Help with JavaScript development tasks and code review',
        tags: ['javascript', 'development', 'code'],
        category: 'Development'
      }),
      this.createUniquePrompt({
        title: 'Python Automation',
        content: 'Automate tasks using Python scripts and tools',
        tags: ['python', 'automation', 'scripts'],
        category: 'Automation'
      }),
      this.createUniquePrompt({
        title: 'Documentation Writing',
        content: 'Create comprehensive documentation for software projects',
        tags: ['documentation', 'writing', 'technical'],
        category: 'Documentation'
      })
    ]
  }

  /**
   * Create large dataset for performance testing
   */
  static createLargeDataset(count: number): PromptTestData[] {
    const categories = ['Development', 'Testing', 'Documentation', 'Support', 'Automation']
    const tagSets = [
      ['code', 'development'],
      ['test', 'qa', 'automation'],
      ['docs', 'writing'],
      ['support', 'help'],
      ['automation', 'scripts']
    ]

    return Array.from({ length: count }, (_, i) => {
      const categoryIndex = i % categories.length
      const tagSetIndex = i % tagSets.length

      return this.createUniquePrompt({
        title: `Large Dataset Prompt ${i + 1}`,
        content: `Content for prompt ${i + 1} in large dataset.\n\nVariables: {{var_${i}}}`,
        tags: [...tagSets[tagSetIndex], `item-${i}`],
        category: categories[categoryIndex],
        tokenCount: 20 + (i % 200) // Vary token counts
      })
    })
  }

  /**
   * Create import test files
   */
  static createImportTestFile(filename: string, promptCount: number): ImportTestFile {
    const prompts = Array.from(
      { length: promptCount },
      (_, i) => `
## Prompt ${i + 1}
${this.createUniquePrompt().content}

---
`
    ).join('\n')

    return {
      filename,
      content: `# Imported Prompts\n\n${prompts}`
    }
  }

  /**
   * Create complex markdown file for import testing
   */
  static createComplexMarkdownFile(): ImportTestFile {
    return {
      filename: 'complex-prompts.md',
      content: `# Complex Prompt Collection

## Code Analysis Prompt
Analyze the following code for:
- **Performance** issues
- *Security* vulnerabilities  
- \`Code quality\` problems

\`\`\`javascript
function example({{input}}) {
  return {{output}};
}
\`\`\`

### Variables:
- {{input}}: The input parameter
- {{output}}: Expected output

---

## Multi-Language Support
Support for multiple languages: {{language}}

1. English content
2. Contenu français  
3. Contenido español
4. 中文内容

### Special Characters
Testing: <>&"'\`~!@#$%^&*()_+-={}[]|\\:";'<>?,./

## Nested Templates
Outer template: {{outer_var}}
Inner template: {{inner_{{nested_var}}}}

> **Note**: This is a complex example with various markdown features.

| Variable | Type | Description |
|----------|------|-------------|
| {{var1}} | string | First variable |
| {{var2}} | number | Second variable |

### Code Blocks
\`\`\`python
def process_{{template_name}}({{params}}):
    """{{docstring}}"""
    return {{result}}
\`\`\`

### Math Expressions
Formula: {{formula}} = {{a}} + {{b}} * {{c}}
`
    }
  }
}

/**
 * Utility functions for test data manipulation
 */
export const PromptManagementTestUtils = {
  /**
   * Calculate expected token count for content
   */
  calculateTokens(content: string): number {
    // Simple approximation: ~4 characters per token
    return Math.ceil(content.length / 4)
  },

  /**
   * Extract variables from prompt content
   */
  extractVariables(content: string): string[] {
    const matches = content.match(/\{\{([^}]+)\}\}/g) || []
    return matches.map((match) => match.slice(2, -2))
  },

  /**
   * Validate prompt data structure
   */
  validatePromptData(prompt: PromptTestData): boolean {
    return !!(
      prompt.title &&
      prompt.content &&
      Array.isArray(prompt.tags) &&
      prompt.category &&
      typeof prompt.tokenCount === 'number'
    )
  },

  /**
   * Sort prompts by various criteria
   */
  sortPrompts(
    prompts: PromptTestData[],
    field: keyof PromptTestData,
    direction: 'asc' | 'desc' = 'asc'
  ): PromptTestData[] {
    return [...prompts].sort((a, b) => {
      let comparison = 0
      const aVal = a[field]
      const bVal = b[field]

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal)
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return direction === 'desc' ? -comparison : comparison
    })
  },

  /**
   * Filter prompts by search query
   */
  filterPrompts(prompts: PromptTestData[], query: string): PromptTestData[] {
    const lowercaseQuery = query.toLowerCase()
    return prompts.filter(
      (prompt) =>
        prompt.title.toLowerCase().includes(lowercaseQuery) ||
        prompt.content.toLowerCase().includes(lowercaseQuery) ||
        prompt.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)) ||
        prompt.category.toLowerCase().includes(lowercaseQuery)
    )
  },

  /**
   * Generate realistic markdown content
   */
  generateMarkdownContent(title: string, sections: string[] = []): string {
    const defaultSections = [
      '## Overview',
      'This prompt helps with {{task_description}}.',
      '',
      '## Instructions',
      '1. First step: {{step_1}}',
      '2. Second step: {{step_2}}',
      '3. Final step: {{step_3}}',
      '',
      '## Expected Output',
      '{{expected_format}}',
      '',
      '## Examples',
      '```',
      '{{example_input}}',
      '```'
    ]

    const content = sections.length > 0 ? sections : defaultSections
    return `# ${title}\n\n${content.join('\n')}`
  }
}
