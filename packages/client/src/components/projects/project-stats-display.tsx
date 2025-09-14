// packages/client/src/components/projects/project-stats-display.tsx
// Recent changes:
// 1. Initial creation of ProjectStatsDisplay component.
// 2. Fetches project files and calculates various statistics.
// 3. Renders stats in Cards, using PieChart and BarChart for visualization.
// 4. Implemented helper functions for data processing and formatting.
// 5. Added loading and error states.
import React from 'react'
import { useGetProjectFilesWithoutContent } from '@/hooks/api-hooks'
import { ProjectFile } from '@promptliano/schemas' // Using direct schema type

// Type for project files without content
type ProjectFileWithoutContent = Omit<ProjectFile, 'content'>
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@promptliano/ui'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from '@promptliano/ui'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { Skeleton } from '@promptliano/ui'

type ProjectStatsDisplayProps = { projectId: number }

const CHART_COLORS_HSL = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
]

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function ProjectStatsDisplay({ projectId }: ProjectStatsDisplayProps) {
  const { data: projectFilesData, isLoading, error } = useGetProjectFilesWithoutContent(projectId)
  const files: ProjectFileWithoutContent[] = Array.isArray(projectFilesData)
    ? (projectFilesData as unknown as ProjectFileWithoutContent[])
    : []

  const stats = React.useMemo(() => {
    if (!files || files.length === 0) return null

    const fileTypeCounts: { [key: string]: number } = {}
    const fileSizeByType: { [key: string]: number } = {}
    let totalProjectSize = 0
    // Summaries removed

    files.forEach((file) => {
      const ext = file.extension || 'unknown'
      fileTypeCounts[ext] = (fileTypeCounts[ext] || 0) + 1
      fileSizeByType[ext] = (fileSizeByType[ext] || 0) + (file.size || 0)
      totalProjectSize += file.size || 0
      // No summary stats
    })

    const popularExtensions = Object.entries(fileTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, CHART_COLORS_HSL.length - 1)
    const otherExtensionsCount = Object.entries(fileTypeCounts)
      .slice(CHART_COLORS_HSL.length - 1)
      .reduce((sum, [, count]) => sum + count, 0)
    const fileTypeChartData = popularExtensions.map(([extension, count], i) => ({
      name: extension,
      value: count,
      fill: CHART_COLORS_HSL[i]
    }))
    if (otherExtensionsCount > 0)
      fileTypeChartData.push({
        name: 'Other',
        value: otherExtensionsCount,
        fill: CHART_COLORS_HSL[CHART_COLORS_HSL.length - 1]
      })

    const fileSizeChartData = Object.entries(fileSizeByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([extension, totalSize], i) => ({
        extension,
        totalSize,
        fill: CHART_COLORS_HSL[i % CHART_COLORS_HSL.length]
      }))

    return {
      fileTypeChartData,
      fileSizeChartData,
      totalFiles: files.length,
      totalProjectSize
    }
  }, [files])

  if (isLoading)
    return (
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 p-1'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-[300px] w-full' />
        ))}
      </div>
    )
  if (error) return <p className='text-red-500'>Error loading project statistics: {error.message}</p>
  if (!stats) return <p>No file data available to display statistics.</p>

  const fileTypeConfig = stats.fileTypeChartData.reduce((acc, item) => {
    acc[item.name] = { label: item.name, color: item.fill }
    return acc
  }, {} as ChartConfig)

  const fileSizeConfig = stats.fileSizeChartData.reduce((acc, item) => {
    acc[item.extension.replace(/^\./, '')] = { label: item.extension, color: item.fill }
    return acc
  }, {} as ChartConfig)

  // No summary length chart

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      {/* <Card>
        <CardHeader>
          <CardTitle>File Types Distribution</CardTitle>
          <CardDescription>Breakdown of files by extension.</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer config={fileTypeConfig} className='min-h-[250px] w-full aspect-auto'>
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey='name' hideLabel />} />
              <Pie data={stats.fileTypeChartData} dataKey='value' nameKey='name' cx='50%' cy='50%' outerRadius='80%'>
                {stats.fileTypeChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey='name' />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card> */}

      <Card>
        <CardHeader>
          <CardTitle>Aggregated File Size by Type</CardTitle>
          <CardDescription>Total size (bytes) per top 5 file extensions.</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer config={fileSizeConfig} className='min-h-[250px] w-full'>
            <BarChart data={stats.fileSizeChartData} layout='vertical' margin={{ left: 10, right: 20 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type='number' dataKey='totalSize' tickFormatter={formatBytes} />
              <YAxis type='category' dataKey='extension' width={60} tickLine={false} axisLine={false} />

              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent formatter={(value) => formatBytes(value as number)} />}
              />

              <Bar dataKey='totalSize' radius={4}>
                {stats.fileSizeChartData.map((entry) => (
                  <Cell key={`cell-${entry.extension}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Summary length charts removed */}

      <Card>
        <CardHeader>
          <CardTitle>Overall Project Stats</CardTitle>
        </CardHeader>

        <CardContent className='space-y-3 text-sm'>
          <p>
            <strong>Total Files:</strong> {stats.totalFiles.toLocaleString()}
          </p>

          <p>
            <strong>Total Project Size:</strong> {formatBytes(stats.totalProjectSize)}
          </p>

          {/* Summary metrics removed */}
        </CardContent>
      </Card>
    </div>
  )
}
