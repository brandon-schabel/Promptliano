import { describe, expect, it, beforeEach } from 'bun:test'
import {
  InterceptorConfigLoader,
  createInterceptorConfig,
  loadConfigFromEnv,
  validateInterceptorDefinition,
  DEFAULT_DEVELOPMENT_CONFIG,
  DEFAULT_PRODUCTION_CONFIG,
  GlobalInterceptorConfigSchema,
  InterceptorDefinitionSchema
} from '../config'

describe('InterceptorConfigLoader', () => {
  let configLoader: InterceptorConfigLoader

  beforeEach(() => {
    configLoader = new InterceptorConfigLoader()
  })

  describe('constructor', () => {
    it('should create loader with default config', () => {
      const config = configLoader.getConfig()

      expect(config.enabled).toBe(true)
      // Note: interceptors is optional and might be undefined in default config
      // expect(config.interceptors).toBeDefined()
    })

    it('should create loader with custom config', () => {
      const customConfig = {
        enabled: false,
        chain: {
          continueOnError: true,
          timeoutMs: 5000
        }
      }

      const loader = new InterceptorConfigLoader(customConfig)
      const config = loader.getConfig()

      expect(config.enabled).toBe(false)
      expect(config.chain?.continueOnError).toBe(true)
      expect(config.chain?.timeoutMs).toBe(5000)
    })

    it('should apply environment overrides', () => {
      const config = {
        enabled: true,
        environments: {
          test: {
            enabled: false,
            chain: {
              enableLogging: true
            }
          }
        }
      }

      const loader = new InterceptorConfigLoader(config, 'test')
      const finalConfig = loader.getConfig()

      expect(finalConfig.enabled).toBe(false)
      expect(finalConfig.chain?.enableLogging).toBe(true)
    })
  })

  describe('getChainConfig', () => {
    it('should return chain configuration with defaults', () => {
      const chainConfig = configLoader.getChainConfig()

      expect(chainConfig.continueOnError).toBeDefined()
      expect(chainConfig.timeoutMs).toBeDefined()
      expect(chainConfig.enableMetrics).toBeDefined()
      expect(chainConfig.enableLogging).toBeDefined()
    })

    it('should return custom chain configuration', () => {
      const customConfig = {
        chain: {
          continueOnError: true,
          timeoutMs: 1000,
          enableMetrics: false,
          enableLogging: true
        }
      }

      const loader = new InterceptorConfigLoader(customConfig)
      const chainConfig = loader.getChainConfig()

      expect(chainConfig.continueOnError).toBe(true)
      expect(chainConfig.timeoutMs).toBe(1000)
      expect(chainConfig.enableMetrics).toBe(false)
      expect(chainConfig.enableLogging).toBe(true)
    })
  })

  describe('getInterceptorConfig', () => {
    it('should return interceptor configuration', () => {
      const config = {
        interceptors: {
          auth: {
            requireAuth: true,
            publicRoutes: ['/public']
          }
        }
      }

      const loader = new InterceptorConfigLoader(config)
      const authConfig = loader.getInterceptorConfig('auth')

      expect(authConfig?.requireAuth).toBe(true)
      expect(authConfig?.publicRoutes).toEqual(['/public'])
    })

    it('should return undefined for non-existent interceptor', () => {
      const config = configLoader.getInterceptorConfig('nonExistent')
      expect(config).toBeUndefined()
    })
  })

  describe('getRouteConfig', () => {
    it('should return route configuration', () => {
      const config = {
        routes: {
          '/api/admin/*': {
            enabled: {
              auth: true,
              logging: false
            },
            config: {
              auth: { strictMode: true }
            },
            additional: [
              {
                name: 'admin-only',
                order: 15,
                phase: 'request' as const,
                enabled: true
              }
            ]
          }
        }
      }

      const loader = new InterceptorConfigLoader(config)
      const routeConfig = loader.getRouteConfig('/api/admin/*')

      expect(routeConfig.enabled.auth).toBe(true)
      expect(routeConfig.enabled.logging).toBe(false)
      expect(routeConfig.config.auth.strictMode).toBe(true)
      expect(routeConfig.additional).toHaveLength(1)
      expect(routeConfig.additional[0].name).toBe('admin-only')
    })

    it('should return empty config for non-existent route', () => {
      const routeConfig = configLoader.getRouteConfig('/non-existent')

      expect(routeConfig.enabled).toEqual({})
      expect(routeConfig.config).toEqual({})
      expect(routeConfig.additional).toEqual([])
    })
  })

  describe('isInterceptorEnabled', () => {
    it('should return false if system is disabled', () => {
      const loader = new InterceptorConfigLoader({ enabled: false })
      const enabled = loader.isInterceptorEnabled('auth')

      expect(enabled).toBe(false)
    })

    it('should check route-specific settings with pattern matching', () => {
      const config = {
        routes: {
          '/api/public/*': {
            enabled: {
              auth: false
            }
          },
          '/api/admin/*': {
            enabled: {
              auth: true,
              logging: false
            }
          }
        }
      }

      const loader = new InterceptorConfigLoader(config)

      expect(loader.isInterceptorEnabled('auth', '/api/public/docs')).toBe(false)
      expect(loader.isInterceptorEnabled('auth', '/api/admin/users')).toBe(true)
      expect(loader.isInterceptorEnabled('logging', '/api/admin/users')).toBe(false)
      expect(loader.isInterceptorEnabled('auth', '/api/private/data')).toBe(true)
    })

    it('should default to enabled', () => {
      const enabled = configLoader.isInterceptorEnabled('someInterceptor')
      expect(enabled).toBe(true)
    })
  })

  describe('getMonitoringConfig', () => {
    it('should return monitoring configuration with defaults', () => {
      const monitoringConfig = configLoader.getMonitoringConfig()

      expect(monitoringConfig.enableMetrics).toBeDefined()
      expect(monitoringConfig.enableLogging).toBeDefined()
      expect(monitoringConfig.metricsInterval).toBeTypeOf('number')
      expect(monitoringConfig.maxMetricsHistory).toBeTypeOf('number')
      expect(monitoringConfig.logSlowInterceptors).toBeDefined()
      expect(monitoringConfig.slowInterceptorThreshold).toBeTypeOf('number')
    })

    it('should return custom monitoring configuration', () => {
      const config = {
        monitoring: {
          enableMetrics: false,
          enableLogging: true,
          metricsInterval: 30000,
          maxMetricsHistory: 500,
          logSlowInterceptors: false,
          slowInterceptorThreshold: 200
        }
      }

      const loader = new InterceptorConfigLoader(config)
      const monitoringConfig = loader.getMonitoringConfig()

      expect(monitoringConfig.enableMetrics).toBe(false)
      expect(monitoringConfig.enableLogging).toBe(true)
      expect(monitoringConfig.metricsInterval).toBe(30000)
      expect(monitoringConfig.maxMetricsHistory).toBe(500)
      expect(monitoringConfig.logSlowInterceptors).toBe(false)
      expect(monitoringConfig.slowInterceptorThreshold).toBe(200)
    })
  })

  describe('validate', () => {
    it('should validate correct configuration', () => {
      const result = configLoader.validate()

      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should detect invalid configuration', () => {
      // Create a loader then manually override its config to test validation
      const loader = new InterceptorConfigLoader()
      // @ts-ignore - Intentionally bypass type checking to test validation
      loader['config'] = { enabled: 'not-boolean' }

      const result = loader.validate()

      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })
  })

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const updates = {
        enabled: false,
        chain: {
          continueOnError: true
        }
      }

      configLoader.updateConfig(updates)
      const config = configLoader.getConfig()

      expect(config.enabled).toBe(false)
      expect(config.chain?.continueOnError).toBe(true)
    })

    it('should reapply environment overrides after update', () => {
      const config = {
        environments: {
          development: {
            enabled: false
          }
        }
      }

      const loader = new InterceptorConfigLoader(config, 'development')

      loader.updateConfig({ enabled: true })
      const finalConfig = loader.getConfig()

      // Environment override should still apply
      expect(finalConfig.enabled).toBe(false)
    })
  })

  describe('export', () => {
    it('should export configuration', () => {
      const exported = configLoader.export()

      expect(exported).toBeTypeOf('object')
      expect(exported.enabled).toBeDefined()
    })

    it('should create deep copy', () => {
      const exported = configLoader.export()
      const original = configLoader.getConfig()

      expect(exported).not.toBe(original)
      expect(exported).toEqual(original)
    })
  })

  describe('getRouteInterceptorConfig', () => {
    it('should get route-specific interceptor config', () => {
      const config = {
        routes: {
          '/api/admin/*': {
            config: {
              auth: { strictMode: true, requireMFA: true },
              logging: { level: 'debug' }
            }
          }
        }
      }

      const loader = new InterceptorConfigLoader(config)

      const authConfig = loader.getRouteInterceptorConfig<any>('/api/admin/users', 'auth')
      expect(authConfig?.strictMode).toBe(true)
      expect(authConfig?.requireMFA).toBe(true)

      const loggingConfig = loader.getRouteInterceptorConfig<any>('/api/admin/users', 'logging')
      expect(loggingConfig?.level).toBe('debug')

      const nonExistentConfig = loader.getRouteInterceptorConfig('/api/admin/users', 'cache')
      expect(nonExistentConfig).toBeUndefined()
    })

    it('should return undefined for non-matching routes', () => {
      const config = {
        routes: {
          '/api/admin/*': {
            config: {
              auth: { strictMode: true }
            }
          }
        }
      }

      const loader = new InterceptorConfigLoader(config)
      const authConfig = loader.getRouteInterceptorConfig('/api/public/data', 'auth')
      expect(authConfig).toBeUndefined()
    })
  })

  describe('getMatchingRoutePatterns', () => {
    it('should return matching route patterns', () => {
      const config = {
        routes: {
          '/api/*': {},
          '/api/admin/*': {},
          '/api/public/*': {},
          '/web/*': {}
        }
      }

      const loader = new InterceptorConfigLoader(config)

      const adminMatches = loader.getMatchingRoutePatterns('/api/admin/users')
      expect(adminMatches).toContain('/api/*')
      expect(adminMatches).toContain('/api/admin/*')
      expect(adminMatches).not.toContain('/api/public/*')
      expect(adminMatches).not.toContain('/web/*')

      const publicMatches = loader.getMatchingRoutePatterns('/api/public/docs')
      expect(publicMatches).toContain('/api/*')
      expect(publicMatches).toContain('/api/public/*')
      expect(publicMatches).not.toContain('/api/admin/*')
    })

    it('should return empty array for no matches', () => {
      const config = {
        routes: {
          '/api/admin/*': {},
          '/api/private/*': {}
        }
      }

      const loader = new InterceptorConfigLoader(config)
      const matches = loader.getMatchingRoutePatterns('/web/dashboard')
      expect(matches).toEqual([])
    })
  })

  describe('mergeConfigurations', () => {
    it('should merge configurations with correct priority', () => {
      const defaults = {
        timeout: 1000,
        retries: 3,
        cache: true
      }

      const globalConfig = {
        timeout: 2000,
        retries: 5
      }

      const routeConfig = {
        timeout: 3000
      }

      const loader = new InterceptorConfigLoader()
      const merged = loader.mergeConfigurations(globalConfig, routeConfig, defaults)

      expect(merged.timeout).toBe(3000) // Route config takes priority
      expect(merged.retries).toBe(5) // Global config overrides default
      expect(merged.cache).toBe(true) // Default value preserved
    })

    it('should handle undefined configurations', () => {
      const defaults = { timeout: 1000, enabled: true }

      const loader = new InterceptorConfigLoader()
      const merged = loader.mergeConfigurations(undefined, undefined, defaults)

      expect(merged).toEqual(defaults)
    })
  })
})

