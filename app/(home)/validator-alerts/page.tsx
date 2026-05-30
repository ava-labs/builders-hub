'use client';

import { AlertDashboard } from '@/components/validator-alerts/AlertDashboard';

export default function ValidatorAlertsPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <AlertDashboard />
      </div>
    </div>
  );
}
