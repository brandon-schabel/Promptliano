/**
 * Development route for testing the Mermaid Viewer component
 * Access at: http://localhost:5173/dev-mermaid
 */

import { createFileRoute } from '@tanstack/react-router'
import { MermaidViewer } from '@promptliano/ui'
import { useFixMermaidDiagram } from '@/hooks/api-hooks'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'

export const Route = createFileRoute('/dev-mermaid')({
  component: DevMermaidPage
})

const EXAMPLE_DIAGRAMS = {
  flowchart: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,

  sequence: `sequenceDiagram
    participant User
    participant API
    participant DB

    User->>API: Request Data
    API->>DB: Query
    DB-->>API: Results
    API-->>User: Response`,

  gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Research           :2024-01-01, 30d
    Design             :2024-01-15, 20d
    section Phase 2
    Development        :2024-02-01, 45d
    Testing            :2024-03-01, 15d`,

  classDiagram: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +String breed
        +bark()
    }
    class Cat {
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,

  stateDiagram: `stateDiagram-v2
    [*] --> Draft
    Draft --> Review: Submit
    Review --> Approved: Accept
    Review --> Draft: Reject
    Approved --> Published: Publish
    Published --> [*]`,

  erDiagram: `erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER-ITEM : contains
    PRODUCT ||--o{ ORDER-ITEM : "ordered in"

    USER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        int user_id FK
        date created_at
    }`,

  // Invalid diagram for testing error handling
  invalid: `graph TD
    A -> B
    This is invalid syntax!
    Missing proper arrows`
}

function DevMermaidPage() {
  const [currentExample, setCurrentExample] = useState('flowchart')
  const [code, setCode] = useState(EXAMPLE_DIAGRAMS.flowchart)
  const [savedCount, setSavedCount] = useState(0)
  const [exportLog, setExportLog] = useState<string[]>([])

  const { mutateAsync: fixDiagram } = useFixMermaidDiagram()

  const handleAiFix = async (
    mermaidCode: string,
    error?: string,
    userIntent?: string
  ) => {
    const result = await fixDiagram({
      mermaidCode,
      error,
      userIntent
    })

    return {
      fixedCode: result.fixedCode,
      explanation: result.explanation
    }
  }

  const handleSave = (savedCode: string) => {
    setCode(savedCode)
    setSavedCount(prev => prev + 1)
    console.log('Diagram saved:', savedCode)
  }

  const handleSvgExport = (svgContent: string) => {
    const log = `SVG exported at ${new Date().toLocaleTimeString()} (${(svgContent.length / 1024).toFixed(2)}KB)`
    setExportLog(prev => [log, ...prev].slice(0, 10))
    console.log('SVG exported, length:', svgContent.length)
  }

  const handlePngExport = (blob: Blob, dimensions: { width: number; height: number }) => {
    const log = `PNG exported at ${new Date().toLocaleTimeString()} - ${dimensions.width}×${dimensions.height} (${(blob.size / 1024).toFixed(2)}KB)`
    setExportLog(prev => [log, ...prev].slice(0, 10))
    console.log('PNG exported:', dimensions, 'Size:', blob.size, 'bytes')
  }

  const loadExample = (key: string) => {
    setCurrentExample(key)
    setCode(EXAMPLE_DIAGRAMS[key as keyof typeof EXAMPLE_DIAGRAMS])
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Mermaid Viewer Test Page</h1>
        <p className="text-muted-foreground mt-2">
          Test the mermaid diagram viewer with AI-powered error fixing, export features, and live preview
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Current Example</CardDescription>
            <CardTitle className="text-2xl">{currentExample}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Times Saved</CardDescription>
            <CardTitle className="text-2xl">{savedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Exports</CardDescription>
            <CardTitle className="text-2xl">{exportLog.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Example Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Load Example Diagram</CardTitle>
          <CardDescription>Select a diagram type to test different mermaid features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(EXAMPLE_DIAGRAMS).map((key) => (
              <Button
                key={key}
                variant={currentExample === key ? 'default' : 'outline'}
                onClick={() => loadExample(key)}
                className="capitalize"
              >
                {key}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Viewer */}
      <Tabs defaultValue="viewer" className="space-y-4">
        <TabsList>
          <TabsTrigger value="viewer">Interactive Viewer</TabsTrigger>
          <TabsTrigger value="examples">Usage Examples</TabsTrigger>
          <TabsTrigger value="logs">Export Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="viewer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mermaid Viewer</CardTitle>
              <CardDescription>
                Test all features: code editing, AI fix, SVG/PNG export, view modes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px]">
                <MermaidViewer
                  key={currentExample} // Force remount when example changes
                  initialCode={code}
                  onSave={handleSave}
                  onSvgExport={handleSvgExport}
                  onPngExport={handlePngExport}
                  onAiFix={handleAiFix}
                  enableAiFix={true}
                  defaultView="split"
                  editable={true}
                  showToolbar={true}
                  className="border-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Feature Test Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Test Checklist</CardTitle>
              <CardDescription>Features to manually test</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✅ View Modes: Toggle between Code, Preview, and Split views</li>
                <li>✅ Code Editing: Type valid/invalid mermaid code</li>
                <li>✅ Error Display: Load "invalid" example to see error handling</li>
                <li>✅ AI Fix: Click "Fix" button when errors appear</li>
                <li>✅ SVG Export: Click SVG button to download</li>
                <li>✅ PNG Export: Click PNG, choose size preset, export</li>
                <li>✅ Custom PNG Size: Select "Custom Size" and enter dimensions</li>
                <li>✅ Copy Code: Click copy button to copy to clipboard</li>
                <li>✅ Save: Click save button (increments counter above)</li>
                <li>✅ Keyboard Shortcuts: Test Cmd/Ctrl+S for save</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Examples</CardTitle>
              <CardDescription>Code examples for integrating the mermaid viewer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Basic Usage</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import { MermaidViewer } from '@promptliano/ui'

<MermaidViewer
  initialCode="graph LR\\n  A --> B --> C"
  defaultView="preview"
  editable={false}
/>`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. With AI Fix</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`const { mutateAsync: fixDiagram } = useFixMermaidDiagram()

const handleAiFix = async (code, error) => {
  const result = await fixDiagram({
    mermaidCode: code,
    error
  })
  return {
    fixedCode: result.fixedCode,
    explanation: result.explanation
  }
}

<MermaidViewer
  initialCode={code}
  onAiFix={handleAiFix}
  enableAiFix={true}
/>`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. With Export Handlers</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`<MermaidViewer
  initialCode={code}
  onSvgExport={(svg) => {
    console.log('SVG:', svg.length, 'bytes')
  }}
  onPngExport={(blob, dims) => {
    console.log('PNG:', dims, blob.size, 'bytes')
  }}
  onSave={(code) => {
    saveToDatabase(code)
  }}
/>`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Activity Log</CardTitle>
              <CardDescription>Recent export operations (last 10)</CardDescription>
            </CardHeader>
            <CardContent>
              {exportLog.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No exports yet. Try exporting a diagram as SVG or PNG.
                </p>
              ) : (
                <ul className="space-y-1 font-mono text-sm">
                  {exportLog.map((log, index) => (
                    <li key={index} className="text-muted-foreground">
                      {log}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Test Section */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">🔒 Security Testing</CardTitle>
          <CardDescription>
            Test XSS prevention - these malicious diagrams should be sanitized
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            onClick={() => {
              setCode(`graph TD
    A[Normal] --> B[<img src=x onerror=alert('XSS')>]`)
            }}
          >
            Test: XSS via Image Tag
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCode(`graph TD
    A[<script>alert('XSS')</script>] --> B`)
            }}
          >
            Test: XSS via Script Tag
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            ✅ Both should be safely sanitized - no alerts should appear
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
