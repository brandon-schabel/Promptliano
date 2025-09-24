import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard, AnimateOnScroll, staggerContainer, staggerItem } from '@/components/ui'
import { HeroButton } from '@/components/ui/hero-button'
import { McpOverview, CompatibilityMatrix, Troubleshooting } from '@/components/mcp'
import { CodeBlock } from '@/components/docs'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Zap,
  Shield,
  Code2,
  Terminal,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react'

export const Route = createFileRoute('/integrations/')({
  loader: () => {
    return {
      meta: {
        title: 'MCP Integrations - Promptliano | AI-Powered Development',
        description:
          'Integrate Promptliano with VS Code, Cursor, Claude Desktop, and more through Model Context Protocol. Manual JSON setup, 60-70% token efficiency.',
        keywords: [
          'MCP',
          'Model Context Protocol',
          'integrations',
          'VS Code',
          'Cursor',
          'Claude Desktop',
          'Claude Code',
          'AI development',
          'token efficiency'
        ]
      } as SeoMetadata
    }
  },
  component: IntegrationsPage
})

const supportedEditors = [
  {
    name: 'VS Code',
    description: 'Full MCP integration with Visual Studio Code',
    icon: <Code2 className='w-6 h-6' />,
    status: 'stable',
    features: ['MCP extension support', 'IntelliSense integration', 'Debugging tools']
  },
  {
    name: 'Cursor',
    description: 'Native MCP support with enhanced AI features',
    icon: <Zap className='w-6 h-6' />,
    status: 'stable',
    features: ['MCP settings UI', 'AI-powered code completion', 'Manual JSON guidance']
  },
  {
    name: 'Claude Desktop',
    description: 'Direct integration for AI-assisted development',
    icon: <Terminal className='w-6 h-6' />,
    status: 'stable',
    features: ['Native MCP support', 'Project context awareness', 'Multi-file editing']
  },
  {
    name: 'Claude Code',
    description: 'Optimized for advanced code understanding',
    icon: <Sparkles className='w-6 h-6' />,
    status: 'stable',
    features: ['Enhanced code analysis', 'Smart refactoring', 'Context-aware suggestions']
  },
  {
    name: 'Windsurf',
    description: 'Modern IDE with MCP integration',
    icon: <Shield className='w-6 h-6' />,
    status: 'stable',
    features: ['MCP protocol support', 'Collaborative features', 'Cloud sync']
  }
]

const keyFeatures = [
  {
    title: '60-70% Token Efficiency',
    description: 'Revolutionary token reduction through intelligent file suggestions and caching',
    icon: <Zap className='w-5 h-5' />
  },
  {
    title: 'Universal Editor Support',
    description: 'Works seamlessly with all major MCP-compatible editors and IDEs',
    icon: <Code2 className='w-5 h-5' />
  },
  {
    title: 'Local-First Architecture',
    description: 'All data stays on your machine with full control and privacy',
    icon: <Shield className='w-5 h-5' />
  },
  {
    title: 'Step-by-Step Setup',
    description: 'Copy ready-made JSON into your editor configuration files',
    icon: <CheckCircle className='w-5 h-5' />
  }
]

const claudeMacSnippet = `{
  "mcpServers": {
    "promptliano": {
      "command": "/absolute/path/to/promptliano/packages/server/mcp-start.sh"
    }
  }
}`

const claudeWindowsSnippet = `{
  "mcpServers": {
    "promptliano": {
      "command": "C:\\absolute\\path\\to\\promptliano\\packages\\server\\mcp-start.bat"
    }
  }
}`

const cursorSnippet = `{
  "promptliano": {
    "command": "/absolute/path/to/promptliano/packages/server/mcp-start.sh"
  }
}`

function IntegrationsPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        {/* Hero Section */}
        <AnimateOnScroll>
          <div className='text-center mb-16'>
            <motion.h1
              className='text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              First Class MCP Support
            </motion.h1>
            <motion.p
              className='text-xl text-muted-foreground max-w-3xl mx-auto mb-8'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Connect Promptliano with your favorite development tools through the Model Context Protocol. Experience
              60-70% token efficiency and seamless AI-powered development.
            </motion.p>
            <motion.div
              className='flex flex-col sm:flex-row gap-4 justify-center items-center'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <HeroButton href='#setup' size='lg'>
                Quick Setup Guide
                <ArrowRight className='ml-2 w-4 h-4' />
              </HeroButton>
              <HeroButton href='/docs/mcp' size='lg' variant='outline'>
                MCP Documentation
              </HeroButton>
            </motion.div>
          </div>
        </AnimateOnScroll>

        {/* Key Features */}
        <AnimateOnScroll>
          <div className='mb-20'>
            <motion.div
              className='grid md:grid-cols-2 lg:grid-cols-4 gap-6'
              variants={staggerContainer}
              initial='hidden'
              whileInView='visible'
              viewport={{ once: true }}
            >
              {keyFeatures.map((feature, index) => (
                <motion.div key={index} variants={staggerItem}>
                  <GlassCard className='p-6 h-full hover:border-primary/50 transition-all hover:scale-[1.02]'>
                    <div className='text-primary bg-primary/10 p-3 rounded-lg w-fit mb-4'>{feature.icon}</div>
                    <h3 className='text-lg font-semibold mb-2'>{feature.title}</h3>
                    <p className='text-sm text-muted-foreground'>{feature.description}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </AnimateOnScroll>

        {/* Supported Editors */}
        <AnimateOnScroll>
          <section className='mb-20'>
            <h2 className='text-3xl md:text-4xl font-bold text-center mb-12'>Supported Editors</h2>
            <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {supportedEditors.map((editor, index) => (
                <motion.div
                  key={editor.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <GlassCard className='p-6 h-full hover:border-primary/50 transition-all group'>
                    <div className='flex items-start justify-between mb-4'>
                      <div className='text-primary bg-primary/10 p-3 rounded-lg group-hover:scale-110 transition-transform'>
                        {editor.icon}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          editor.status === 'stable'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-yellow-500/20 text-yellow-500'
                        }`}
                      >
                        {editor.status}
                      </span>
                    </div>
                    <h3 className='text-xl font-semibold mb-2'>{editor.name}</h3>
                    <p className='text-muted-foreground mb-4'>{editor.description}</p>
                    <ul className='space-y-2'>
                      {editor.features.map((feature, i) => (
                        <li key={i} className='flex items-center gap-2 text-sm text-muted-foreground'>
                          <CheckCircle className='w-4 h-4 text-primary' />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </section>
        </AnimateOnScroll>

        {/* Manual MCP Setup Section */}
        <AnimateOnScroll>
          <section id='setup' className='py-20'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Manual MCP Setup</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                Copy the relevant JSON snippet into your editor&apos;s configuration file to connect Promptliano as an MCP
                server.
              </p>
            </div>

            <GlassCard className='max-w-4xl mx-auto p-8 space-y-8'>
              <div>
                <h3 className='text-2xl font-semibold mb-2'>Claude Desktop (macOS)</h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  Edit{' '}
                  <code className='px-1.5 py-0.5 bg-muted rounded text-xs font-mono'>
                    ~/Library/Application Support/Claude/claude_desktop_config.json
                  </code>{' '}
                  and merge this under{' '}
                  <code className='px-1.5 py-0.5 bg-muted rounded text-xs font-mono'>&quot;mcpServers&quot;</code>.
                </p>
                <CodeBlock code={claudeMacSnippet} language='json' />
              </div>

              <div>
                <h3 className='text-2xl font-semibold mb-2'>Claude Desktop (Windows)</h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  Edit{' '}
                  <code className='px-1.5 py-0.5 bg-muted rounded text-xs font-mono'>
                    %APPDATA%\\Claude\\claude_desktop_config.json
                  </code>{' '}
                  and paste the snippet below.
                </p>
                <CodeBlock code={claudeWindowsSnippet} language='json' />
                <p className='text-xs text-muted-foreground mt-2'>
                  Use double backslashes in Windows paths and adjust the Promptliano path for your installation.
                </p>
              </div>

              <div>
                <h3 className='text-2xl font-semibold mb-2'>Cursor, Windsurf, and Other Editors</h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  These editors provide an MCP configuration screen. Add a server named{' '}
                  <code className='px-1.5 py-0.5 bg-muted rounded text-xs font-mono'>promptliano</code> with the following
                  command path.
                </p>
                <CodeBlock code={cursorSnippet} language='json' />
                <p className='text-xs text-muted-foreground mt-2'>
                  Replace the command path with your actual Promptliano location; keep the shell script on macOS/Linux or
                  use the <code className='px-1.5 py-0.5 bg-muted rounded text-xs font-mono'>.bat</code> script on Windows.
                </p>
              </div>

              <div className='p-4 bg-blue-500/10 rounded-lg border border-blue-500/20'>
                <p className='text-sm text-muted-foreground'>
                  Restart your editor after updating its configuration so it picks up the new MCP server.
                </p>
              </div>
            </GlassCard>
          </section>
        </AnimateOnScroll>

        {/* MCP Overview Section */}
        <McpOverview />

        {/* Compatibility Matrix */}
        <AnimateOnScroll>
          <section className='py-20'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Compatibility & Requirements</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                Detailed compatibility information for Promptliano MCP across all supported editors
              </p>
            </div>
            <CompatibilityMatrix />
          </section>
        </AnimateOnScroll>

        {/* Troubleshooting Section */}
        <AnimateOnScroll>
          <section className='py-20'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Troubleshooting</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                Common issues and solutions for MCP integration setup
              </p>
            </div>
            <Troubleshooting />
          </section>
        </AnimateOnScroll>

        {/* CTA Section */}
        <AnimateOnScroll>
          <section className='py-20 text-center'>
            <GlassCard className='p-12 max-w-4xl mx-auto bg-gradient-to-br from-primary/10 to-primary/5'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Ready to Supercharge Your Development?</h2>
              <p className='text-lg text-muted-foreground mb-8 max-w-2xl mx-auto'>
                Join thousands of developers using Promptliano to build faster and smarter with AI-powered context
              </p>
              <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                <HeroButton href='/docs/getting-started' size='lg'>
                  Get Started Free
                  <ChevronRight className='ml-2 w-4 h-4' />
                </HeroButton>
                <HeroButton href='/community' size='lg' variant='outline'>
                  Join Community
                </HeroButton>
              </div>
            </GlassCard>
          </section>
        </AnimateOnScroll>
      </div>
    </div>
  )
}

