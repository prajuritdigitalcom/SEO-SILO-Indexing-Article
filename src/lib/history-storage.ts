import { HistoryItem } from '../types';

const HISTORY_STORAGE_KEY = 'seo_architecture_history';
const MAX_HISTORY_ITEMS = 100;

interface HistoryPayload {
  version: number;
  items: HistoryItem[];
}

export function loadLocalHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      return parsed.items;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('[HistoryStorage] Gagal memuat history dari localStorage:', err);
    return [];
  }
}

export function saveLocalHistoryItem(item: HistoryItem): HistoryItem[] {
  try {
    const existing = loadLocalHistory();
    const index = existing.findIndex((h) => h.id === item.id);
    const now = new Date().toISOString();
    const itemToSave: HistoryItem = {
      ...item,
      updatedAt: now,
      createdAt: item.createdAt || now,
    };

    if (index >= 0) {
      existing[index] = itemToSave;
    } else {
      existing.unshift(itemToSave);
    }

    // Limit to MAX_HISTORY_ITEMS
    const trimmed = existing.slice(0, MAX_HISTORY_ITEMS);
    const payload: HistoryPayload = {
      version: 1,
      items: trimmed,
    };
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
    return trimmed;
  } catch (err) {
    console.error('[HistoryStorage] Gagal menyimpan history ke localStorage:', err);
    return loadLocalHistory();
  }
}

export function deleteLocalHistoryItem(id: string): HistoryItem[] {
  try {
    const existing = loadLocalHistory();
    const filtered = existing.filter((h) => h.id !== id);
    const payload: HistoryPayload = {
      version: 1,
      items: filtered,
    };
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
    return filtered;
  } catch (err) {
    console.error('[HistoryStorage] Gagal menghapus history dari localStorage:', err);
    return loadLocalHistory();
  }
}

export function clearLocalHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.error('[HistoryStorage] Gagal membersihkan history:', err);
  }
}
