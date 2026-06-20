'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CardTypeDef, WalletCardRecord } from '@/lib/wallet-card-types';
import { cardTypeDef } from '@/lib/wallet-card-types';
import type { WalletCardCategory } from '@/lib/wallet-cards-storage';
import { loadWalletCards, newCardId, saveWalletCards } from '@/lib/wallet-cards-storage';
import { expiryStatus } from '@/lib/wallet-card-expiry';
import {
  emptyUniversal,
  initialUniversalForType,
  migrateWalletCard,
  recordExpirationUniversal,
  syncCardFromUniversal,
  typeSpecificFields,
  displayCardSubtitle,
  frontPhoto,
} from '@/lib/wallet-card-universal';
import type { WalletCardUniversal } from '@/lib/wallet-card-universal';
import { cardContextPrompts, cardExpiryAlert, notesToSelfText } from '@/lib/wallet-card-actions';
import { extractCardContacts } from '@/lib/wallet-card-contact';
import { WalletCardContactActions } from './WalletCardContactActions';
import { CardFieldForm } from './CardFieldForm';
import { UniversalCardFields } from './UniversalCardFields';
import { WalletCardDetail } from './WalletCardDetail';
import { NotesToSelfBanner, WalletCardActionBanner } from './WalletCardActionBanner';

type Props = {
  email: string;
  category: WalletCardCategory;
  types: CardTypeDef[];
  emptyHint: string;
  renderTypeExtra?: (typeId: string, fields: Record<string, string>) => React.ReactNode;
};

type Mode = 'list' | 'detail' | 'create' | 'edit';

function emptyFields(typeDef: CardTypeDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of typeDef.fields) out[f.key] = '';
  return out;
}

