/**
 * Mermaid Export Utilities
 *
 * Utilities for exporting mermaid diagrams to SVG and PNG formats.
 * Based on patterns from svg-preview.tsx
 */

export interface PngExportOptions {
  width: number
  height: number
  backgroundColor?: 'transparent' | 'white' | 'black'
  scale?: number
}

export interface ExportResult {
  success: boolean
  error?: string
}

/**
 * Sanitize SVG content to prevent XSS attacks
 * Removes potentially dangerous elements and attributes while preserving visual diagram
 */
function sanitizeSvg(svgElement: SVGElement): void {
  // Remove script tags
  const scripts = svgElement.querySelectorAll('script')
  scripts.forEach(script => script.remove())

  // Sanitize foreignObject contents (used by mermaid for text rendering)
  // Instead of removing them, we clean their contents to preserve text
  const foreignObjects = svgElement.querySelectorAll('foreignObject')
  foreignObjects.forEach(foreignObj => {
    // Remove scripts within foreignObject
    const innerScripts = foreignObj.querySelectorAll('script')
    innerScripts.forEach(script => script.remove())

    // Remove dangerous elements (iframe, object, embed)
    const dangerousElements = foreignObj.querySelectorAll('iframe, object, embed, link, meta')
    dangerousElements.forEach(el => el.remove())

    // Remove event handlers from all child elements
    const childElements = foreignObj.querySelectorAll('*')
    childElements.forEach(child => {
      // Remove all event handler attributes
      Array.from(child.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          child.removeAttribute(attr.name)
        }
      })

      // Remove javascript: URLs
      const href = child.getAttribute('href')
      if (href && href.trim().toLowerCase().startsWith('javascript:')) {
        child.removeAttribute('href')
      }

      // Remove style attributes that could contain expressions
      const style = child.getAttribute('style')
      if (style && (style.includes('expression') || style.includes('javascript:'))) {
        child.removeAttribute('style')
      }
    })
  })

  // List of event handler attributes to remove
  const eventHandlers = [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
    'onmouseenter', 'onmouseleave', 'onfocus', 'onblur', 'onchange',
    'oninput', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress'
  ]

  // Remove event handlers from all elements
  const allElements = svgElement.querySelectorAll('*')
  allElements.forEach(element => {
    eventHandlers.forEach(handler => {
      if (element.hasAttribute(handler)) {
        element.removeAttribute(handler)
      }
    })

    // Remove javascript: URLs from href and xlink:href
    const href = element.getAttribute('href')
    const xlinkHref = element.getAttribute('xlink:href')

    if (href && href.trim().toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('href')
    }
    if (xlinkHref && xlinkHref.trim().toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('xlink:href')
    }

    // Remove data: URLs that could contain scripts
    if (href && href.trim().toLowerCase().startsWith('data:')) {
      element.removeAttribute('href')
    }
    if (xlinkHref && xlinkHref.trim().toLowerCase().startsWith('data:')) {
      element.removeAttribute('xlink:href')
    }
  })

  // Remove any <use> elements with external references
  const useElements = svgElement.querySelectorAll('use')
  useElements.forEach(use => {
    const href = use.getAttribute('href') || use.getAttribute('xlink:href')
    if (href && (href.includes('http://') || href.includes('https://') || href.includes('//'))) {
      use.remove()
    }
  })
}

/**
 * Inline computed styles for SVG elements to ensure proper rendering when exported
 */
function inlineStyles(svgElement: SVGElement): void {
  // Get all elements in the SVG
  const allElements = svgElement.querySelectorAll('*')

  allElements.forEach(element => {
    if (element instanceof SVGElement || element instanceof HTMLElement) {
      const computedStyle = window.getComputedStyle(element)

      // List of important style properties to inline
      const importantStyles = [
        'fill', 'stroke', 'stroke-width', 'font-family', 'font-size',
        'font-weight', 'text-anchor', 'dominant-baseline', 'color',
        'opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin'
      ]

      // Inline each style property
      importantStyles.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop)
        if (value && value !== 'none' && value !== 'normal') {
          element.style.setProperty(prop, value)
        }
      })
    }
  })
}

/**
 * Extract SVG content from a rendered mermaid diagram
 * Includes XSS sanitization to prevent malicious code execution
 */
