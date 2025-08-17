import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { DataResponseSchema } from '../types'

// Import schemas and types
import {
  BrowseDirectoryRequestSchema,
  BrowseDirectoryResponseSchema as BrowseDirectoryResponseSchemaZ,
  type BrowseDirectoryRequest
} from '@promptliano/schemas'

/**
 * System API client for system-level operations like directory browsing and health checks
 */
export class SystemClient extends BaseApiClient {
  /**
   * Health check endpoint to verify server connectivity
   * @returns Promise resolving to { success: true } if server is healthy
   */
  async healthCheck(): Promise<{ success: true }> {
    const result = await this.request('GET', '/health')
    return result as { success: true }
  }

  /**
   * Browse directories on the file system
   */
  async browseDirectory(data?: BrowseDirectoryRequest): Promise<DataResponseSchema<any>> {
    // Prepare request options
    const options: any = {
      responseSchema: BrowseDirectoryResponseSchemaZ
    }
    
    // Only include body if data is provided
    if (data) {
      options.body = this.validateBody(BrowseDirectoryRequestSchema, data)
    } else {
      // Send empty object for no parameters
      options.body = {}
    }
    
    const result = await this.request('POST', '/browse-directory', options)
    return result as DataResponseSchema<any>
  }
}