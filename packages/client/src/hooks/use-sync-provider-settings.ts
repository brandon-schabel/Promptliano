import { useEffect } from 'react'
import { useGetKvValue, useSetKvValue } from '@/hooks/use-kv-local-storage'
import type { AppSettings } from '@/types/app-settings'

/**
 * Hook to sync provider settings across the application
 * This ensures consistency between different provider configuration points
 */
export function useSyncProviderSettings() {
  const [appSettings] = useGetKvValue('appSettings')
  const { mutate: setAppSettings } = useSetKvValue('appSettings')

  useEffect(() => {
    // Sync provider settings when they change
    if (appSettings) {
      // Any provider-specific sync logic can go here
      // For now, this is a placeholder for future provider sync needs
    }
  }, [appSettings])

  const syncProviderSetting = (key: keyof AppSettings, value: any) => {
    setAppSettings((prev: AppSettings) => ({
      ...prev,
      [key]: value
    }))
  }

  return {
    syncProviderSetting,
    currentSettings: appSettings
  }
}