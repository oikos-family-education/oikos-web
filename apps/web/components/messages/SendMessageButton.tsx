'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { Button } from '@oikos/ui';
import { NewMessageDialog } from './NewMessageDialog';

interface Props {
  familyId: string;
  familyName: string;
  className?: string;
}

/**
 * Send-message affordance used on the Discover family profile and on
 * community member cards. The gate (discoverable | shared community |
 * not blocked) is enforced server-side; this component just defers to
 * the API and shows the right error if the call fails.
 */
export function SendMessageButton({ familyId, familyName, className }: Props) {
  const t = useTranslations('Messages');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={className}
      >
        <MessageCircle className="w-4 h-4 mr-1.5" />
        {t('sendMessage')}
      </Button>
      <NewMessageDialog
        open={open}
        onClose={() => setOpen(false)}
        recipientFamilyId={familyId}
        recipientFamilyName={familyName}
      />
    </>
  );
}