describe('createInterceptorConfig', () => {
  it('should create development config', () => {
    const loader = createInterceptorConfig('development')
    const config = loader.getConfig()

    expect(config.enabled).toBe(true)
    expect(config.interceptors?.auth?.requireAuth).toBe(false)
    expect(config.interceptors?.logging?.level).toBe('debug')
  })

  it('should create production config', () => {
    const loader = createInterceptorConfig('production')
    const config = loader.getConfig()

    expect(config.enabled).toBe(true)
    expect(config.interceptors?.auth?.requireAuth).toBe(true)
    expect(config.interceptors?.logging?.level).toBe('info')
  })

  it('should apply overrides', () => {
    const overrides = {
      enabled: false,
      interceptors: {
        auth: {
          requireAuth: false
        }
      }
    }

    const loader = createInterceptorConfig('production', overrides)
    const config = loader.getConfig()

    expect(config.enabled).toBe(false)
    expect(config.interceptors?.auth?.requireAuth).toBe(false)
  })
})

describe('loadConfigFromEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  it('should load default development config', () => {
    process.env.NODE_ENV = 'development'

    const loader = loadConfigFromEnv()
    const config = loader.getConfig()

    expect(config.enabled).toBe(true)
  })

  it('should respect environment variables', () => {
    process.env.INTERCEPTORS_ENABLED = 'false'
    process.env.INTERCEPTORS_LOG_ENABLED = 'true'
    process.env.INTERCEPTORS_TIMEOUT_MS = '5000'

    const loader = loadConfigFromEnv()
    const config = loader.getConfig()

    expect(config.enabled).toBe(false)
    expect(config.chain?.enableLogging).toBe(true)
    expect(config.chain?.timeoutMs).toBe(5000)
  })
})

