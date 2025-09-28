import { Streamdown } from 'streamdown'
import type { MermaidConfig } from 'mermaid'
import { useMemo, type ComponentProps } from 'react'

const DEFAULT_IMAGE_PREFIXES = ['https://', 'data:image/'] as const
const DEFAULT_LINK_PREFIXES = ['https://', 'mailto:', 'tel:'] as const
const DEFAULT_THEME_PAIR = ['github-light', 'github-dark'] as const
const DEFAULT_ORIGIN = 'http://localhost'

type ShikiThemeProp = ComponentProps<typeof Streamdown>['shikiTheme']

export type MarkdownRendererProps = {
  content: string
  isDarkMode?: boolean
  codeTheme?: string | [string, string]
  allowedImagePrefixes?: string[]
  allowedLinkPrefixes?: string[]
  mermaidConfig?: MermaidConfig
  defaultOrigin?: string
  copyToClipboard?: (text: string) => void
}

export function MarkdownRenderer({
  content,
  isDarkMode: _isDarkMode = false,
  codeTheme,
  allowedImagePrefixes,
  allowedLinkPrefixes,
  mermaidConfig,
  defaultOrigin,
  copyToClipboard: _copyToClipboard
}: MarkdownRendererProps) {
  const shikiThemeCandidate = Array.isArray(codeTheme)
    ? codeTheme
    : codeTheme
      ? [codeTheme, codeTheme]
      : DEFAULT_THEME_PAIR

  // Ensure the theme tuple matches the expected `[BundledTheme, BundledTheme]` type
  const shikiTheme: ShikiThemeProp = [
    shikiThemeCandidate[0] as unknown as any,
    shikiThemeCandidate[1] as unknown as any
  ] as unknown as ShikiThemeProp

  const runtimeOrigin =
    typeof window !== 'undefined' && typeof window.location?.origin === 'string' ? window.location.origin : undefined

  const resolvedDefaultOrigin = defaultOrigin ?? runtimeOrigin ?? DEFAULT_ORIGIN

  // Prefer provided mermaidConfig, otherwise derive minimal config from theme
  const derivedMermaidConfig = useMemo<MermaidConfig>(() => {
    if (mermaidConfig) return mermaidConfig
    return {
      // Use "dark" or default based on provided isDarkMode flag
      theme: _isDarkMode ? 'dark' : 'default'
    }
  }, [mermaidConfig, _isDarkMode])

  return (
    <Streamdown
      mermaidConfig={derivedMermaidConfig}
      shikiTheme={shikiTheme}
      allowedImagePrefixes={allowedImagePrefixes ?? [...DEFAULT_IMAGE_PREFIXES]}
      allowedLinkPrefixes={allowedLinkPrefixes ?? [...DEFAULT_LINK_PREFIXES]}
      defaultOrigin={resolvedDefaultOrigin}
      parseIncompleteMarkdown
      data-color-mode={_isDarkMode ? 'dark' : 'light'}
    >
      {content}
    </Streamdown>
  )
}
