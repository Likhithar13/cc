import React, { useState } from 'react';
import {
  AlertCircle,
  Bot,
  Send,
  ShieldAlert,
  User as UserIcon,
} from 'lucide-react';
import {
  AiUnavailableError,
  sendAiAssistantMessage,
  type ChatHistoryTurn,
  type OperationalDatasetInput,
} from '../services/apiService';
import { AnonymizedOperationalSnapshot } from '../types/bloodBank';

const SUGGESTED_QUESTIONS = [
  'Which blood group has the lowest stock?',
  'Which blood groups need attention right now?',
  'Give me a summary of current inventory.',
  'Suggest general stock-management improvements.',
];

interface AiChatPageProps {
  liveDataset?: OperationalDatasetInput;
}

export function AiChatPage({ liveDataset }: AiChatPageProps) {
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      text: string;
      meta?: string;
    }>
  >([
    {
      role: 'assistant',
      text: 'Hello. I am the HemoCore Administrative Blood Bank Assistant. Ask me about current blood group stock levels, near-expiry alerts, open request counts, or general inventory management suggestions. All answers use live anonymized Firestore inventory via Firebase AI Logic.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackSnapshot, setFallbackSnapshot] =
    useState<AnonymizedOperationalSnapshot | null>(null);

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || sending) return;

    setErrorMsg(null);
    setFallbackSnapshot(null);
    if (!promptText) setInput('');

    const historyForApi: ChatHistoryTurn[] = messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setSending(true);

    try {
      const res = await sendAiAssistantMessage(text, historyForApi, liveDataset);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.reply,
          meta: `Firebase AI Logic (${res.modelUsed}) · Live Firestore (${res.totalAvailableUnits} total available units · ${res.snapshotTimestamp.slice(11, 19)} UTC)`,
        },
      ]);
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        setErrorMsg(err.message);
        setFallbackSnapshot(err.deterministicSummary);
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Failed to communicate with AI assistant.'
        );
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          AI Administrative Assistant
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Real-time Gemini assistant via Firebase AI Logic grounded strictly in live, anonymized Firestore data.
        </p>
      </div>

      <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <span>
          <strong>Administrative Scope Only:</strong> This assistant never accesses donor PII and cannot make clinical compatibility, donor eligibility, or request approval decisions.
        </span>
      </div>

      {/* Quick Prompt Buttons */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={sending}
            onClick={() => void handleSend(q)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Transcript */}
      <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[500px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                <div>{msg.text}</div>
                {msg.meta && (
                  <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] font-mono text-slate-500">
                    {msg.meta}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-3 items-center text-xs text-slate-500">
              <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <span>Querying live Firestore snapshot and consulting Gemini...</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mx-5 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2 text-xs text-red-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            {fallbackSnapshot && (
              <div className="pt-2 border-t border-red-200/80 text-slate-700 font-mono">
                Deterministic Snapshot ({fallbackSnapshot.totalAvailableUnits}{' '}
                units total · Low:{' '}
                {fallbackSnapshot.lowStockGroups.join(', ') || 'None'} ·
                Near-expiry: {fallbackSnapshot.nearExpiryUnits})
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="p-4 border-t border-slate-200 flex gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about blood stock levels, low-stock groups, or inventory summaries..."
            className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
