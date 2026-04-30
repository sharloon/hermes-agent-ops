import { useCallback, useEffect, useRef, useState } from "react";
import { GatewayClient, type ConnectionState } from "@/lib/gatewayClient";

export type ToolCallStatus = "running" | "done" | "error";

export type ToolCallItem = {
  tool_id: string;
  name: string;
  context?: string;
  preview?: string;
  summary?: string;
  status: ToolCallStatus;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming: boolean;
  toolCalls: ToolCallItem[];
};

export type SessionInfo = {
  model?: string;
};

export type UseChatOptions = {
  autoResume?: boolean;  // 自动恢复最近对话
};

let _msgCounter = 0;
function nextMsgId() {
  return `msg-${++_msgCounter}`;
}

// Convert history from session.resume to ChatMessage format
function historyToMessages(history: Array<{role: string; text?: string; name?: string; context?: string}>): ChatMessage[] {
  const result: ChatMessage[] = [];
  let currentAssistant: ChatMessage | null = null;

  for (const h of history) {
    if (h.role === "user" && h.text) {
      // Close any pending assistant message
      if (currentAssistant) {
        result.push(currentAssistant);
        currentAssistant = null;
      }
      result.push({ id: nextMsgId(), role: "user", text: h.text, streaming: false, toolCalls: [] });
    } else if (h.role === "assistant" && h.text) {
      // Start or continue assistant message
      if (!currentAssistant) {
        currentAssistant = { id: nextMsgId(), role: "assistant", text: "", streaming: false, toolCalls: [] };
      }
      currentAssistant.text += h.text;
    } else if (h.role === "tool") {
      // Add tool call to current assistant message
      if (!currentAssistant) {
        currentAssistant = { id: nextMsgId(), role: "assistant", text: "", streaming: false, toolCalls: [] };
      }
      currentAssistant.toolCalls.push({
        tool_id: nextMsgId(),
        name: h.name || "tool",
        context: h.context,
        status: "done",
      });
    }
  }

  // Close final assistant message
  if (currentAssistant) {
    result.push(currentAssistant);
  }

  return result;
}

export function useChat(options: UseChatOptions = {}) {
  const { autoResume = true } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const gwRef = useRef<GatewayClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Keep ref in sync for use inside callbacks
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const connect = useCallback(async () => {
    gwRef.current?.close();

    const gw = new GatewayClient();
    gwRef.current = gw;

    setMessages([]);
    setSessionId(null);
    setSessionInfo({});
    setError(null);
    setIsStreaming(false);
    setStatusText("");

    gw.onState(setConnectionState);

    // gateway.ready — resolve the readyPromise
    let readyResolve: (() => void) | null = null;
    const readyPromise = new Promise<void>((res) => {
      readyResolve = res;
    });
    gw.on("gateway.ready", () => readyResolve?.());

    gw.on<{ model?: string }>("session.info", (ev) => {
      if (ev.payload?.model) {
        setSessionInfo({ model: ev.payload.model });
      }
    });

    gw.on<{ text?: string }>("status.update", (ev) => {
      setStatusText(ev.payload?.text ?? "");
    });

    gw.on("message.start", () => {
      setIsStreaming(true);
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "assistant", text: "", streaming: true, toolCalls: [] },
      ]);
    });

    gw.on<{ text?: string }>("message.delta", (ev) => {
      const chunk = ev.payload?.text ?? "";
      if (!chunk) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
      });
    });

    gw.on<{ text?: string }>("message.complete", (ev) => {
      setIsStreaming(false);
      setStatusText("");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const finalText = ev.payload?.text ?? last.text;
        return [...prev.slice(0, -1), { ...last, text: finalText, streaming: false }];
      });
    });

    gw.on<{ tool_id?: string; name?: string; context?: string }>("tool.start", (ev) => {
      if (!ev.payload?.tool_id) return;
      const toolCall: ToolCallItem = {
        tool_id: ev.payload.tool_id,
        name: ev.payload.name ?? "tool",
        context: ev.payload.context,
        status: "running",
      };
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, toolCalls: [...last.toolCalls, toolCall] }];
      });
    });

    gw.on<{ name?: string; preview?: string }>("tool.progress", (ev) => {
      if (!ev.payload?.name) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const toolCalls = last.toolCalls.map((tc) =>
          tc.name === ev.payload!.name ? { ...tc, preview: ev.payload!.preview } : tc,
        );
        return [...prev.slice(0, -1), { ...last, toolCalls }];
      });
    });

    gw.on<{ tool_id?: string; name?: string; summary?: string }>("tool.complete", (ev) => {
      if (!ev.payload?.tool_id) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const toolCalls = last.toolCalls.map((tc) =>
          tc.tool_id === ev.payload!.tool_id
            ? { ...tc, status: "done" as const, summary: ev.payload!.summary }
            : tc,
        );
        return [...prev.slice(0, -1), { ...last, toolCalls }];
      });
    });

    gw.on<{ message?: string }>("error", (ev) => {
      setError(ev.payload?.message ?? "Unknown error");
      setIsStreaming(false);
    });

    // Reject readyPromise if connection closes before gateway.ready arrives
    const unsubClose = gw.onState((s) => {
      if (s === "closed" || s === "error") {
        readyResolve = null; // prevent double-resolve
        setError(`WebSocket ${s} before gateway was ready`);
      }
    });

    try {
      await gw.connect(undefined, "/api/chat-ws");

      // Wait for gateway.ready with a 15 s timeout
      await Promise.race([
        readyPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timed out waiting for gateway.ready — check that hermes dashboard was restarted after the update")), 15_000),
        ),
      ]);

      // Try to resume recent session if autoResume is enabled
      if (autoResume) {
        try {
          const recent = await gw.request<{ session_id: string | null; title?: string }>("session.most_recent", {});
          if (recent.session_id) {
            const resumed = await gw.request<{ session_id: string; messages: Array<{role: string; text?: string; name?: string; context?: string}> }>(
              "session.resume",
              { session_id: recent.session_id }
            );
            setSessionId(resumed.session_id);
            setMessages(historyToMessages(resumed.messages || []));
            // Don't create a new session, use the resumed one
          } else {
            // No recent session, create new
            const result = await gw.request<{ session_id: string }>("session.create", {});
            setSessionId(result.session_id);
          }
        } catch {
          // Resume failed, create new session
          const result = await gw.request<{ session_id: string }>("session.create", {});
          setSessionId(result.session_id);
        }
      } else {
        const result = await gw.request<{ session_id: string }>("session.create", {});
        setSessionId(result.session_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      unsubClose();
    }
  }, [autoResume]);

  const sendMessage = useCallback(
    async (text: string) => {
      const sid = sessionIdRef.current;
      if (!gwRef.current || !sid) return;

      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "user", text, streaming: false, toolCalls: [] },
      ]);

      try {
        await gwRef.current.request("prompt.submit", { session_id: sid, text });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message");
      }
    },
    [],
  );

  const interrupt = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!gwRef.current || !sid) return;
    try {
      await gwRef.current.request("session.interrupt", { session_id: sid });
    } catch {
      // best-effort
    }
  }, []);

  const newSession = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      gwRef.current?.close();
    };
  }, [connect]);

  return {
    messages,
    connectionState,
    sessionInfo,
    isStreaming,
    statusText,
    error,
    sessionId,
    sendMessage,
    interrupt,
    newSession,
  };
}
