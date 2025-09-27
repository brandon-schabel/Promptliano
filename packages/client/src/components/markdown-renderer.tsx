import { useMemo } from 'react'
import { Streamdown } from 'streamdown'
import type { MermaidConfig } from 'mermaid'
import { useSelectSetting } from '@/hooks/use-kv-local-storage'

type MarkdownRendererProps = {
  content: string
  copyToClipboard?: (text: string) => void | Promise<void>
}

const DEFAULT_THEME_PAIR: [string, string] = ['github-light', 'github-dark']
const DEFAULT_IMAGE_PREFIXES = ['https://', 'data:image/'] as const
const DEFAULT_LINK_PREFIXES = ['https://', 'mailto:', 'tel:'] as const
const DEFAULT_ORIGIN = 'http://localhost'

function mapHljsToShiki(name?: string): string | undefined {
  if (!name) return undefined
  const normalized = name.replace(/[^a-z0-9]/gi, '').toLowerCase()

  if (normalized.includes('atomonelight')) return 'github-light'
  if (normalized.includes('atomonedark')) return 'github-dark'
  if (normalized.includes('githubdark')) return 'github-dark'
  if (normalized.includes('githublight')) return 'github-light'
  if (normalized.includes('dracula')) return 'dracula'
  if (normalized.includes('nord')) return 'nord'
  if (normalized.includes('tokyonight')) return 'tokyo-night'
  if (normalized.includes('monokai')) return 'monokai'

  return undefined
}

export function MarkdownRenderer({ content, copyToClipboard: _copyToClipboard }: MarkdownRendererProps) {
  const themeSetting = useSelectSetting('theme')
  const codeThemeDark = mapHljsToShiki(useSelectSetting('codeThemeDark'))
  const codeThemeLight = mapHljsToShiki(useSelectSetting('codeThemeLight'))

  const shikiTheme = useMemo<[string, string]>(() => {
    const light = codeThemeLight ?? DEFAULT_THEME_PAIR[0]
    const dark = codeThemeDark ?? DEFAULT_THEME_PAIR[1]
    return [light, dark]
  }, [codeThemeDark, codeThemeLight])

  const mermaidConfig = useMemo<MermaidConfig>(() => {
    return {
      theme: themeSetting === 'dark' ? 'dark' : 'default'
    }
  }, [themeSetting])

  const resolvedDefaultOrigin =
    typeof window !== 'undefined' && typeof window.location?.origin === 'string'
      ? window.location.origin
      : DEFAULT_ORIGIN

  return (
    <div className='relative my-2'>
      <Streamdown
        shikiTheme={shikiTheme}
        mermaidConfig={mermaidConfig}
        allowedImagePrefixes={[...DEFAULT_IMAGE_PREFIXES]}
        allowedLinkPrefixes={[...DEFAULT_LINK_PREFIXES]}
        defaultOrigin={resolvedDefaultOrigin}
        parseIncompleteMarkdown
        data-color-mode={themeSetting === 'dark' ? 'dark' : 'light'}
      >
        {content}
      </Streamdown>
    </div>
  )
}
