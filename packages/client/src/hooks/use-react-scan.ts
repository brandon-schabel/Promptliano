import { useEffect, useRef } from 'react'

const REACT_SCAN_SCRIPT_ID = 'react-scan-script'
const REACT_SCAN_URL = 'https://unpkg.com/react-scan/dist/auto.global.js'

/**
 * Hook to dynamically load/unload React Scan devtools
 * @param enabled - Whether React Scan should be loaded
 */
export function useReactScan(enabled: boolean) {
  const isLoadedRef = useRef(false)
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    if (enabled && !isLoadedRef.current) {
      // Load React Scan
      const script = document.createElement('script')
      script.id = REACT_SCAN_SCRIPT_ID
      script.src = REACT_SCAN_URL
      script.async = true

      script.onload = () => {
        isLoadedRef.current = true
        console.log('React Scan DevTools loaded successfully')
      }

      script.onerror = (error) => {
        console.error('Failed to load React Scan DevTools:', error)
        // Clean up on error
        const existingScript = document.getElementById(REACT_SCAN_SCRIPT_ID)
        if (existingScript) {
          document.head.removeChild(existingScript)
        }
        scriptRef.current = null
      }

      document.head.appendChild(script)
      scriptRef.current = script
    } else if (!enabled && isLoadedRef.current) {
      // Unload React Scan
      const existingScript = document.getElementById(REACT_SCAN_SCRIPT_ID)
      if (existingScript) {
        document.head.removeChild(existingScript)
        console.log('React Scan DevTools unloaded')
      }

      // Reset state
      isLoadedRef.current = false
      scriptRef.current = null

      // If React Scan has global cleanup methods, call them here
      // This is a best-effort cleanup - some tools might require page refresh
      if (typeof window !== 'undefined' && (window as any).ReactScan) {
        try {
          // Check if React Scan has cleanup methods
          const reactScan = (window as any).ReactScan
          if (typeof reactScan.cleanup === 'function') {
            reactScan.cleanup()
          }
          // Remove from global scope
          delete (window as any).ReactScan
        } catch (error) {
          console.warn('Error during React Scan cleanup:', error)
        }
      }
    }

    // Cleanup function
    return () => {
      if (!enabled && scriptRef.current) {
        const existingScript = document.getElementById(REACT_SCAN_SCRIPT_ID)
        if (existingScript) {
          document.head.removeChild(existingScript)
        }
        isLoadedRef.current = false
        scriptRef.current = null
      }
    }
  }, [enabled])

  return {
    isLoaded: isLoadedRef.current,
    isEnabled: enabled
  }
}

/**
 * Utility function to check if React Scan is currently loaded
 */
export function isReactScanLoaded(): boolean {
  return (
    typeof window !== 'undefined' &&
    document.getElementById(REACT_SCAN_SCRIPT_ID) !== null &&
    (window as any).ReactScan !== undefined
  )
}

/**
 * Utility function to manually trigger React Scan (if loaded)
 */
export function triggerReactScan(): boolean {
  if (!isReactScanLoaded()) {
    console.warn('React Scan is not loaded')
    return false
  }

  try {
    const reactScan = (window as any).ReactScan
    if (typeof reactScan.scan === 'function') {
      reactScan.scan()
      return true
    } else if (typeof reactScan.start === 'function') {
      reactScan.start()
      return true
    }
    console.warn('React Scan loaded but no scan method found')
    return false
  } catch (error) {
    console.error('Error triggering React Scan:', error)
    return false
  }
}