describe('validateInterceptorDefinition', () => {
  it('should validate correct definition', () => {
    const definition = {
      config: {
        name: 'test-interceptor',
        order: 10,
        phase: 'request',
        enabled: true
      },
      source: 'custom',
      version: '1.0.0',
      description: 'Test interceptor'
    }

    const result = validateInterceptorDefinition(definition)

    expect(result.valid).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.errors).toBeUndefined()
  })

  it('should detect invalid definition', () => {
    const definition = {
      config: {
        name: '', // Invalid empty name
        order: -1, // Invalid negative order
        phase: 'invalid'
      }
    }

    const result = validateInterceptorDefinition(definition)

    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
  })

  it('should provide detailed error messages', () => {
    const definition = {
      config: {
        name: '',
        order: 'not-a-number'
      }
    }

    const result = validateInterceptorDefinition(definition)

    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.some((error) => error.includes('name'))).toBe(true)
    expect(result.errors!.some((error) => error.includes('order'))).toBe(true)
  })
})

describe('Default Configurations', () => {
  describe('DEFAULT_DEVELOPMENT_CONFIG', () => {
    it('should have correct development settings', () => {
      expect(DEFAULT_DEVELOPMENT_CONFIG.enabled).toBe(true)
      expect(DEFAULT_DEVELOPMENT_CONFIG.interceptors?.auth?.requireAuth).toBe(false)
      expect(DEFAULT_DEVELOPMENT_CONFIG.interceptors?.logging?.level).toBe('debug')
      expect(DEFAULT_DEVELOPMENT_CONFIG.interceptors?.logging?.logRequestBody).toBe(true)
      expect(DEFAULT_DEVELOPMENT_CONFIG.monitoring?.enableLogging).toBe(true)
    })

    it('should be valid configuration', () => {
      const result = GlobalInterceptorConfigSchema.safeParse(DEFAULT_DEVELOPMENT_CONFIG)
      expect(result.success).toBe(true)
    })
  })

  describe('DEFAULT_PRODUCTION_CONFIG', () => {
    it('should have correct production settings', () => {
      expect(DEFAULT_PRODUCTION_CONFIG.enabled).toBe(true)
      expect(DEFAULT_PRODUCTION_CONFIG.interceptors?.auth?.requireAuth).toBe(true)
      expect(DEFAULT_PRODUCTION_CONFIG.interceptors?.logging?.level).toBe('info')
      expect(DEFAULT_PRODUCTION_CONFIG.interceptors?.logging?.logRequestBody).toBe(false)
      expect(DEFAULT_PRODUCTION_CONFIG.monitoring?.enableLogging).toBe(false)
      expect(DEFAULT_PRODUCTION_CONFIG.chain?.continueOnError).toBe(true)
    })

    it('should be valid configuration', () => {
      const result = GlobalInterceptorConfigSchema.safeParse(DEFAULT_PRODUCTION_CONFIG)
      expect(result.success).toBe(true)
    })
  })
})

