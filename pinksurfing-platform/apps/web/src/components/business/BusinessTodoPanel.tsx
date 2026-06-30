'use client';

import { useEffect, useState } from 'react';
import {
  addBusinessTodo,
  loadBusinessTodos,
  removeBusinessTodo,
  toggleBusinessTodo,
  type BusinessTodo,
} from '@/lib/business-todos';
import { todoColors } from '@/lib/status-colors';

type Props = {
  conversationId: string;
  onChange?: () => void;
};

export function BusinessTodoPanel({ conversationId, onChange }: Props) {
  const [todos, setTodos] = useState<BusinessTodo[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setTodos(loadBusinessTodos(conversationId));
  }, [conversationId]);

  const refresh = (next: BusinessTodo[]) => {
    setTodos(next);
    onChange?.();
  };

  const pending = todos.filter((t) => !t.done);

  return (
    <div className="border-t border-[var(--ps-brd)] px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
          To-do ({pending.length})
        </div>
        {pending.length > 0 && (
          <span
            className="rounded px-1.5 py-0.5 text-[8px] font-medium"
            style={{
              color: todoColors(true).text,
              background: todoColors(true).bg,
              border: `1px solid ${todoColors(true).border}`,
            }}
          >
            Open
          </span>
        )}
      </div>
      <form
        className="mb-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          refresh(addBusinessTodo(conversationId, draft));
          setDraft('');
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add task…"
          className="min-w-0 flex-1 rounded-md border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-1 text-[10px] text-[var(--ps-white)] outline-none placeholder:text-[var(--ps-dim)]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 rounded-md border border-[var(--ps-cyan)]/40 px-2 py-1 text-[9px] text-[var(--ps-cyan)] disabled:opacity-50"
        >
          Add
        </button>
      </form>
      <div className="space-y-1">
        {todos.length === 0 && (
          <p className="text-[9px] text-[var(--ps-dim)]">No tasks — track follow-ups here.</p>
        )}
        {todos.map((t) => {
          const colors = todoColors(!t.done);
          return (
            <div
              key={t.id}
              className="flex items-start gap-1.5 rounded-lg border px-2 py-1.5"
              style={{
                borderColor: colors.border,
                background: t.done ? 'transparent' : colors.bg,
              }}
            >
              <button
                type="button"
                onClick={() => refresh(toggleBusinessTodo(conversationId, t.id))}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border"
                style={{ borderColor: colors.text, background: t.done ? colors.text : 'transparent' }}
                aria-label={t.done ? 'Mark open' : 'Mark done'}
              />
              <span
                className={`min-w-0 flex-1 text-[10px] ${t.done ? 'text-[var(--ps-dim)] line-through' : 'text-[var(--ps-white)]'}`}
              >
                {t.text}
              </span>
              <button
                type="button"
                onClick={() => refresh(removeBusinessTodo(conversationId, t.id))}
                className="text-[10px] leading-none text-[var(--ps-dim)] hover:text-[var(--ps-red)]"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
