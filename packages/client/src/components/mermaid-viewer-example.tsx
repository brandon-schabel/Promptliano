/**
 * Mermaid Viewer Example
 *
 * Demonstrates how to use the MermaidViewer component with all features:
 * - Live preview with code editing
 * - AI-powered error fixing
 * - SVG/PNG export with custom dimensions
 * - Keyboard shortcuts
 */

import { MermaidViewer } from '@promptliano/ui'
import { useFixMermaidDiagram } from '@/hooks/api-hooks'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

const EXAMPLE_MERMAID_CODE = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
  C --> E[End]
  D --> E`

export function MermaidViewerExample() {
  const [code, setCode] = useState(EXAMPLE_MERMAID_CODE)
  const { mutateAsync: fixDiagram, isPending: isFixing } = useFixMermaidDiagram()

  // AI fix handler
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

  // Save handler
  const handleSave = (savedCode: string) => {
    setCode(savedCode)
    console.log('Diagram saved:', savedCode)
  }

  // Export handlers
  const handleSvgExport = (svgContent: string) => {
    console.log('SVG exported, length:', svgContent.length)
  }

  const handlePngExport = (blob: Blob, dimensions: { width: number; height: number }) => {
    console.log('PNG exported:', dimensions, 'Size:', blob.size, 'bytes')
  }

  // Keyboard shortcuts
  useHotkeys('mod+s', (e) => {
    e.preventDefault()
    handleSave(code)
  }, [code])

  return (
    <div className="h-[600px] w-full">
      <MermaidViewer
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
  )
}

/**
 * Minimal Example - Just the viewer
 */
export function MermaidViewerMinimal() {
  return (
    <div className="h-[400px]">
      <MermaidViewer
        initialCode="graph LR\n  A --> B --> C"
        defaultView="preview"
        editable={false}
      />
    </div>
  )
}

/**
 * Advanced Example - With all features and keyboard shortcuts
 */
export function MermaidViewerAdvanced() {
  const [currentCode, setCurrentCode] = useState(EXAMPLE_MERMAID_CODE)
  const { mutateAsync: fixDiagram } = useFixMermaidDiagram()

  // Keyboard shortcuts
  useHotkeys('mod+s', (e) => {
    e.preventDefault()
    console.log('Save shortcut triggered')
  })

  useHotkeys('mod+e', (e) => {
    e.preventDefault()
    console.log('Export shortcut triggered')
  })

  useHotkeys('mod+f', async (e) => {
    e.preventDefault()
    // Trigger AI fix
    try {
      const result = await fixDiagram({
        mermaidCode: currentCode,
        error: undefined,
        userIntent: 'Optimize this diagram'
      })
      setCurrentCode(result.fixedCode)
    } catch (error) {
      console.error('Fix failed:', error)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <kbd className="px-2 py-1 bg-muted rounded">Cmd/Ctrl + S</kbd>
        <span>Save</span>
        <span>•</span>
        <kbd className="px-2 py-1 bg-muted rounded">Cmd/Ctrl + E</kbd>
        <span>Export</span>
        <span>•</span>
        <kbd className="px-2 py-1 bg-muted rounded">Cmd/Ctrl + F</kbd>
        <span>AI Fix</span>
      </div>

      <div className="h-[600px]">
        <MermaidViewer
          initialCode={currentCode}
          onAiFix={async (code, error, intent) => {
            const result = await fixDiagram({
              mermaidCode: code,
              error,
              userIntent: intent
            })
            return {
              fixedCode: result.fixedCode,
              explanation: result.explanation
            }
          }}
          onSave={(code) => {
            setCurrentCode(code)
            console.log('Saved!')
          }}
          enableAiFix={true}
          defaultView="split"
        />
      </div>
    </div>
  )
}

/**
 * Usage Examples:
 *
 * 1. Basic Usage:
 * ```tsx
 * <MermaidViewer
 *   initialCode="graph LR\n  A --> B"
 *   defaultView="preview"
 * />
 * ```
 *
 * 2. With AI Fix:
 * ```tsx
 * const { mutateAsync: fixDiagram } = useFixMermaidDiagram()
 *
 * <MermaidViewer
 *   initialCode={code}
 *   onAiFix={async (code, error) => {
 *     const result = await fixDiagram({ mermaidCode: code, error })
 *     return { fixedCode: result.fixedCode, explanation: result.explanation }
 *   }}
 *   enableAiFix={true}
 * />
 * ```
 *
 * 3. With Export Callbacks:
 * ```tsx
 * <MermaidViewer
 *   initialCode={code}
 *   onSvgExport={(svg) => console.log('SVG exported')}
 *   onPngExport={(blob, dims) => console.log('PNG exported:', dims)}
 * />
 * ```
 *
 * 4. With Keyboard Shortcuts:
 * ```tsx
 * useHotkeys('mod+s', (e) => {
 *   e.preventDefault()
 *   // Save logic
 * })
 *
 * useHotkeys('mod+f', async (e) => {
 *   e.preventDefault()
 *   // Trigger AI fix
 * })
 * ```
 */
