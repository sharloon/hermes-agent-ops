import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Bot,
  ChevronDown,
  Loader2,
  Plus,
  Send,
  Square,
  Wrench,
  AlertCircle,
  Wifi,
  WifiOff,
  Check,
} from "lucide-react";
import { Button } from "@nous-research/ui";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";
import { useChat, type ChatMessage, type ToolCallItem } from "@/hooks/useChat";

export default function WebChatPage() {
  const {
    messages,
    connectionState,
    sessionInfo,
    isStreaming,
    statusText,
    error,
    sendMessage,
    interrupt,
    newSession,
  } = useChat();

  const [draft, setDraft] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isConnected = connectionState === "open";
  const canSend = isConnected && !isStreaming && draft.trim().length > 0;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show scroll-to-bottom button when scrolled up
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [draft]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || !canSend) return;
    setDraft("");
    await sendMessage(text);
  }, [draft, canSend, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0a0a0a]">
      {/* Header - minimal */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <ConnectionBadge state={connectionState} />
          {sessionInfo.model && (
            <span className="truncate text-xs text-white/50">
              {sessionInfo.model}
            </span>
          )}
        </div>

        <Button
          ghost
          size="icon"
          onClick={newSession}
          title="新对话"
          className="shrink-0 text-white/50 hover:text-white hover:bg-white/5"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <EmptyState isConnected={isConnected} connectionState={connectionState} />
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Status indicator */}
          {isStreaming && statusText && (
            <div className="flex items-center gap-2 px-3 text-xs text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{statusText}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className={cn(
              "absolute bottom-4 right-4 z-10",
              "flex h-7 w-7 items-center justify-center",
              "rounded-full bg-white/10 hover:bg-white/20 transition-colors",
            )}
          >
            <ChevronDown className="h-4 w-4 text-white/60" />
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex shrink-0 items-center gap-2 border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{error}</span>
          <button
            onClick={newSession}
            className="ml-auto shrink-0 underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            重连
          </button>
        </div>
      )}

      {/* Input - fixed bottom */}
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "输入消息..." : "连接中..."}
            disabled={!isConnected}
            rows={1}
            className={cn(
              "min-h-[36px] flex-1 resize-none rounded-lg border border-white/10",
              "bg-white/5 px-3 py-2 text-sm text-white",
              "placeholder:text-white/30 focus:border-white/20 focus:outline-none",
              "transition-colors disabled:opacity-40",
            )}
          />
          {isStreaming ? (
            <Button
              ghost
              size="icon"
              onClick={() => void interrupt()}
              title="停止"
              className="shrink-0 text-white/60 hover:text-white hover:bg-white/5"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              ghost
              size="icon"
              onClick={() => void submit()}
              disabled={!canSend}
              title="发送"
              className={cn(
                "shrink-0",
                canSend
                  ? "text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                  : "text-white/30",
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-xs text-white/30">
          Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MessageBubble - simplified business style                          */
/* ------------------------------------------------------------------ */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-0", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%]", isUser ? "order-1" : "order-2")}>
        {/* Tool calls - inline style */}
        {message.toolCalls.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {message.toolCalls.map((tc) => (
              <ToolCallInline key={tc.tool_id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message content */}
        {(message.text || message.streaming) && (
          <div
            className={cn(
              "px-3 py-2.5 rounded-lg",
              isUser
                ? "bg-white/10 text-white"
                : "bg-[#141414] text-white/90",
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap text-sm">{message.text}</p>
            ) : (
              <Markdown content={message.text} streaming={message.streaming} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ToolCallInline - compact inline display                            */
/* ------------------------------------------------------------------ */

function ToolCallInline({ toolCall }: { toolCall: ToolCallItem }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = toolCall.status === "running";
  const isDone = toolCall.status === "done";
  const hasDetail = !!(toolCall.context || toolCall.preview || toolCall.summary);

  return (
    <div className="text-xs">
      <button
        className={cn(
          "flex items-center gap-2 py-1",
          hasDetail && "cursor-pointer hover:bg-white/5 px-2 rounded",
        )}
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
      >
        <Wrench className="h-3 w-3 shrink-0 text-white/40" />
        <span className="text-white/60">{toolCall.name}</span>
        {isRunning && <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />}
        {isDone && <Check className="h-3 w-3 text-green-400" />}
        {hasDetail && (
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-white/30 transition-transform",
              expanded && "rotate-180",
            )}
          />
        )}
      </button>

      {expanded && (
        <div className="mt-1 px-4 py-1.5 bg-white/5 rounded text-white/50">
          {toolCall.context && (
            <p className="mb-1 text-white/40">{toolCall.context}</p>
          )}
          {(toolCall.preview || toolCall.summary) && (
            <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[0.7rem]">
              {toolCall.summary ?? toolCall.preview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ConnectionBadge - minimal                                          */
/* ------------------------------------------------------------------ */

function ConnectionBadge({ state }: { state: string }) {
  if (state === "open") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-400">
        <Wifi className="h-3 w-3" />
        <span>已连接</span>
      </span>
    );
  }
  if (state === "connecting") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-white/40">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>连接中</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-red-400">
      <WifiOff className="h-3 w-3" />
      <span>{state}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({
  isConnected,
  connectionState,
}: {
  isConnected: boolean;
  connectionState: string;
}) {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-white/40">
      {isConnected ? (
        <>
          <Bot className="h-8 w-8" />
          <p className="text-sm">开始对话</p>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">{connectionState}...</p>
        </>
      )}
    </div>
  );
}