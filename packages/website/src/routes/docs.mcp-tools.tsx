import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { CodeTerminal } from '@/components/ui/code-terminal'
import { Breadcrumbs } from '@/components/Breadcrumbs'

export const Route = createFileRoute('/docs/mcp-tools')({
  loader: () => {
    return {
      meta: {
        title: 'MCP Tools Overview - Promptliano Documentation',
        description:
          'Comprehensive overview of all Promptliano MCP tools with required parameters, actions, and examples.',
        keywords: ['MCP', 'tools', 'Promptliano', 'project_manager', 'git_manager', 'agent_manager']
      } as SeoMetadata
    }
  },
  component: MCPToolsOverviewPage
})

function MCPToolsOverviewPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-6xl'>
        <Breadcrumbs />

        <h1 className='text-4xl font-bold mb-8'>MCP Tools Overview</h1>

        <GlassCard className='p-6 mb-8'>
          <h2 className='text-2xl font-semibold mb-3'>Getting Started (Quickstart)</h2>
          <p className='text-muted-foreground mb-4'>
            Follow these steps to begin using MCP tools effectively with a valid <code>projectId</code>.
          </p>
          <div className='grid md:grid-cols-2 gap-6'>
            <div>
              <h4 className='font-medium mb-2'>1) List Projects</h4>
              <CodeTerminal
                code={`mcp__promptliano__project_manager({ action: "list" })`}
                language='typescript'
                animated={false}
              />
            </div>
            <div>
              <h4 className='font-medium mb-2'>2) Overview</h4>
              <CodeTerminal
                code={`mcp__promptliano__project_manager({ action: "overview", projectId: <PROJECT_ID> })`}
                language='typescript'
                animated={false}
              />
            </div>
            <div>
              <h4 className='font-medium mb-2'>3) Search</h4>
              <CodeTerminal
                code={`mcp__promptliano__project_manager({
  action: "search",
  projectId: <PROJECT_ID>,
  data: { query: "auth", limit: 5, output: "text" }
})`}
                language='typescript'
                animated={false}
              />
            </div>
            <div>
              <h4 className='font-medium mb-2'>4) File Tree (Paged)</h4>
              <CodeTerminal
                code={`mcp__promptliano__project_manager({
  action: "get_file_tree",
  projectId: <PROJECT_ID>,
  data: { limit: 25, offset: 0, maxDepth: 4, output: "json" }
})`}
                language='typescript'
                animated={false}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard className='p-6 mb-8'>
          <h2 className='text-2xl font-semibold mb-3'>Core Usage Pattern</h2>
          <p className='text-muted-foreground mb-4'>
            All MCP tools require an <code>action</code>. Most actions also require a valid <code>projectId</code>. List
            projects first to get a valid ID, then use that ID in subsequent calls.
          </p>
          <div className='grid md:grid-cols-2 gap-6'>
            <div>
              <h4 className='font-medium mb-2'>List Projects</h4>
              <CodeTerminal code={`mcp__promptliano__project_manager({ action: "list" })`} language='typescript' />
            </div>
            <div>
              <h4 className='font-medium mb-2'>Use a Valid Project ID</h4>
              <CodeTerminal
                code={`mcp__promptliano__project_manager({ action: "overview", projectId: <PROJECT_ID> })`}
                language='typescript'
              />
            </div>
          </div>
          <div className='mt-4 text-sm text-muted-foreground'>
            Tip: Many tools support <code>output: 'text' | 'json'</code>. For large outputs, prefer pagination and JSON.
          </div>
        </GlassCard>

        {/* Project Manager */}
        <section id='project-manager' className='mb-12'>
          <h2 className='text-3xl font-semibold mb-4'>project_manager</h2>
          <GlassCard className='p-6'>
            <h3 className='text-xl font-medium mb-2'>Actions</h3>
            <ul className='list-disc list-inside text-muted-foreground mb-4'>
              <li>
                <code>list</code>, <code>get</code>, <code>create</code>, <code>update</code>, <code>delete</code>
              </li>
              <li>
                <code>browse_files</code>, <code>get_file_content</code>, <code>get_file_content_partial</code>,{' '}
                <code>create_file</code>, <code>delete_file</code>
              </li>
              <li>
                <code>get_summary</code>, <code>get_summary_advanced</code>, <code>get_summary_metrics</code>,{' '}
                <code>overview</code>
              </li>
              <li>
                <code>suggest_files</code>
              </li>
              <li>
                <code>get_file_tree</code> (paginated), <code>search</code>
              </li>
            </ul>
            <div className='grid md:grid-cols-2 gap-6'>
              <div>
                <h4 className='font-medium mb-2'>Paginated File Tree</h4>
                <CodeTerminal
                  code={`mcp__promptliano__project_manager({
  action: "get_file_tree",
  projectId: <PROJECT_ID>,
  data: { limit: 25, offset: 0, maxDepth: 4, includeContent: false, output: "json" }
})`}
                  language='typescript'
                  animated={false}
                />
                <p className='text-sm text-muted-foreground mt-2'>
                  Filters: <code>fileTypes</code>, <code>excludePatterns</code>, <code>includeHidden</code>,{' '}
                  <code>maxFilesPerDir</code>. Returns <code>{`{ tree, meta }`}</code>.
                </p>
              </div>
              <div>
                <h4 className='font-medium mb-2'>Project Search</h4>
                <CodeTerminal
                  code={`mcp__promptliano__project_manager({
  action: "search",
  projectId: <PROJECT_ID>,
  data: { query: "import", limit: 10, searchType: "semantic", includeContext: false, output: "text" }
})`}
                  language='typescript'
                  animated={false}
                />
                <p className='text-sm text-muted-foreground mt-2'>
                  Options: <code>exact</code> | <code>fuzzy</code> | <code>regex</code> | <code>semantic</code>,{' '}
                  <code>caseSensitive</code>, <code>contextLines</code>, <code>scoringMethod</code>.
                </p>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Prompt Manager */}
        <section id='prompt-manager' className='mb-12'>
          <h2 className='text-3xl font-semibold mb-4'>prompt_manager</h2>
          <GlassCard className='p-6'>
            <h3 className='text-xl font-medium mb-2'>Actions</h3>
            <ul className='list-disc list-inside text-muted-foreground mb-4'>
              <li>
                <code>list</code>, <code>get</code>, <code>create</code>, <code>update</code>, <code>delete</code>
              </li>
              <li>
                <code>list_by_project</code>, <code>add_to_project</code>, <code>remove_from_project</code>,{' '}
                <code>suggest_prompts</code>
              </li>
            </ul>
            <p className='text-sm text-muted-foreground'>
              Requires <code>projectId</code> for project-specific actions. <code>suggest_prompts</code> needs{' '}
              <code>data.userInput</code>.
            </p>
          </GlassCard>
        </section>

        {/* Flow Manager */}
        <section id='flow-manager' className='mb-12'>
          <h2 className='text-3xl font-semibold mb-4'>flow_manager</h2>
          <GlassCard className='p-6'>
            <h3 className='text-xl font-medium mb-2'>Actions</h3>
            <ul className='list-disc list-inside text-muted-foreground mb-4'>
              <li>
                Tickets: <code>tickets_list</code>, <code>tickets_get</code>, <code>tickets_create</code>, <code>tickets_update</code>, <code>tickets_delete</code>
              </li>
              <li>
                Tasks: <code>tasks_list_by_ticket</code>, <code>tasks_create</code>, <code>tasks_update</code>, <code>tasks_delete</code>, <code>tasks_reorder</code>
              </li>
              <li>
                Queues: <code>queues_create</code>, <code>queues_list</code>, <code>queues_get</code>, <code>queues_update</code>, <code>queues_delete</code>, <code>queues_get_stats</code>, <code>queues_get_all_stats</code>
              </li>
              <li>
                Processor: <code>processor_get_next</code>, <code>processor_complete</code>, <code>processor_fail</code>
              </li>
            </ul>
            <p className='text-sm text-muted-foreground'>
              Use <code>project_manager(list)</code> to obtain a valid <code>projectId</code>. Enqueue with <code>enqueue_ticket</code> / <code>enqueue_task</code>, then drive execution via <code>processor_get_next</code> until empty.
            </p>
          </GlassCard>
        </section>

        {/* Git Manager */}
        <section id='git-manager' className='mb-12'>
          <h2 className='text-3xl font-semibold mb-4'>git_manager</h2>
          <GlassCard className='p-6'>
            <p className='text-sm text-muted-foreground mb-2'>Comprehensive Git operations.</p>
            <ul className='list-disc list-inside text-muted-foreground mb-2'>
              <li>Status/branches/tags/remotes/stash/reset/revert/blame/config</li>
              <li>
                Enhanced: <code>log_enhanced</code> (supports <code>page</code>/<code>perPage</code>),{' '}
                <code>worktree_*</code> suite
              </li>
            </ul>
            <p className='text-sm text-muted-foreground'>
              Always include <code>projectId</code>. See API docs for action-specific <code>data</code> shapes.
            </p>
          </GlassCard>
        </section>

        {/* Other Tools */}
        <section id='other-tools' className='mb-12'>
          <h2 className='text-3xl font-semibold mb-4'>Other Tools</h2>
          <GlassCard className='p-6'>
            <ul className='list-disc list-inside text-muted-foreground'>
              <li>
                <code>ai_assistant</code> — <code>get_compact_summary</code> (project context summary)
              </li>
            </ul>
          </GlassCard>
        </section>

        {/* Best Practices */}
        <GlassCard className='p-6'>
          <h2 className='text-2xl font-semibold mb-3'>Best Practices</h2>
          <ul className='list-disc list-inside text-muted-foreground'>
            <li>
              Fetch a valid <code>projectId</code> using <code>project_manager(list)</code> before tool calls.
            </li>
            <li>
              Use pagination (<code>limit</code>/<code>offset</code>) and <code>output: 'json'</code> for large outputs.
            </li>
            <li>
              Start with <code>overview</code> to quickly understand project context.
            </li>
          </ul>
        </GlassCard>
      </div>
    </div>
  )
}
