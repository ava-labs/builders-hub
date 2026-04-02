import { createMetadata } from '@/utils/metadata';
import type { Metadata } from 'next/types';

export const metadata: Metadata = createMetadata({
  title: 'Validator Alerts — Avalanche Builder Hub',
  description:
    'Monitor your Avalanche validators and receive email alerts for uptime drops, outdated versions, and approaching stake expiry.',
});

export default function ValidatorAlertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
