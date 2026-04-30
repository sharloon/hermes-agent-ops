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
  User,
  Wrench,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button, Spinner } from "@nous-research/ui";
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3",
          "border-b border-current/20 px-4 py-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ConnectionBadge state={connectionState} />
          {sessionInfo.model && (
            <span className="truncate font-mono text-[0.7rem] tracking-widest opacity-50 uppercase">
              {sessionInfo.model}
            </span>
          )}
        </div>

        <Button
          ghost
          size="icon"
          onClick={newSession}
          title="New conversation"
          className="shrink-0 opacity-60 hover:opacity-100"
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

        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Status / thinking indicator */}
          {isStreaming && statusText && (
            <div className="flex items-center gap-2 pl-10 text-xs opacity-50">
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
              "flex h-8 w-8 items-center justify-center",
              "rounded-full border border-current/20 bg-background-base/90 backdrop-blur-sm",
              "opacity-80 transition-opacity hover:opacity-100",
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex shrink-0 items-center gap-2 border-t border-error/30 bg-error/10 px-4 py-2 text-xs text-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{error}</span>
          <button
            onClick={newSession}
            className="ml-auto shrink-0 underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-current/20 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Type a message… (Enter to send, Shift+Enter for newline)" : "Connecting…"}
            disabled={!isConnected}
            rows={1}
            className={cn(
              "min-h-[40px] flex-1 resize-none rounded-none border border-current/30",
              "bg-transparent px-3 py-2 font-mono text-sm",
              "placeholder:opacity-30 focus:border-current/60 focus:outline-none",
              "transition-colors disabled:opacity-40",
            )}
          />
          {isStreaming ? (
            <Button
              ghost
              size="icon"
              onClick={() => void interrupt()}
              title="Stop generation"
              className="shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              ghost
              size="icon"
              onClick={() => void submit()}
              disabled={!canSend}
              title="Send message"
              className="shrink-0 disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mx-auto mt-1 max-w-3xl text-[0.65rem] opacity-25">
          Shift+Enter for newline · /commands supported
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MessageBubble                                                        */
/* ------------------------------------------------------------------ */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center",
          "border border-current/20",
          isUser ? "bg-midground/10" : "bg-midground/5",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Tool calls */}
        {message.toolCalls.length > 0 && (
          <div className="flex w-full flex-col gap-1">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.tool_id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Bubble */}
        {(message.text || message.streaming) && (
          <div
            className={cn(
              "min-w-0 border border-current/20 px-3 py-2.5",
              isUser
                ? "bg-midground/10 font-mono text-sm"
                : "bg-transparent",
            )}
          >
            {isUser ? (
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {message.text}
              </pre>
            ) : (
              <Markdown
                content={message.text}
                streaming={message.streaming}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ToolCallCard                                                         */
/* ------------------------------------------------------------------ */

function ToolCallCard({ toolCall }: { toolCall: ToolCallItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(toolCall.context || toolCall.preview || toolCall.summary);

  return (
    <div
      className={cn(
        "border border-current/20 px-3 py-1.5 text-xs",
        toolCall.status === "running" && "border-warning/40 bg-warning/5",
        toolCall.status === "done" && "border-current/10 bg-transparent opacity-60",
      )}
    >
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
      >
        <Wrench className="h-3 w-3 shrink-0 opacity-60" />
        <span className="flex-1 truncate font-mono tracking-wide">
          {toolCall.name}
        </span>
        {toolCall.status === "running" && (
          <Spinner className="shrink-0 text-[0.75rem]" />
        )}
        {hasDetail && (
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 opacity-40 transition-transform",
              expanded && "rotate-180",
            )}
          />
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 border-t border-current/10 pt-1.5">
          {toolCall.context && (
            <p className="mb-1 opacity-60">{toolCall.context}</p>
          )}
          {(toolCall.preview || toolCall.summary) && (
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[0.65rem] opacity-70">
              {toolCall.summary ?? toolCall.preview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ConnectionBadge                                                      */
/* ------------------------------------------------------------------ */

function ConnectionBadge({ state }: { state: string }) {
  if (state === "open") {
    return (
      <span className="flex items-center gap-1.5 text-[0.7rem] text-success opacity-70">
        <Wifi className="h-3 w-3" />
        <span className="uppercase tracking-widest">Connected</span>
      </span>
    );
  }
  if (state === "connecting") {
    return (
      <span className="flex items-center gap-1.5 text-[0.7rem] opacity-50">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="uppercase tracking-widest">Connecting</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[0.7rem] text-error opacity-70">
      <WifiOff className="h-3 w-3" />
      <span className="uppercase tracking-widest">{state}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                           */
/* ------------------------------------------------------------------ */

function EmptyState({
  isConnected,
  connectionState,
}: {
  isConnected: boolean;
  connectionState: string;
}) {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 opacity-40">
      {isConnected ? (
        <>
          <Bot className="h-10 w-10" />
          <p className="font-mono text-sm tracking-widest uppercase">
            Start a conversation
          </p>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="font-mono text-xs tracking-widest uppercase">
            {connectionState}…
          </p>
        </>
      )}
    </div>
  );
}
