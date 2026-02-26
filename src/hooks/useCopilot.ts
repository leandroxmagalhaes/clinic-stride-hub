import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pendingAction?: {
    actionId: string;
    type: string;
    data: Record<string, unknown>;
  };
}

interface CopilotContext {
  currentPage: string;
  patientId?: string;
  patientName?: string;
  selectedDate?: string;
}

export function useCopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const location = useLocation();

  const getContext = useCallback((): CopilotContext => {
    return {
      currentPage: location.pathname,
    };
  }, [location.pathname]);

  const togglePanel = useCallback(() => setIsOpen((v) => !v), []);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePanel]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let assistantSoFar = '';
      const assistantId = crypto.randomUUID();

      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot-agent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: apiMessages,
              context: getContext(),
            }),
          }
        );

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          const errorMsg = errorData.error || `Erro ${resp.status}`;
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: `❌ ${errorMsg}` },
          ]);
          setIsStreaming(false);
          return;
        }

        if (!resp.body) {
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: '❌ Resposta vazia do servidor.' },
          ]);
          setIsStreaming(false);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';

        const upsertAssistant = (chunk: string) => {
          assistantSoFar += chunk;
          const currentContent = assistantSoFar;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && last.id === assistantId) {
              return prev.map((m) =>
                m.id === assistantId ? { ...m, content: currentContent } : m
              );
            }
            return [...prev, { id: assistantId, role: 'assistant', content: currentContent }];
          });
        };

        let streamDone = false;
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }

        // Flush remaining
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split('\n')) {
            if (!raw) continue;
            if (raw.endsWith('\r')) raw = raw.slice(0, -1);
            if (raw.startsWith(':') || raw.trim() === '') continue;
            if (!raw.startsWith('data: ')) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              /* ignore */
            }
          }
        }

        // If no content was streamed, add a fallback
        if (!assistantSoFar) {
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: 'Não consegui gerar uma resposta. Tente novamente.' },
          ]);
        }
      } catch (e) {
        console.error('Copilot error:', e);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '❌ Erro de conexão. Verifique sua internet e tente novamente.',
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, getContext]
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    isOpen,
    isStreaming,
    togglePanel,
    sendMessage,
    clearMessages,
    setIsOpen,
  };
}
