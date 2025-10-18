import { useState } from 'react'
import { Card, Badge, Button, Progress, Input, Textarea } from '@promptliano/ui'
import { FileText, Download, Trash2, Edit2, Check, X, Loader2, PlayCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useUpdateResearch } from '@/hooks/api-hooks'

interface ResearchRecord {
  id: number
  topic: string
  description: string | null
  status: 'initializing' | 'gathering' | 'processing' | 'building' | 'complete' | 'failed'
  totalSources: number
  processedSources: number
  sectionsTotal: number
  sectionsCompleted: number
  createdAt: number
  completedAt: number | null
}

interface ResearchCardProps {
  research: ResearchRecord
  onView: (id: number) => void
  onDelete: (id: number) => void
  onExport: (id: number) => void
  onExecute?: (id: number) => void
  onResume?: (id: number) => void
}

const statusColors = {
  initializing: 'bg-gray-500',
  gathering: 'bg-blue-500',
  processing: 'bg-yellow-500',
  building: 'bg-purple-500',
  complete: 'bg-green-500',
  failed: 'bg-red-500'
}

export function ResearchCard({ research, onView, onDelete, onExport, onExecute, onResume }: ResearchCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTopic, setEditedTopic] = useState(research.topic)
  const [editedDescription, setEditedDescription] = useState(research.description || '')
  const updateResearch = useUpdateResearch()

  const progress = research.totalSources > 0
    ? Math.round((research.processedSources / research.totalSources) * 100)
    : 0

  const canEdit = research.status === 'initializing' || research.status === 'failed'
  const canExecute = research.status === 'initializing'
  const canResume = research.status === 'failed'
  const isActive = ['gathering', 'processing', 'building'].includes(research.status)

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditedTopic(research.topic)
    setEditedDescription(research.description || '')
    setIsEditing(true)
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(false)
  }

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editedTopic.trim()) return

    await updateResearch.mutateAsync({
      id: research.id,
      data: {
        topic: editedTopic,
        description: editedDescription || undefined
      }
    })

    setIsEditing(false)
  }

  return (
    <Card className="hover:shadow-lg transition-all duration-200 group">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editedTopic}
                  onChange={(e) => setEditedTopic(e.target.value)}
                  placeholder="Research topic"
                  className="font-semibold"
                  autoFocus
                />
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-[60px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editedTopic.trim() || updateResearch.isPending}
                  >
                    {updateResearch.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={updateResearch.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3
                    className="text-lg font-semibold truncate group-hover:text-primary cursor-pointer"
                    onClick={() => onView(research.id)}
                  >
                    {research.topic}
                  </h3>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartEdit}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {research.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {research.description}
                  </p>
                )}
              </>
            )}
          </div>
          <Badge className={`${statusColors[research.status]} text-white ml-2 flex-shrink-0`}>
            {research.status}
          </Badge>
        </div>

        {/* Progress */}
        {research.status !== 'complete' && research.status !== 'failed' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sources: {research.processedSources}/{research.totalSources}</span>
              <span>Sections: {research.sectionsCompleted}/{research.sectionsTotal}</span>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Created {formatDistanceToNow(new Date(research.createdAt), { addSuffix: true })}
          </span>
          {research.completedAt && (
            <span>
              Completed {formatDistanceToNow(new Date(research.completedAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          {/* Primary Action Button */}
          {canExecute && onExecute && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onExecute(research.id)
              }}
              className="flex-1"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}

          {canResume && onResume && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onResume(research.id)
              }}
              className="flex-1"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}

          {isActive && (
            <Badge variant="secondary" className="animate-pulse flex items-center gap-1 px-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing
            </Badge>
          )}

          {/* View Button - Always visible */}
          {!canExecute && !canResume && !isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(research.id)}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              View
            </Button>
          )}

          {/* Export Button - Only for completed */}
          {research.status === 'complete' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport(research.id)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}

          {/* Delete Button - Always visible */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(research.id)}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
