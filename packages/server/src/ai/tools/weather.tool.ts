import { tool } from 'ai'
import { z } from 'zod'

const weatherSchema = z.object({
  city: z.string().min(1, 'City name is required').max(100, 'City name too long')
})

const CONDITIONS = ['sunny', 'cloudy', 'rainy', 'stormy', 'snowy', 'windy'] as const

export const weatherTool = tool({
  description: 'Return a quick weather summary for a city (mock data).',
  inputSchema: weatherSchema,
  execute: async ({ city }) => {
    const normalized = city.trim().toLowerCase()
    const pseudoRandom = Math.abs(hash(normalized)) % CONDITIONS.length
    const condition = CONDITIONS[pseudoRandom]
    const temperature = 18 + (pseudoRandom * 3 + normalized.length) % 12

    return {
      forecast: `It is ${condition} in ${city.trim()}. Approx. temperature: ${temperature}°C.`,
      source: 'MockWeather v1'
    }
  }
})

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i)
    h |= 0
  }
  return h
}