describe('Configuration Schemas', () => {
  describe('GlobalInterceptorConfigSchema', () => {
    it('should validate minimal config', () => {
      const config = { enabled: true }
      const result = GlobalInterceptorConfigSchema.safeParse(config)

      expect(result.success).toBe(true)
    })

    it('should provide defaults', () => {
      const config = {}
      const result = GlobalInterceptorConfigSchema.safeParse(config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.enabled).toBe(true)
      }
    })

    it('should reject invalid config', () => {
      const config = {
        enabled: 'not-boolean',
        chain: {
          timeoutMs: -1 // Invalid negative timeout
        }
      }

      const result = GlobalInterceptorConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })
  })

  describe('InterceptorDefinitionSchema', () => {
    it('should validate complete definition', () => {
      const definition = {
        config: {
          name: 'test-interceptor',
          order: 10,
          phase: 'request',
          enabled: true
        },
        source: 'built-in',
        version: '1.0.0',
        description: 'Test interceptor',
        author: 'Test Author',
        performance: {
          averageExecutionTime: 50,
          memoryUsage: 'low',
          cpuUsage: 'low'
        }
      }

      const result = InterceptorDefinitionSchema.safeParse(definition)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.config.name).toBe('test-interceptor')
        expect(result.data.source).toBe('built-in')
        expect(result.data.performance?.memoryUsage).toBe('low')
      }
    })

    it('should require config', () => {
      const definition = {
        source: 'custom'
      }

      const result = InterceptorDefinitionSchema.safeParse(definition)
      expect(result.success).toBe(false)
    })
  })
})
