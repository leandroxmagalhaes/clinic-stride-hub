import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileName?: string;
  pendingAction?: {
    actionId: string;
    type: string;
    data: Record<string, unknown>;
  };
}

export interface CopilotFileUpload {
  name: string;
  base64: string;
  mimeType: string;
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const location = useLocation();

  // Carregar histórico persistido (últimas 100 mensagens do utilizador)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('copilot_messages')
          .select('id, role, content, file_name')
          .order('created_at', { ascending: true })
          .limit(100);
        if (!active) return;
        if (!error && data) {
          setMessages(
            data.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              fileName: m.file_name || undefined,
            }))
          );
        }
      } catch (e) {
        console.error('Erro ao carregar histórico do Copiloto:', e);
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Guarda uma mensagem no histórico (best-effort, não bloqueia a UI)
  const persistMessage = useCallback(async (role: 'user' | 'assistant', content: string, fileName?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!prof?.clinic_id) return;
      await (supabase as any).from('copilot_messages').insert({
        clinic_id: prof.clinic_id,
        user_id: user.id,
        role,
        content,
        file_name: fileName || null,
      });
    } catch (e) {
      console.error('Erro ao guardar mensagem:', e);
    }
  }, []);

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
    async (text: string, file?: CopilotFileUpload) => {
      if ((!text.trim() && !file) || isStreaming) return;

      const displayText = file
        ? text.trim()
          ? `📎 ${file.name}\n${text.trim()}`
          : `📎 ${file.name}`
        : text.trim();

      const userMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: displayText,
        fileName: file?.name,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      persistMessage('user', displayText, file?.name);

      // Build API messages (without file indicator in content for cleaner AI context)
      const apiMessages = [...messages, { ...userMsg, content: text.trim() || (file ? `Processar o ficheiro "${file.name}"` : '') }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let assistantSoFar = '';
      const assistantId = crypto.randomUUID();

      try {
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token || '';

        const body: Record<string, unknown> = {
          messages: apiMessages,
          context: getContext(),
        };

        if (file) {
          body.file_upload = {
            name: file.name,
            base64: file.base64,
            mime_type: file.mimeType,
          };
        }

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot-agent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(body),
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

        if (!assistantSoFar) {
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: 'Não consegui gerar uma resposta. Tente novamente.' },
          ]);
        } else {
          persistMessage('assistant', assistantSoFar);
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
    [messages, isStreaming, getContext, persistMessage]
  );

  const clearMessages = useCallback(async () => {
    setMessages([]);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from('copilot_messages').delete().eq('user_id', user.id);
      }
    } catch (e) {
      console.error('Erro ao limpar histórico:', e);
    }
  }, []);

  return {
    messages,
    isOpen,
    isStreaming,
    isLoadingHistory,
    togglePanel,
    sendMessage,
    clearMessages,
    setIsOpen,
  };
}
