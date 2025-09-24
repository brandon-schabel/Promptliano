import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useSelectSetting } from '@/hooks/use-kv-local-storage'

type MermaidDiagramProps = {
  code: string
}

const BASE_CONFIG = {
  startOnLoad: false,
  securityLevel: 'loose' as const,
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true
  }
}

let renderCounter = 0

function nextRenderId() {
  renderCounter += 1
  const randomSuffix = Math.random().toString(36).slice(2, 9)
  return `mermaid-${renderCounter}-${randomSuffix}`
}

const resolveThemeVariables = (isDarkMode: boolean) => ({
  darkMode: isDarkMode,
  background: isDarkMode ? '#1a1a1a' : '#ffffff',
  primaryColor: isDarkMode ? '#4f46e5' : '#2563eb',
  primaryTextColor: isDarkMode ? '#f9fafb' : '#111827',
  lineColor: isDarkMode ? '#a5b4fc' : '#1e3a8a'
})

const MermaidDiagramContent = ({ code }: MermaidDiagramProps) => {
  const isDarkMode = useSelectSetting('theme') === 'dark'
  const [svg, setSvg] = useState('')
  const [isRendering, setIsRendering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  const renderVersion = useRef(0)

  const themeConfig = useMemo(
    () => ({
      ...BASE_CONFIG,
      theme: 'base' as const,
      themeVariables: resolveThemeVariables(isDarkMode)
    }),
    [isDarkMode]
  )

  useEffect(() => {
    mermaid.initialize(themeConfig)
  }, [themeConfig])

  useLayoutEffect(() => {
    if (!code.trim()) {
      setSvg('')
      setError(null)
      setIsRendering(false)
      return
    }

    let cancelled = false
    const currentRender = renderVersion.current + 1
    renderVersion.current = currentRender
    const renderId = nextRenderId()

    const renderDiagram = async () => {
      setIsRendering(true)
      setError(null)

      try {
        const { svg: renderedSvg } = await mermaid.render(renderId, code)

        if (!cancelled && isMounted.current && renderVersion.current === currentRender) {
          setSvg(renderedSvg)
        }
      } catch (err) {
        if (!cancelled && isMounted.current && renderVersion.current === currentRender) {
          const message = err instanceof Error ? err.message : 'Unable to render diagram'
          setError(message)
          setSvg('')
        }
      } finally {
        if (!cancelled && isMounted.current && renderVersion.current === currentRender) {
          setIsRendering(false)
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [code])

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  if (isRendering) {
    return <div className='mermaid-loading text-sm text-muted-foreground'>Rendering diagram…</div>
  }

  if (error) {
    return (
      <div className='mermaid-error rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
        <p className='font-medium'>Error rendering diagram: {error}</p>
        <details className='mt-2 whitespace-pre-wrap break-words text-xs text-destructive'>
          <summary className='cursor-pointer'>View source</summary>
          <pre className='mt-2 overflow-x-auto rounded bg-background/40 p-2 text-left text-[11px] text-foreground'>
            <code>{code}</code>
          </pre>
        </details>
      </div>
    )
  }

  return <div className='mermaid-diagram [&>svg]:h-auto [&>svg]:w-full' dangerouslySetInnerHTML={{ __html: svg }} />
}

const MermaidDiagramWithLazyLoad = ({ code }: MermaidDiagramProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    const element = containerRef.current

    if (!element || shouldRender) {
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setShouldRender(true)
            observer.disconnect()
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [shouldRender])

  return (
    <div ref={containerRef} className='mermaid-wrapper min-h-[200px]'>
      {shouldRender ? (
        <MermaidDiagramContent code={code} />
      ) : (
        <div className='mermaid-placeholder flex h-full w-full items-center justify-center text-sm text-muted-foreground'>
          Diagram will render when visible
        </div>
      )}
    </div>
  )
}

export const MermaidDiagram = memo(MermaidDiagramWithLazyLoad)