export function EditableCardPanel({
  email,
  category,
  types,
  emptyHint,
  renderTypeExtra,
}: Props) {
  const [cards, setCards] = useState<WalletCardRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode>('list');
  const [selectedType, setSelectedType] = useState(types[0]?.id ?? '');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [universal, setUniversal] = useState<WalletCardUniversal>(emptyUniversal());

  useEffect(() => {
    setCards(loadWalletCards(email, category, types));
    setHydrated(true);
  }, [email, category, types]);

  const persist = useCallback(
    (next: WalletCardRecord[]) => {
      setCards(next);
      saveWalletCards(email, category, next);
    },
    [email, category]
  );

  const typeDef = useMemo(() => cardTypeDef(types, selectedType), [types, selectedType]);
  const viewingCard = viewingId ? cards.find((c) => c.id === viewingId) : null;

  const startCreate = (typeId: string) => {
    const def = cardTypeDef(types, typeId);
    if (!def) return;
    setSelectedType(typeId);
    setDraft(emptyFields(def));
    setUniversal(initialUniversalForType(typeId, def, category));
    setEditingId(null);
    setViewingId(null);
    setMode('create');
  };

  const startEdit = (card: WalletCardRecord) => {
    const def = cardTypeDef(types, card.type);
    if (!def) return;
    const migrated = migrateWalletCard(card, def, category);
    setSelectedType(card.type);
    setDraft({ ...emptyFields(def), ...migrated.fields });
    setUniversal(migrated.universal ?? emptyUniversal(def));
    setEditingId(card.id);
    setViewingId(card.id);
    setMode('edit');
  };

  const openDetail = (card: WalletCardRecord) => {
    setViewingId(card.id);
    setMode('detail');
  };

  const setField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = () => {
    if (!typeDef) return;
    const now = new Date().toISOString();
    let base: WalletCardRecord = {
      id: editingId ?? newCardId(),
      type: selectedType,
      label: universal.nickname.trim() || typeDef.label,
      expirationDate: universal.expirationDate,
      fields: draft,
      universal,
      createdAt: editingId ? cards.find((c) => c.id === editingId)?.createdAt ?? now : now,
      updatedAt: now,
    };
    base = syncCardFromUniversal(base, universal, typeDef);

    if (editingId) {
      persist(cards.map((c) => (c.id === editingId ? base : c)));
      setViewingId(base.id);
      setMode('detail');
    } else {
      persist([...cards, base]);
      setViewingId(base.id);
      setMode('detail');
    }
    setEditingId(null);
  };

  const remove = (id: string) => {
    persist(cards.filter((c) => c.id !== id));
    setMode('list');
    setViewingId(null);
    setEditingId(null);
  };

  if (!hydrated) {
    return <p className="text-[10px] text-[var(--ps-dim)]">Loading…</p>;
  }

  if (mode === 'detail' && viewingCard) {
    const def = cardTypeDef(types, viewingCard.type);
    const migrated = migrateWalletCard(viewingCard, def, category);
    return (
      <WalletCardDetail
        card={migrated}
        typeDef={def}
        onBack={() => {
          setMode('list');
          setViewingId(null);
        }}
        onEdit={() => startEdit(migrated)}
      />
    );
  }

  if (mode === 'create' || mode === 'edit') {
    if (!typeDef) return null;
    const extraFields = typeSpecificFields(typeDef);
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => (viewingId ? setMode('detail') : setMode('list'))}
          className="text-[10px] text-[var(--ps-cyan)] hover:underline"
        >
          ← {viewingId ? 'Back to card' : 'Back to list'}
        </button>

        <div className="text-[10px] font-semibold text-[var(--ps-white)]">{typeDef.label}</div>

        <UniversalCardFields value={universal} onChange={setUniversal} />

        {extraFields.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-semibold text-[var(--ps-dim)]">
              {typeDef.label} details
            </div>
            {renderTypeExtra?.(selectedType, draft)}
            <CardFieldForm fields={extraFields} values={draft} onChange={setField} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl bg-[var(--ps-pink)] py-2.5 text-[11px] font-semibold text-black"
          >
            Save card
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => remove(editingId)}
              className="rounded-xl border border-[var(--ps-red)]/40 px-4 py-2.5 text-[11px] text-[var(--ps-red)]"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  const alerts = cards.filter((c) => {
    const migrated = migrateWalletCard(c, cardTypeDef(types, c.type), category);
    if (migrated.universal?.renewalReminder === false) return false;
    const exp = recordExpirationUniversal(migrated);
    const s = expiryStatus(exp);
    return s === 'warning' || s === 'expired';
  });

  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-[10px] font-semibold text-amber-300">Renewal reminders</div>
          {alerts.map((c) => {
            const def = cardTypeDef(types, c.type);
            const migrated = migrateWalletCard(c, def, category);
            const alert = cardExpiryAlert(migrated, def);
            return alert ? (
              <WalletCardActionBanner key={c.id} action={alert} />
            ) : null;
          })}
        </div>
      )}

      {cards.length === 0 ? (
        <p className="text-[10px] leading-relaxed text-[var(--ps-muted)]">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => {
            const def = cardTypeDef(types, card.type);
            const migrated = migrateWalletCard(card, def, category);
            const subtitle = displayCardSubtitle(migrated, def);
            const photo = frontPhoto(migrated);
            const note = notesToSelfText(migrated);
            const phones = extractCardContacts(migrated, def);

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => openDetail(migrated)}
                className="flex w-full flex-col gap-2 rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-3 text-left transition-colors hover:border-[var(--ps-cyan)]/30"
              >
                <div className="flex items-start gap-3">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-md border border-[var(--ps-brd)] object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[var(--ps-brd)] bg-[var(--ps-surf)] text-lg">
                      🪪
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-[var(--ps-white)]">
                            {def?.label ?? 'Card'}
                          </span>
                          {migrated.universal?.isPrivate && (
                            <span className="text-[9px] text-[var(--ps-dim)]">🔒</span>
                          )}
                          {migrated.universal?.sharedWithFamily && (
                            <span className="text-[9px] text-violet-300">👨‍👩‍👧</span>
                          )}
                        </div>
                        {subtitle && (
                          <div className="truncate text-[9px] text-[var(--ps-dim)]">{subtitle}</div>
                        )}
                      </div>
                      <WalletCardContactActions
                        links={phones}
                        variant="list-right"
                        stopPropagation
                      />
                    </div>
                  </div>
                </div>
                {note && <NotesToSelfBanner text={note} />}
              </button>
            );
          })}
        </div>
      )}

      <div>
        <div className="mb-2 text-[10px] font-semibold text-[var(--ps-white)]">Add card</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => startCreate(t.id)}
              className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2 py-2 text-[9px] leading-snug text-[var(--ps-muted)] transition-colors hover:border-[var(--ps-pink)]/40 hover:text-[var(--ps-white)]"
            >
              + {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