export function extractMermaidSvg(containerElement: HTMLElement): string | null {
  const svgElement = containerElement.querySelector('svg')
  if (!svgElement) {
    return null
  }

  // Clone the SVG to avoid modifying the original
  const clone = svgElement.cloneNode(true) as SVGElement

  // Inline computed styles for proper export
  inlineStyles(clone)

  // Sanitize the SVG to remove XSS vectors
  sanitizeSvg(clone)

  // Ensure proper namespace
  if (!clone.hasAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }

  // Get the outer HTML
  return clone.outerHTML
}

/**
 * Convert mermaid diagram to SVG and download
 */
export async function exportMermaidToSvg(
  containerElement: HTMLElement,
  filename: string = 'diagram.svg'
): Promise<ExportResult> {
  try {
    const svgContent = extractMermaidSvg(containerElement)

    if (!svgContent) {
      return {
        success: false,
        error: 'No SVG content found. Make sure the diagram is rendered.'
      }
    }

    // Create blob and download
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    downloadFile(blob, filename.endsWith('.svg') ? filename : `${filename}.svg`)

    return { success: true }
  } catch (error) {
    console.error('Failed to export SVG:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Convert SVG to PNG with custom dimensions
 */
export async function svgToPng(
  svgContent: string,
  options: PngExportOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const {
      width,
      height,
      backgroundColor = 'transparent',
      scale = 1
    } = options

    // Create an image element
    const img = new Image()
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      try {
        // Create canvas with desired dimensions
        const canvas = document.createElement('canvas')
        canvas.width = width * scale
        canvas.height = height * scale

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Set background if not transparent
        if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor === 'white' ? '#ffffff' : '#000000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        // Draw the image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create PNG blob'))
            }
          },
          'image/png',
          1.0
        )
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG image'))
    }

    img.src = url
  })
}

/**
 * Export mermaid diagram to PNG with custom dimensions
 */
export async function exportMermaidToPng(
  containerElement: HTMLElement,
  options: PngExportOptions,
  filename: string = 'diagram.png'
): Promise<ExportResult> {
  try {
    const svgContent = extractMermaidSvg(containerElement)

    if (!svgContent) {
      return {
        success: false,
        error: 'No SVG content found. Make sure the diagram is rendered.'
      }
    }

    // Convert to PNG
    const pngBlob = await svgToPng(svgContent, options)

    // Download
    downloadFile(pngBlob, filename.endsWith('.png') ? filename : `${filename}.png`)

    return { success: true }
  } catch (error) {
    console.error('Failed to export PNG:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Download a file blob with a given filename
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'

  document.body.appendChild(a)
  a.click()

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

/**
 * Get SVG dimensions from content
 */
export function getSvgDimensions(svgContent: string): {
  width: number
  height: number
} | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svg = doc.querySelector('svg')

    if (!svg) {
      return null
    }

    // Try to get dimensions from attributes
    const widthAttr = svg.getAttribute('width')
    const heightAttr = svg.getAttribute('height')

    if (widthAttr && heightAttr) {
      return {
        width: parseFloat(widthAttr),
        height: parseFloat(heightAttr)
      }
    }

    // Fallback to viewBox
    const viewBox = svg.getAttribute('viewBox')
    if (viewBox) {
      const [, , width, height] = viewBox.split(' ').map(Number)
      return { width, height }
    }

    // Default fallback
    return { width: 800, height: 600 }
  } catch (error) {
    console.error('Failed to get SVG dimensions:', error)
    return null
  }
}

/**
 * Common export size presets
 */
export const EXPORT_SIZE_PRESETS = {
  original: { label: 'Original Size', scale: 1 },
  hd: { label: 'HD (1920×1080)', width: 1920, height: 1080 },
  '4k': { label: '4K (3840×2160)', width: 3840, height: 2160 },
  '8k': { label: '8K (7680×4320)', width: 7680, height: 4320 },
  square: { label: 'Square (2000×2000)', width: 2000, height: 2000 },
  social: { label: 'Social Media (1200×630)', width: 1200, height: 630 },
  custom: { label: 'Custom Size' }
} as const

export type ExportSizePreset = keyof typeof EXPORT_SIZE_PRESETS
