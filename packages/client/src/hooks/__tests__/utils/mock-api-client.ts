/**
 * Mock API Client for Testing
 * Provides controllable mock responses for hook factory testing
 */

export interface MockResponse<T> {
  data: T
  delay?: number
  error?: Error
}

export interface PaginatedMockResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export class MockEndpoint<T> {
  private responses = new Map<string, MockResponse<T> | PaginatedMockResponse<T>>()
  private errors = new Map<string, Error>()
  private delays = new Map<string, number>()
  private callCounts = new Map<string, number>()

  setMockData(method: string, data: T, delay?: number): void {
    this.responses.set(method, { data, delay })
    if (delay) {
      this.delays.set(method, delay)
    }
  }

  setMockPaginatedData(page: number, response: PaginatedMockResponse<T>): void {
    this.responses.set(`paginated_${page}`, response)
  }

  setMockError(method: string, error: Error): void {
    this.errors.set(method, error)
  }

  setMockDelay(method: string, delay: number): void {
    this.delays.set(method, delay)
  }

  clearError(method: string): void {
    this.errors.delete(method)
  }

  getCallCount(method: string): number {
    return this.callCounts.get(method) || 0
  }

  incrementCallCount(method: string): void {
    this.callCounts.set(method, (this.callCounts.get(method) || 0) + 1)
  }

  reset(): void {
    this.responses.clear()
    this.errors.clear()
    this.delays.clear()
    this.callCounts.clear()
  }

  async executeCall<R = T>(method: string, ...args: any[]): Promise<R> {
    this.incrementCallCount(method)

    // Check for error
    const error = this.errors.get(method)
    if (error) {
      throw error
    }

    // Apply delay
    const delay = this.delays.get(method)
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // Return response
    const response = this.responses.get(method)
    if (!response) {
      throw new Error(`No mock data set for ${method}`)
    }

    return (response as MockResponse<T>).data as R
  }
}

export class MockApiClient {
  public projects = new MockEndpoint<any>()
  public tickets = new MockEndpoint<any>()
  public chats = new MockEndpoint<any>()
  public prompts = new MockEndpoint<any>()
  public agents = new MockEndpoint<any>()
  public queues = new MockEndpoint<any>()
  public keys = new MockEndpoint<any>()

  reset(): void {
    this.projects.reset()
    this.tickets.reset()
    this.chats.reset()
    this.prompts.reset()
    this.agents.reset()
    this.queues.reset()
    this.keys.reset()
  }
}

export function createMockApiClient(): MockApiClient {
  return new MockApiClient()
}