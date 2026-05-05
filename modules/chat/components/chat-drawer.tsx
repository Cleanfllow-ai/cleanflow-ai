'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2,
  Copy,
  Check as CheckIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/shared/lib/utils'
import ReactMarkdown from 'react-markdown'
import { useAppSelector } from '@/shared/store/store'
import { selectFiles } from '@/modules/files/store/filesSlice'
import { useToast } from '@/shared/hooks/use-toast'

interface ChatSource {
  score?: number
  section?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: ChatSource[]
}

// Maximum messages to persist in localStorage. Older messages are trimmed.
const MAX_PERSISTED_MESSAGES = 20

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    'What do the dashboard metrics mean?',
    'How is the DQ score calculated?',
    'What does the monthly trends chart show?',
  ],
  files: [
    'How do I upload a file?',
    'What file formats are supported?',
    'How do I download processed files?',
  ],
  admin: [
    'How do I manage user permissions?',
    'How to configure system settings?',
    'How do I view audit logs?',
  ],
  default: [
    'How do I upload a file?',
    'What does the DQ score mean?',
    'How to connect QuickBooks?',
  ],
}

const getPageKey = (pathname: string): string => {
  if (pathname.includes('/dashboard')) return 'dashboard'
  if (pathname.includes('/files')) return 'files'
  if (pathname.includes('/admin')) return 'admin'
  return 'default'
}

// Match /files/{uploadId} or /files/{uploadId}/quarantine etc.
// Captures the segment immediately after `/files/` only when it is not the bare list page.
const FILE_DETAIL_RE = /^\/files\/([^/]+)(?:\/.*)?$/

interface PageContextPayload {
  route: string
  summary?: Record<string, number | string>
  // Aggregate-only file info — never includes raw rows or PII.
  file?: Record<string, number | string>
}

export function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const files = useAppSelector(selectFiles)
  const { toast } = useToast()

  const suggestions = PAGE_SUGGESTIONS[getPageKey(pathname)] || PAGE_SUGGESTIONS.default

  // Build a page-context payload from Redux + pathname. Aggregates only — no PII, no raw rows.
  // Read from `selectFiles` (already populated by /files page); the chat may be opened
  // before that, in which case `files` is [] and we just send route info.
  const pageContext = useMemo<PageContextPayload>(() => {
    const route = pathname || '/'

    // File detail / quarantine route: surface that one file's aggregate metadata.
    const fileMatch = route.match(FILE_DETAIL_RE)
    if (fileMatch && fileMatch[1] && fileMatch[1] !== '') {
      const uploadId = fileMatch[1]
      const f = files.find((file) => file.upload_id === uploadId)
      if (f) {
        const fileBlock: Record<string, number | string> = {
          name: f.original_filename || f.filename || 'unknown',
          status: f.status,
        }
        if (typeof f.dq_score === 'number') fileBlock.dq_score = f.dq_score
        if (typeof f.rows_in === 'number') fileBlock.rows_in = f.rows_in
        if (typeof f.rows_out === 'number') fileBlock.rows_out = f.rows_out
        if (typeof f.rows_quarantined === 'number') fileBlock.rows_quarantined = f.rows_quarantined
        if (f.partial_completion) fileBlock.partial_completion = 'true'
        return { route, file: fileBlock }
      }
      return { route }
    }

    // Dashboard or files-list: aggregate counts only.
    if (route.startsWith('/dashboard') || route === '/files') {
      const summary: Record<string, number | string> = {
        files_total: files.length,
      }
      if (files.length > 0) {
        const QUARANTINED = files.filter((f) => f.status === 'DQ_FIXED' && (f.rows_quarantined || 0) > 0).length
        const RUNNING = files.filter((f) => f.status === 'DQ_RUNNING' || f.status === 'DQ_DISPATCHED').length
        const FAILED = files.filter((f) => f.status === 'DQ_FAILED' || f.status === 'FAILED').length
        if (QUARANTINED > 0) summary.files_with_quarantine = QUARANTINED
        if (RUNNING > 0) summary.active_jobs = RUNNING
        if (FAILED > 0) summary.failed = FAILED
      }
      return { route, summary }
    }

    return { route }
  }, [pathname, files])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    const saved = localStorage.getItem('cleanflowai-chat-history')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const storedAt = parsed.storedAt || 0
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
        if (Date.now() - storedAt > TWENTY_FOUR_HOURS) {
          localStorage.removeItem('cleanflowai-chat-history')
          return
        }
        if (Array.isArray(parsed.messages)) {
          setMessages(parsed.messages.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })))
        }
      } catch (e) {
        console.error('Failed to load chat history:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      // Cap persisted history to last MAX_PERSISTED_MESSAGES so localStorage doesn't grow unboundedly.
      const trimmed = messages.slice(-MAX_PERSISTED_MESSAGES)
      localStorage.setItem('cleanflowai-chat-history', JSON.stringify({ messages: trimmed, storedAt: Date.now() }))
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const conversationHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
          context: pageContext,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
        sources: Array.isArray(data.sources) ? data.sources : undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      // Show a toast instead of injecting a fake assistant message — keeps the thread clean.
      toast({
        title: 'Chat unavailable',
        description: "I couldn't reach the assistant. Please try again in a moment.",
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500)
    } catch (err) {
      // navigator.clipboard can be undefined in non-secure contexts; fail silently.
      console.warn('Clipboard write failed:', err)
    }
  }, [])

  const clearHistory = () => {
    setMessages([])
    localStorage.removeItem('cleanflowai-chat-history')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40 lg:bg-transparent"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-background border-l shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">CleanFlowAI Assistant</h2>
                  <p className="text-xs text-muted-foreground">AI-powered help</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearHistory}
                  className="h-8 w-8"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 overflow-auto">
              <div className="p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="p-4 rounded-full bg-primary/10 mb-4">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-medium mb-2">How can I help you?</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Ask me anything about CleanFlowAI - file uploads, data quality, ERP integrations, and more.
                  </p>
                  <div className="space-y-2 w-full max-w-[280px]">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="w-full text-left text-sm px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className="max-w-[85%] flex flex-col gap-1">
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-2.5',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          )}
                        >
                          {message.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                                  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  code: ({ children }) => (
                                    <code className="px-1 py-0.5 bg-background/50 rounded text-xs">
                                      {children}
                                    </code>
                                  ),
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm">{message.content}</p>
                          )}
                        </div>
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-1.5 flex-wrap px-1">
                            <button
                              type="button"
                              onClick={() => handleCopy(message.id, message.content)}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy message"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <CheckIcon className="w-3 h-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </>
                              )}
                            </button>
                            {message.sources && message.sources.length > 0 && (
                              <>
                                <span className="text-[11px] text-muted-foreground/50">·</span>
                                {message.sources.slice(0, 3).map((src, idx) => (
                                  <span
                                    key={`${message.id}-src-${idx}`}
                                    className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/80 border border-primary/10"
                                    title={typeof src.score === 'number' ? `relevance: ${(src.score * 100).toFixed(0)}%` : undefined}
                                  >
                                    {src.section || 'docs'}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                          <User className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                AI responses may not always be accurate
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
