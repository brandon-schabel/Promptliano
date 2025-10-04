import { describe, it, expect } from 'bun:test'
import {
  KVKeyEnum,
  KVDefaultValues,
  KvSchemas,
  kvKeyEnumSchema,
  chatSettingsSchema,
  type KVKey,
  type KVValue,
  type ChatSettings
} from './kv-store.schemas'
import { globalStateSchema } from './global-state-schema'

describe('KV Store Schemas', () => {
  describe('KVKeyEnum', () => {
    it('should have all expected keys', () => {
      expect(KVKeyEnum.appSettings).toBe('appSettings')
      expect(KVKeyEnum.projectTabs).toBe('projectTabs')
      expect(KVKeyEnum.activeProjectTabId).toBe('activeProjectTabId')
      expect(KVKeyEnum.activeChatId).toBe('activeChatId')
      expect(KVKeyEnum.recentProjects).toBe('recentProjects')
      expect(KVKeyEnum.chatSettings).toBe('chatSettings')
    })

    it('should validate key enum schema', () => {
      Object.values(KVKeyEnum).forEach((key) => {
        expect(() => kvKeyEnumSchema.parse(key)).not.toThrow()
      })
    })

    it('should reject invalid keys', () => {
      expect(() => kvKeyEnumSchema.parse('invalidKey')).toThrow()
      expect(() => kvKeyEnumSchema.parse('')).toThrow()
      expect(() => kvKeyEnumSchema.parse(null)).toThrow()
    })
  })

  describe('KVDefaultValues', () => {
    it('should have default values for all keys', () => {
      Object.values(KVKeyEnum).forEach((key) => {
        expect(KVDefaultValues[key as KVKey]).toBeDefined()
      })
    })

    it('should have valid default values that pass schema validation', () => {
      // Test appSettings
      expect(() => KvSchemas.appSettings.parse(KVDefaultValues.appSettings)).not.toThrow()

      // Test projectTabs
      expect(() => KvSchemas.projectTabs.parse(KVDefaultValues.projectTabs)).not.toThrow()

      // Test activeProjectTabId
      expect(() => KvSchemas.activeProjectTabId.parse(KVDefaultValues.activeProjectTabId)).not.toThrow()

      // Test activeChatId
      expect(() => KvSchemas.activeChatId.parse(KVDefaultValues.activeChatId)).not.toThrow()
    })

    it('should have sensible default values', () => {
      expect(KVDefaultValues.activeChatId).toBe(-1)
      expect(KVDefaultValues.activeProjectTabId).toBe(-1)
      expect(KVDefaultValues.appSettings).toBeDefined()
      expect(KVDefaultValues.appSettings.theme).toBe('light')
      expect(KVDefaultValues.projectTabs).toBeDefined()
      expect(KVDefaultValues.projectTabs.defaultTab).toBeDefined()
    })

    it('should create valid global state from default values', () => {
      const globalState = {
        appSettings: KVDefaultValues.appSettings,
        projectTabs: KVDefaultValues.projectTabs,
        projectActiveTabId: KVDefaultValues.activeProjectTabId,
        activeChatId: KVDefaultValues.activeChatId,
        chatLinkSettings: {}
      }

      expect(() => globalStateSchema.parse(globalState)).not.toThrow()
    })
  })

  describe('KvSchemas', () => {
    it('should validate appSettings schema', () => {
      const validAppSettings = {
        theme: 'dark',
        language: 'en',
        temperature: 0.8,
        maxTokens: 2048
      }

      expect(() => KvSchemas.appSettings.parse(validAppSettings)).not.toThrow()

      // Should work with partial data (defaults should fill in)
      expect(() => KvSchemas.appSettings.parse({ theme: 'dark' })).not.toThrow()
    })

    it('should validate projectTabs schema', () => {
      const validProjectTabs = {
        tab1: {
          selectedProjectId: 123,
          editProjectId: -1,
          editPromptId: -1,
          selectedFiles: [1, 2, 3],
          selectedPrompts: [4, 5],
          displayName: 'Test Tab'
        }
      }

      expect(() => KvSchemas.projectTabs.parse(validProjectTabs)).not.toThrow()

      // Should work with empty object
      expect(() => KvSchemas.projectTabs.parse({})).not.toThrow()
    })

    it('should validate activeProjectTabId schema', () => {
      expect(() => KvSchemas.activeProjectTabId.parse(1)).not.toThrow()
      expect(() => KvSchemas.activeProjectTabId.parse(999)).not.toThrow()
      expect(() => KvSchemas.activeProjectTabId.parse(-1)).not.toThrow()

      // Should use default for undefined
      const result = KvSchemas.activeProjectTabId.parse(undefined)
      expect(result).toBe(-1)
    })

    it('should validate activeChatId schema', () => {
      expect(() => KvSchemas.activeChatId.parse(1)).not.toThrow()
      expect(() => KvSchemas.activeChatId.parse(999)).not.toThrow()
      expect(() => KvSchemas.activeChatId.parse(-1)).not.toThrow()

      // Should use default for undefined
      const result = KvSchemas.activeChatId.parse(undefined)
      expect(result).toBe(-1)
    })

    it('should reject invalid data types', () => {
      expect(() => KvSchemas.activeProjectTabId.parse('not-a-number')).toThrow()
      expect(() => KvSchemas.activeChatId.parse('not-a-number')).toThrow()
      expect(() => KvSchemas.appSettings.parse('not-an-object')).toThrow()
      expect(() => KvSchemas.projectTabs.parse('not-an-object')).toThrow()
    })
  })

  describe('Type safety', () => {
    it('should have correct type inference for KVValue', () => {
      // These should compile without type errors
      const appSettings: KVValue<'appSettings'> = KVDefaultValues.appSettings
      const projectTabs: KVValue<'projectTabs'> = KVDefaultValues.projectTabs
      const activeTabId: KVValue<'activeProjectTabId'> = KVDefaultValues.activeProjectTabId
      const activeChatId: KVValue<'activeChatId'> = KVDefaultValues.activeChatId

      expect(appSettings).toBeDefined()
      expect(projectTabs).toBeDefined()
      expect(activeTabId).toBeDefined()
      expect(activeChatId).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('should not crash when creating default values', () => {
      // This test ensures that the initialization doesn't throw
      expect(() => {
        const values = KVDefaultValues
        expect(values).toBeDefined()
      }).not.toThrow()
    })

    it('should handle schema validation errors gracefully', () => {
      // Test that invalid data throws expected errors
      expect(() => KvSchemas.appSettings.parse(null)).toThrow()
      expect(() => KvSchemas.projectTabs.parse(null)).toThrow()
      expect(() => KvSchemas.activeProjectTabId.parse(null)).toThrow()
      expect(() => KvSchemas.activeChatId.parse(null)).toThrow()
    })
  })

  describe('Integration with global state', () => {
    it('should be compatible with global state schema', () => {
      // Create a global state using KV default values
      const globalState = {
        appSettings: KVDefaultValues.appSettings,
        projectTabs: KVDefaultValues.projectTabs,
        projectActiveTabId: KVDefaultValues.activeProjectTabId,
        activeChatId: KVDefaultValues.activeChatId,
        chatLinkSettings: {}
      }

      // Should validate against global state schema
      expect(() => globalStateSchema.parse(globalState)).not.toThrow()
    })

    it('should handle partial updates correctly', () => {
      // Test that partial updates work with the schemas
      const partialAppSettings = { theme: 'dark' as const }
      const result = KvSchemas.appSettings.parse(partialAppSettings)

      expect(result.theme).toBe('dark')
      expect(result.language).toBe('en') // Should have default
    })
  })

  describe('Chat Settings Schema', () => {
    describe('Schema validation', () => {
      it('should accept valid chat settings', () => {
        const validSettings = {
          defaultMaxMessages: 50,
          autoAdjustContext: true,
          showTokenCounts: true,
          warnOnLargeContext: true,
          largeContextThreshold: 8000
        }

        const result = chatSettingsSchema.parse(validSettings)
        expect(result.defaultMaxMessages).toBe(50)
        expect(result.autoAdjustContext).toBe(true)
        expect(result.showTokenCounts).toBe(true)
        expect(result.warnOnLargeContext).toBe(true)
        expect(result.largeContextThreshold).toBe(8000)
      })

      it('should use default values when not provided', () => {
        const result = chatSettingsSchema.parse({})
        expect(result.defaultMaxMessages).toBe(50)
        expect(result.autoAdjustContext).toBe(true)
        expect(result.showTokenCounts).toBe(true)
        expect(result.warnOnLargeContext).toBe(true)
        expect(result.largeContextThreshold).toBe(8000)
      })

      it('should accept partial settings and apply defaults', () => {
        const partialSettings = {
          defaultMaxMessages: 25,
          showTokenCounts: false
        }

        const result = chatSettingsSchema.parse(partialSettings)
        expect(result.defaultMaxMessages).toBe(25)
        expect(result.showTokenCounts).toBe(false)
        expect(result.autoAdjustContext).toBe(true) // Default
        expect(result.warnOnLargeContext).toBe(true) // Default
        expect(result.largeContextThreshold).toBe(8000) // Default
      })
    })

    describe('defaultMaxMessages validation', () => {
      it('should accept valid message counts', () => {
        const validCounts = [1, 10, 25, 50, 75, 100]

        validCounts.forEach((count) => {
          const result = chatSettingsSchema.parse({ defaultMaxMessages: count })
          expect(result.defaultMaxMessages).toBe(count)
        })
      })

      it('should reject values below minimum (1)', () => {
        expect(() => chatSettingsSchema.parse({ defaultMaxMessages: 0 })).toThrow()
        expect(() => chatSettingsSchema.parse({ defaultMaxMessages: -5 })).toThrow()
      })

      it('should reject values above maximum (100)', () => {
        expect(() => chatSettingsSchema.parse({ defaultMaxMessages: 101 })).toThrow()
        expect(() => chatSettingsSchema.parse({ defaultMaxMessages: 1000 })).toThrow()
      })

      it('should reject non-integer values', () => {
        expect(() => chatSettingsSchema.parse({ defaultMaxMessages: 25.5 })).toThrow()
        expect(() => chatSettingsSchema.parse({ defaultMaxMessages: 'not-a-number' })).toThrow()
      })

      it('should handle boundary values correctly', () => {
        // Min boundary
        const minResult = chatSettingsSchema.parse({ defaultMaxMessages: 1 })
        expect(minResult.defaultMaxMessages).toBe(1)

        // Max boundary
        const maxResult = chatSettingsSchema.parse({ defaultMaxMessages: 100 })
        expect(maxResult.defaultMaxMessages).toBe(100)
      })
    })

    describe('Boolean flags validation', () => {
      it('should accept valid boolean values', () => {
        const settings = {
          autoAdjustContext: false,
          showTokenCounts: false,
          warnOnLargeContext: false
        }

        const result = chatSettingsSchema.parse(settings)
        expect(result.autoAdjustContext).toBe(false)
        expect(result.showTokenCounts).toBe(false)
        expect(result.warnOnLargeContext).toBe(false)
      })

      it('should reject non-boolean values', () => {
        expect(() => chatSettingsSchema.parse({ autoAdjustContext: 'yes' })).toThrow()
        expect(() => chatSettingsSchema.parse({ showTokenCounts: 1 })).toThrow()
        expect(() => chatSettingsSchema.parse({ warnOnLargeContext: null })).toThrow()
      })
    })

    describe('largeContextThreshold validation', () => {
      it('should accept valid positive thresholds', () => {
        const validThresholds = [1000, 4000, 8000, 16000, 32000]

        validThresholds.forEach((threshold) => {
          const result = chatSettingsSchema.parse({ largeContextThreshold: threshold })
          expect(result.largeContextThreshold).toBe(threshold)
        })
      })

      it('should reject non-positive values', () => {
        expect(() => chatSettingsSchema.parse({ largeContextThreshold: 0 })).toThrow()
        expect(() => chatSettingsSchema.parse({ largeContextThreshold: -1000 })).toThrow()
      })

      it('should reject non-integer values', () => {
        expect(() => chatSettingsSchema.parse({ largeContextThreshold: 8000.5 })).toThrow()
        expect(() => chatSettingsSchema.parse({ largeContextThreshold: 'not-a-number' })).toThrow()
      })

      it('should accept large values for high-capacity models', () => {
        const largeThreshold = 128000
        const result = chatSettingsSchema.parse({ largeContextThreshold: largeThreshold })
        expect(result.largeContextThreshold).toBe(largeThreshold)
      })
    })

    describe('KV Store integration', () => {
      it('should have chatSettings in KVKeyEnum', () => {
        expect(KVKeyEnum.chatSettings).toBe('chatSettings')
      })

      it('should have chatSettings schema in KvSchemas', () => {
        expect(KvSchemas.chatSettings).toBe(chatSettingsSchema)
      })

      it('should have default values in KVDefaultValues', () => {
        const defaults = KVDefaultValues.chatSettings
        expect(defaults.defaultMaxMessages).toBe(50)
        expect(defaults.autoAdjustContext).toBe(true)
        expect(defaults.showTokenCounts).toBe(true)
        expect(defaults.warnOnLargeContext).toBe(true)
        expect(defaults.largeContextThreshold).toBe(8000)
      })

      it('should validate default values with schema', () => {
        const defaults = KVDefaultValues.chatSettings
        expect(() => chatSettingsSchema.parse(defaults)).not.toThrow()
      })

      it('should validate chatSettings with KvSchemas', () => {
        const settings: ChatSettings = {
          defaultMaxMessages: 30,
          autoAdjustContext: false,
          showTokenCounts: true,
          warnOnLargeContext: false,
          largeContextThreshold: 10000
        }

        expect(() => KvSchemas.chatSettings.parse(settings)).not.toThrow()
      })
    })

    describe('Type inference', () => {
      it('should properly infer ChatSettings type', () => {
        const settings: ChatSettings = {
          defaultMaxMessages: 50,
          autoAdjustContext: true,
          showTokenCounts: true,
          warnOnLargeContext: true,
          largeContextThreshold: 8000
        }

        // These should compile without TypeScript errors
        const maxMessages: number = settings.defaultMaxMessages
        const autoAdjust: boolean = settings.autoAdjustContext
        const showTokens: boolean = settings.showTokenCounts
        const warnOnLarge: boolean = settings.warnOnLargeContext
        const threshold: number = settings.largeContextThreshold

        expect(maxMessages).toBe(50)
        expect(autoAdjust).toBe(true)
        expect(showTokens).toBe(true)
        expect(warnOnLarge).toBe(true)
        expect(threshold).toBe(8000)
      })

      it('should work with KVValue generic type', () => {
        const settings: KVValue<'chatSettings'> = KVDefaultValues.chatSettings
        expect(settings.defaultMaxMessages).toBe(50)
      })
    })

    describe('Edge cases', () => {
      it('should handle all boolean combinations', () => {
        const combinations = [
          { autoAdjustContext: true, showTokenCounts: true, warnOnLargeContext: true },
          { autoAdjustContext: true, showTokenCounts: true, warnOnLargeContext: false },
          { autoAdjustContext: true, showTokenCounts: false, warnOnLargeContext: true },
          { autoAdjustContext: true, showTokenCounts: false, warnOnLargeContext: false },
          { autoAdjustContext: false, showTokenCounts: true, warnOnLargeContext: true },
          { autoAdjustContext: false, showTokenCounts: true, warnOnLargeContext: false },
          { autoAdjustContext: false, showTokenCounts: false, warnOnLargeContext: true },
          { autoAdjustContext: false, showTokenCounts: false, warnOnLargeContext: false }
        ]

        combinations.forEach((combo) => {
          expect(() => chatSettingsSchema.parse(combo)).not.toThrow()
        })
      })

      it('should handle extreme but valid values', () => {
        const extremeSettings = {
          defaultMaxMessages: 1, // Minimum
          largeContextThreshold: 1 // Minimum positive
        }

        const result = chatSettingsSchema.parse(extremeSettings)
        expect(result.defaultMaxMessages).toBe(1)
        expect(result.largeContextThreshold).toBe(1)
      })

      it('should preserve all fields through parse', () => {
        const input = {
          defaultMaxMessages: 75,
          autoAdjustContext: false,
          showTokenCounts: false,
          warnOnLargeContext: true,
          largeContextThreshold: 12000
        }

        const output = chatSettingsSchema.parse(input)
        expect(output).toEqual(input)
      })
    })

    describe('Error handling', () => {
      it('should provide clear error messages', () => {
        try {
          chatSettingsSchema.parse({ defaultMaxMessages: 150 })
          expect(true).toBe(false) // Should not reach here
        } catch (error: any) {
          expect(error.message).toContain('100')
        }

        try {
          chatSettingsSchema.parse({ largeContextThreshold: -100 })
          expect(true).toBe(false) // Should not reach here
        } catch (error: any) {
          expect(error.message).toBeTruthy()
        }
      })

      it('should handle null values gracefully', () => {
        expect(() => chatSettingsSchema.parse(null)).toThrow()
      })

      it('should handle undefined as empty object (defaults)', () => {
        // When no data provided, defaults should be used
        const result = chatSettingsSchema.parse({})
        expect(result.defaultMaxMessages).toBe(50)
      })
    })
  })
})
