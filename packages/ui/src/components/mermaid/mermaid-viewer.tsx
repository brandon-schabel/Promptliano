/**
 * Mermaid Viewer Component
 *
 * A comprehensive mermaid diagram viewer with:
 * - Live preview using Streamdown
 * - Code editing with Monaco (optional) or textarea
 * - AI-powered error fixing
 * - SVG/PNG export with size configuration
 * - Side-by-side and tab views
 */

import * as React from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '../../utils'
import { Button } from '../core/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../core/tabs'
import { Textarea } from '../core/textarea'
import { Alert, AlertDescription } from '../core/alert'
import { Popover, PopoverContent, PopoverTrigger } from '../core/popover'
import { Badge } from '../core/badge'
import { Separator } from '../core/separator'
import {
  Download,
  FileDown,
  Image as ImageIcon,
  Code2,
  Eye,
  Copy,
  Check,
  Wand2,
  Loader2,
  AlertCircle,
  Info,
  Maximize2,
  SplitSquareVertical
} from 'lucide-react'
import { toast } from 'sonner'

// Import utilities
import { parseMermaidError, validateMermaidSyntax, type ParsedMermaidError } from './mermaid-error-parser'
import {
  exportMermaidToSvg,
  exportMermaidToPng,
  getSvgDimensions,
  EXPORT_SIZE_PRESETS,
  type PngExportOptions,
  type ExportSizePreset
} from './mermaid-export-utils'

// Mermaid rendering
import mermaid from 'mermaid'

export interface MermaidViewerProps {
  /** Initial mermaid code */
  initialCode?: string

  /** Callback when code is saved */
  onSave?: (code: string) => void

  /** Callback when PNG is exported */
  onPngExport?: (blob: Blob, dimensions: { width: number; height: number }) => void

  /** Callback when SVG is exported */
  onSvgExport?: (svgContent: string) => void

  /** Additional className for container */
  className?: string

  /** Show toolbar (default: true) */
  showToolbar?: boolean

  /** Enable AI fix feature (default: true) */
  enableAiFix?: boolean

  /** Custom AI fix handler (if not provided, will be a no-op) */
  onAiFix?: (
    code: string,
    error?: string,
    userIntent?: string
  ) => Promise<{
    fixedCode: string
    explanation?: string
  }>

  /** Default view mode */
  defaultView?: 'code' | 'preview' | 'split'

  /** Allow editing (default: true) */
  editable?: boolean
}

