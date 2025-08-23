/**
 * AUTO-GENERATED TYPE-SAFE API CLIENT
 * Generated at: 2025-08-23T00:21:48.680Z
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import type { paths } from './api-types'

export type ApiPaths = paths

// Extract operation types for better IntelliSense
export type GetProjectsResponse = paths['/api/projects']['get']['responses']['200']['content']['application/json']
export type CreateProjectRequest = paths['/api/projects']['post']['requestBody']['content']['application/json']
export type CreateProjectResponse = paths['/api/projects']['post']['responses']['200']['content']['application/json']

export type GetTicketsResponse = paths['/api/tickets']['get']['responses']['200']['content']['application/json']
export type CreateTicketRequest = paths['/api/tickets']['post']['requestBody']['content']['application/json']
export type CreateTicketResponse = paths['/api/tickets']['post']['responses']['200']['content']['application/json']

export type GetChatsResponse = paths['/api/chats']['get']['responses']['200']['content']['application/json']
export type CreateChatRequest = paths['/api/chats']['post']['requestBody']['content']['application/json']
export type CreateChatResponse = paths['/api/chats']['post']['responses']['200']['content']['application/json']

export type GetQueuesResponse = paths['/api/queues']['get']['responses']['200']['content']['application/json']
export type CreateQueueRequest = paths['/api/queues']['post']['requestBody']['content']['application/json']
export type CreateQueueResponse = paths['/api/queues']['post']['responses']['200']['content']['application/json']

/**
 * Type-safe API client with full IntelliSense support
 */
export class TypeSafeApiClient {
  constructor(private baseUrl: string = 'http://localhost:3147') {}

  // Projects
  async getProjects(): Promise<GetProjectsResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects`)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }

  async createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }

  // Tickets  
  async getTickets(): Promise<GetTicketsResponse> {
    const response = await fetch(`${this.baseUrl}/api/tickets`)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }

  async createTicket(data: CreateTicketRequest): Promise<CreateTicketResponse> {
    const response = await fetch(`${this.baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }

  // Chats
  async getChats(): Promise<GetChatsResponse> {
    const response = await fetch(`${this.baseUrl}/api/chats`)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }

  async createChat(data: CreateChatRequest): Promise<CreateChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }

  // Queues
  async getQueues(): Promise<GetQueuesResponse> {
    const response = await fetch(`${this.baseUrl}/api/queues`)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }

  async createQueue(data: CreateQueueRequest): Promise<CreateQueueResponse> {
    const response = await fetch(`${this.baseUrl}/api/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return response.json()
  }
}

/**
 * Factory function for creating the type-safe API client
 */
export function createTypeSafeClient(baseUrl?: string): TypeSafeApiClient {
  return new TypeSafeApiClient(baseUrl)
}
