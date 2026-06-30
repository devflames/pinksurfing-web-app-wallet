export type BusinessTodo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

const KEY = 'ps-business-todos';

function storageKey(conversationId: string): string {
  return `${KEY}:${conversationId}`;
}

export function loadBusinessTodos(conversationId: string): BusinessTodo[] {
  if (typeof window === 'undefined' || !conversationId) return [];
  try {
    const raw = localStorage.getItem(storageKey(conversationId));
    return raw ? (JSON.parse(raw) as BusinessTodo[]) : [];
  } catch {
    return [];
  }
}

export function saveBusinessTodos(conversationId: string, todos: BusinessTodo[]): BusinessTodo[] {
  if (typeof window === 'undefined' || !conversationId) return todos;
  localStorage.setItem(storageKey(conversationId), JSON.stringify(todos));
  return todos;
}

export function hasPendingBusinessTodos(conversationId: string): boolean {
  return loadBusinessTodos(conversationId).some((t) => !t.done);
}

export function addBusinessTodo(conversationId: string, text: string): BusinessTodo[] {
  const trimmed = text.trim();
  if (!trimmed) return loadBusinessTodos(conversationId);
  const next: BusinessTodo = {
    id: `todo-${Date.now()}`,
    text: trimmed,
    done: false,
    createdAt: new Date().toISOString(),
  };
  return saveBusinessTodos(conversationId, [...loadBusinessTodos(conversationId), next]);
}

export function toggleBusinessTodo(conversationId: string, id: string): BusinessTodo[] {
  const list = loadBusinessTodos(conversationId).map((t) =>
    t.id === id ? { ...t, done: !t.done } : t
  );
  return saveBusinessTodos(conversationId, list);
}

export function removeBusinessTodo(conversationId: string, id: string): BusinessTodo[] {
  return saveBusinessTodos(
    conversationId,
    loadBusinessTodos(conversationId).filter((t) => t.id !== id)
  );
}
