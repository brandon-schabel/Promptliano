import { Card, Progress, Badge, Separator } from '@promptliano/ui'
import { Clock, FileText, Link as LinkIcon } from 'lucide-react'

interface ResearchProgressPanelProps {
  researchId: number
  status: string
  progress: {
    totalSources: number
    processedSources: number
    sectionsTotal: number
    sectionsCompleted: number
    percentage: number
  }
  currentPhase: string
  estimatedTimeRemaining?: number
}

export function ResearchProgressPanel({
  researchId,
  status,
  progress: progressData,
  currentPhase,
  estimatedTimeRemaining
}: ResearchProgressPanelProps) {

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Research Progress</h3>
        <Badge variant="outline" className="mb-4">
          {currentPhase}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{progressData.percentage}%</span>
          </div>
          <Progress value={progressData.percentage} className="h-3" />
        </div>

        <Separator />

        {/* Sources Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sources</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {progressData.processedSources} / {progressData.totalSources}
            </span>
          </div>
          <Progress
            value={progressData.totalSources > 0 ? (progressData.processedSources / progressData.totalSources) * 100 : 0}
            className="h-2"
          />
        </div>

        {/* Sections Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sections</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {progressData.sectionsCompleted} / {progressData.sectionsTotal}
            </span>
          </div>
          <Progress
            value={progressData.sectionsTotal > 0 ? (progressData.sectionsCompleted / progressData.sectionsTotal) * 100 : 0}
            className="h-2"
          />
        </div>

        {estimatedTimeRemaining && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Estimated time remaining: {Math.round(estimatedTimeRemaining / 60000)} minutes
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
