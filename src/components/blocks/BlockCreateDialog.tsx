import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface BlockCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    name: string
    role: 'system' | 'user'
    type: 'simple' | 'script'
    content: string
  }) => void
}

export function BlockCreateDialog({ open, onOpenChange, onSubmit }: BlockCreateDialogProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'system' | 'user'>('user')
  const [type, setType] = useState<'simple' | 'script'>('simple')
  const [content, setContent] = useState('')

  const handleSubmit = () => {
    if (!name.trim() || !content.trim()) return
    onSubmit({ name: name.trim(), role, type, content })
    setName('')
    setRole('user')
    setType('simple')
    setContent('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Custom Block</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Block name..."
              autoFocus
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={role === 'system' ? 'default' : 'outline'}
                  onClick={() => setRole('system')}
                  className="flex-1 h-8 text-xs"
                >
                  System
                </Button>
                <Button
                  size="sm"
                  variant={role === 'user' ? 'default' : 'outline'}
                  onClick={() => setRole('user')}
                  className="flex-1 h-8 text-xs"
                >
                  User
                </Button>
              </div>
            </div>

            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={type === 'simple' ? 'default' : 'outline'}
                  onClick={() => setType('simple')}
                  className="flex-1 h-8 text-xs"
                >
                  Simple
                </Button>
                <Button
                  size="sm"
                  variant={type === 'script' ? 'default' : 'outline'}
                  onClick={() => setType('script')}
                  className="flex-1 h-8 text-xs"
                >
                  Script
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Content</label>
            {type === 'script' && (
              <p className="text-[10px] text-muted-foreground/60 mb-1.5">
                Write a JS function body. Access story data via <Badge variant="outline" className="text-[10px] px-1 py-0">ctx</Badge>: ctx.story, ctx.proseFragments, ctx.authorInput, etc. Return a string.
              </p>
            )}
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={type === 'script' ? 'return `Word count: ${ctx.proseFragments.reduce((n, f) => n + f.content.split(" ").length, 0)}`' : 'Block content...'}
              rows={6}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !content.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
