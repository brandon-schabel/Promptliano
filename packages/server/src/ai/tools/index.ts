import type { ToolSet } from 'ai'
import { calculatorTool } from './calculator.tool'
import { echoTool } from './echo.tool'
import { weatherTool } from './weather.tool'

export const firstPartyTools = {
  calculator: calculatorTool,
  echo: echoTool,
  weather: weatherTool
} satisfies ToolSet

export type ToolMap = typeof firstPartyTools
