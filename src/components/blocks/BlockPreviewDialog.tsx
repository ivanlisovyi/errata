import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface BlockPreviewDialogProps {
  storyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BlockPreviewDialog({ storyId, open, onOpenChange }: BlockPreviewDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['block-preview', storyId],
    queryFn: () => api.blocks.preview(storyId),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Context Preview
            {data && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {data.blockCount} blocks
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading preview...</p>
          ) : data?.messages.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No messages</p>
          ) : (
            <div className="space-y-4 p-1">
              {data?.messages.map((msg, i) => (
                <div key={i} className="space-y-1.5">
                  <Badge
                    variant="outline"
                    className={
                      msg.role === 'system'
                        ? 'bg-violet-500/10 text-violet-500 border-violet-500/20'
                        : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    }
                  >
                    {msg.role}
                  </Badge>
                  <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/30 rounded-md p-3 border border-border/30 max-h-[300px] overflow-y-auto">
                    {msg.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
