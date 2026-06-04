'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { EventsLang, t } from '@/lib/events/i18n';

export interface QuickRegistrationData {
  terms_event_conditions: boolean;
  city?: string;
  telegram_account?: string;
}

interface QuickRegistrationModalProps {
  open: boolean;
  hackathonTitle?: string;
  onConfirm: (data: QuickRegistrationData) => void;
  onCancel: () => void;
  lang?: EventsLang;
}

export function QuickRegistrationModal({
  open,
  hackathonTitle,
  onConfirm,
  onCancel,
  lang = 'en',
}: QuickRegistrationModalProps) {
  const [terms, setTerms] = useState(false);
  const [city, setCity] = useState('');
  const [telegram, setTelegram] = useState('');

  const handleConfirm = () => {
    if (!terms) return;
    onConfirm({ terms_event_conditions: true, city: city.trim() || undefined, telegram_account: telegram.trim() || undefined });
  };

  const titleText = lang === 'es' ? 'Registro requerido' : 'Registration required';
  const descText = lang === 'es'
    ? `Para enviar tu proyecto a ${hackathonTitle ?? 'este hackathon'} necesitamos registrarte. Completa los datos a continuación.`
    : `To submit your project to ${hackathonTitle ?? 'this hackathon'} we need to register you. Fill in the details below.`;
  const cityLabel = lang === 'es' ? 'Ciudad' : 'City';
  const telegramLabel = 'Telegram';
  const termsLabel = lang === 'es'
    ? 'Acepto los términos y condiciones del evento'
    : 'I accept the event terms and conditions';
  const cancelLabel = lang === 'es' ? 'Cancelar' : 'Cancel';
  const confirmLabel = lang === 'es' ? 'Registrar y enviar' : 'Register & submit';

  return (
    <Modal
      isOpen={open}
      onOpenChange={(v) => { if (!v) onCancel(); }}
      title={titleText}
      description={descText}
      footer={
        <div className="flex gap-3 w-full justify-end">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={handleConfirm} disabled={!terms}>{confirmLabel}</Button>
        </div>
      }
      content={
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="qr-city">{cityLabel}</Label>
            <Input
              id="qr-city"
              placeholder={lang === 'es' ? 'Tu ciudad' : 'Your city'}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="qr-telegram">{telegramLabel}</Label>
            <Input
              id="qr-telegram"
              placeholder="@username"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="qr-terms"
              checked={terms}
              onCheckedChange={(v) => setTerms(!!v)}
            />
            <Label htmlFor="qr-terms" className="text-sm leading-snug cursor-pointer">
              {termsLabel} <span className="text-red-500">*</span>
            </Label>
          </div>
        </div>
      }
    />
  );
}
