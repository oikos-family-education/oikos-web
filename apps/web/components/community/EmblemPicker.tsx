'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EMBLEMS, EMBLEM_GROUPS, type EmblemGroup } from '../../lib/communityEmblems';
import { Modal } from '../dashboard/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (emblemId: string | null) => void;
  current?: string | null;
}

export function EmblemPicker({ open, onClose, onPick, current }: Props) {
  const t = useTranslations('Community.identity');
  const [active, setActive] = useState<EmblemGroup>('nature');

  const visible = EMBLEMS.filter((e) => e.group === active);

  return (
    <Modal open={open} onClose={onClose} title={t('pickEmblem')}>
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
        {EMBLEM_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActive(g.id)}
            className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap ${
              active === g.id
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
        <button
          type="button"
          onClick={() => { onPick(null); onClose(); }}
          className={`aspect-square flex items-center justify-center rounded-lg border text-xs text-slate-400 hover:border-slate-300 ${
            !current ? 'border-primary bg-primary/5' : 'border-slate-200'
          }`}
        >
          ✕
        </button>
        {visible.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { onPick(id); onClose(); }}
            className={`aspect-square flex items-center justify-center rounded-lg border hover:border-slate-300 ${
              current === id ? 'border-primary bg-primary/5' : 'border-slate-200'
            }`}
            title={id.replace(/_/g, ' ')}
          >
            <Icon className="w-5 h-5 text-slate-700" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