export function MermaidViewer({
  initialCode = '',
  onSave,
  onPngExport,
  onSvgExport,
  className,
  showToolbar = true,
  enableAiFix = true,
  onAiFix,
  defaultView = 'split',
  editable = true
}: MermaidViewerProps) {
  // State
  const [code, setCode] = useState(initialCode)
  const [view, setView] = useState<'code' | 'preview' | 'split'>(defaultView)
  const [renderError, setRenderError] = useState<ParsedMermaidError | null>(null)
  const [copied, setCopied] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [pngExportSize, setPngExportSize] = useState<ExportSizePreset>('hd')
  const [customPngSize, setCustomPngSize] = useState({ width: 1920, height: 1080 })

  // Refs
  const previewRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Validate code whenever it changes
  useEffect(() => {
    const validation = validateMermaidSyntax(code)
    if (!validation.isValid && validation.error) {
      setRenderError(validation.error)
    } else {
      setRenderError(null)
    }
  }, [code])

  // Handle code change
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [])

  // Copy code to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy code')
    }
  }, [code])

  // Handle save
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(code)
      toast.success('Diagram saved')
    }
  }, [code, onSave])

  // Handle SVG export
  const handleSvgExport = useCallback(async () => {
    if (!previewRef.current) {
      toast.error('No preview available to export')
      return
    }

    const result = await exportMermaidToSvg(previewRef.current, 'diagram.svg')

    if (result.success) {
      toast.success('Diagram exported as SVG')
      if (onSvgExport) {
        const svgContent = previewRef.current.querySelector('svg')?.outerHTML
        if (svgContent) {
          onSvgExport(svgContent)
        }
      }
    } else {
      toast.error(result.error || 'Failed to export SVG')
    }
  }, [onSvgExport])

  // Handle PNG export
  const handlePngExport = useCallback(async () => {
    if (!previewRef.current) {
      toast.error('No preview available to export')
      return
    }

    // Get dimensions
    let width: number
    let height: number

    if (pngExportSize === 'original') {
      const svgContent = previewRef.current.querySelector('svg')?.outerHTML
      if (svgContent) {
        const dimensions = getSvgDimensions(svgContent)
        if (dimensions) {
          width = dimensions.width
          height = dimensions.height
        } else {
          width = 1920
          height = 1080
        }
      } else {
        width = 1920
        height = 1080
      }
    } else if (pngExportSize === 'custom') {
      width = customPngSize.width
      height = customPngSize.height
    } else {
      const preset = EXPORT_SIZE_PRESETS[pngExportSize]
      width = preset.width
      height = preset.height
    }

    const options: PngExportOptions = {
      width,
      height,
      backgroundColor: 'transparent'
    }

    const result = await exportMermaidToPng(previewRef.current, options, 'diagram.png')

    if (result.success) {
      toast.success(`Diagram exported as PNG (${width}×${height})`)
      if (onPngExport) {
        // Re-export as blob for callback
        const svgContent = previewRef.current.querySelector('svg')?.outerHTML
        if (svgContent) {
          const { svgToPng } = await import('./mermaid-export-utils')
          const blob = await svgToPng(svgContent, options)
          onPngExport(blob, { width, height })
        }
      }
    } else {
      toast.error(result.error || 'Failed to export PNG')
    }
  }, [pngExportSize, customPngSize, onPngExport])

  // Handle AI fix
  const handleAiFix = useCallback(async () => {
    if (!onAiFix) {
      toast.error('AI fix is not configured')
      return
    }

    setIsFixing(true)
    try {
      const result = await onAiFix(
        code,
        renderError?.message,
        undefined // userIntent can be added later
      )

      if (result.fixedCode) {
        setCode(result.fixedCode)
        if (result.explanation) {
          toast.success(`Fixed: ${result.explanation}`)
        } else {
          toast.success('Diagram fixed successfully')
        }
      }
    } catch (error) {
      console.error('Failed to fix diagram:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fix diagram')
    } finally {
      setIsFixing(false)
    }
  }, [code, renderError, onAiFix])

  // Handle mermaid rendering errors
  const handleRenderError = useCallback((error: Error) => {
    const parsed = parseMermaidError(error)
    setRenderError(parsed)
  }, [])

  // Render mermaid diagram
  useEffect(() => {
    if (!code.trim()) return

    // Only render if preview ref is available (in preview or split view)
    if (!previewRef.current) return

    // Initialize mermaid once
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose'
    })

    const renderDiagram = async () => {
      const container = previewRef.current
      if (!container) return

      try {
        // Clear previous content first
        container.innerHTML = ''

        // Create a temporary div for mermaid to render into
        const tempDiv = document.createElement('div')
        tempDiv.className = 'mermaid'
        tempDiv.textContent = code

        // Append to container
        container.appendChild(tempDiv)

        // Let mermaid render the diagram in place
        await mermaid.run({
          nodes: [tempDiv],
          suppressErrors: false
        })

        // Clear error if successful
        setRenderError(null)
      } catch (error) {
        console.error('Mermaid render error:', error)
        const parsed = parseMermaidError(error as Error)
        setRenderError(parsed)

        // Clear the container on error
        if (container) {
          container.innerHTML = ''
        }
      }
    }

    renderDiagram()
  }, [code, view]) // Add view to dependencies so it re-renders when switching views

  // Render the mermaid preview
  const renderPreview = () => {
    if (!code.trim()) {
      return (
        <div className='flex items-center justify-center h-full text-muted-foreground'>
          <div className='text-center'>
            <Info className='w-12 h-12 mx-auto mb-2 opacity-50' />
            <p>Enter mermaid code to see preview</p>
          </div>
        </div>
      )
    }

    return (
      <div
        key={`preview-${view}`}
        ref={previewRef}
        className='w-full h-full overflow-auto p-4 flex items-center justify-center'
      />
    )
  }

  // Render toolbar
  const renderToolbar = () => {
    if (!showToolbar) return null

    return (
      <div className='flex items-center gap-2 p-2 border-b bg-muted/30'>
        {/* View mode tabs */}
        <div className='flex items-center gap-1 mr-auto'>
          <Button
            variant={view === 'code' ? 'default' : 'ghost'}
            size='sm'
            onClick={() => setView('code')}
            title='Code only'
          >
            <Code2 className='h-4 w-4 mr-1' />
            Code
          </Button>
          <Button
            variant={view === 'preview' ? 'default' : 'ghost'}
            size='sm'
            onClick={() => setView('preview')}
            title='Preview only'
          >
            <Eye className='h-4 w-4 mr-1' />
            Preview
          </Button>
          <Button
            variant={view === 'split' ? 'default' : 'ghost'}
            size='sm'
            onClick={() => setView('split')}
            title='Side by side'
          >
            <SplitSquareVertical className='h-4 w-4 mr-1' />
            Split
          </Button>
        </div>

        <Separator orientation='vertical' className='h-6' />

        {/* Actions */}
        <Button variant='ghost' size='sm' onClick={handleCopy} title='Copy code'>
          {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
        </Button>

        {enableAiFix && onAiFix && renderError && (
          <Button variant='default' size='sm' onClick={handleAiFix} disabled={isFixing} title='Fix with AI'>
            {isFixing ? <Loader2 className='h-4 w-4 mr-1 animate-spin' /> : <Wand2 className='h-4 w-4 mr-1' />}
            Fix
          </Button>
        )}

        {onSave && (
          <Button variant='ghost' size='sm' onClick={handleSave} title='Save diagram'>
            <FileDown className='h-4 w-4 mr-1' />
            Save
          </Button>
        )}

        <Separator orientation='vertical' className='h-6' />

        {/* Export buttons */}
        <Button variant='ghost' size='sm' onClick={handleSvgExport} title='Export as SVG'>
          <Download className='h-4 w-4 mr-1' />
          SVG
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant='ghost' size='sm' title='Export as PNG'>
              <ImageIcon className='h-4 w-4 mr-1' />
              PNG
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-80'>
            <div className='space-y-4'>
              <h4 className='font-medium'>PNG Export Settings</h4>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Size Preset</label>
                <div className='grid grid-cols-2 gap-2'>
                  {(Object.keys(EXPORT_SIZE_PRESETS) as ExportSizePreset[]).map((preset) => (
                    <Button
                      key={preset}
                      variant={pngExportSize === preset ? 'default' : 'outline'}
                      size='sm'
                      onClick={() => setPngExportSize(preset)}
                      className='justify-start'
                    >
                      {EXPORT_SIZE_PRESETS[preset].label}
                    </Button>
                  ))}
                </div>
              </div>

              {pngExportSize === 'custom' && (
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Custom Size</label>
                  <div className='flex items-center gap-2'>
                    <input
                      type='number'
                      value={customPngSize.width}
                      onChange={(e) =>
                        setCustomPngSize((prev) => ({ ...prev, width: parseInt(e.target.value) || 1920 }))
                      }
                      className='flex-1 px-2 py-1 border rounded text-sm'
                      placeholder='Width'
                    />
                    <span>×</span>
                    <input
                      type='number'
                      value={customPngSize.height}
                      onChange={(e) =>
                        setCustomPngSize((prev) => ({ ...prev, height: parseInt(e.target.value) || 1080 }))
                      }
                      className='flex-1 px-2 py-1 border rounded text-sm'
                      placeholder='Height'
                    />
                  </div>
                </div>
              )}

              <Button onClick={handlePngExport} className='w-full'>
                <Download className='h-4 w-4 mr-2' />
                Export PNG
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Status indicators */}
        {renderError && (
          <Badge variant='destructive' className='ml-2'>
            <AlertCircle className='h-3 w-3 mr-1' />
            Error
          </Badge>
        )}
      </div>
    )
  }

  // Render error alert
  const renderErrorAlert = () => {
    if (!renderError) return null

    return (
      <Alert variant='destructive' className='m-4'>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          <div className='space-y-1'>
            <p className='font-medium'>{renderError.message}</p>
            {renderError.suggestion && <p className='text-sm opacity-90'>{renderError.suggestion}</p>}
            {renderError.line && <p className='text-xs opacity-75'>Line {renderError.line}</p>}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={cn('flex flex-col h-full border rounded-lg bg-background', className)}>
      {renderToolbar()}

      <div className='flex-1 overflow-hidden'>
        {view === 'code' && (
          <div className='h-full p-4'>
            <Textarea
              ref={textareaRef}
              value={code}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleCodeChange(e.target.value)}
              className='font-mono text-sm h-full resize-none'
              placeholder='Enter mermaid code here...'
              disabled={!editable}
            />
          </div>
        )}

        {view === 'preview' && (
          <div className='h-full'>
            {renderErrorAlert()}
            {renderPreview()}
          </div>
        )}

        {view === 'split' && (
          <div className='flex h-full'>
            <div className='flex-1 border-r p-4'>
              <Textarea
                ref={textareaRef}
                value={code}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleCodeChange(e.target.value)}
                className='font-mono text-sm h-full resize-none'
                placeholder='Enter mermaid code here...'
                disabled={!editable}
              />
            </div>
            <div className='flex-1'>
              {renderErrorAlert()}
              {renderPreview()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

MermaidViewer.displayName = 'MermaidViewer'
