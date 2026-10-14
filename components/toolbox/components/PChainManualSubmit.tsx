import React, { useState } from 'react';
import { CliAlternative } from '@/components/console/cli-alternative';
import { Input } from '@/components/toolbox/components/Input';
import { Button } from '@/components/toolbox/components/Button';

export interface PChainManualSubmitProps {
  cliCommand: string;
  onSubmit: (pChainTxId: string) => void;
  disabled?: boolean;
}

/**
 * Panel for non-Core wallets: shows a CLI command to run and an input
 * to paste the resulting P-Chain transaction ID.
 */
export const PChainManualSubmit: React.FC<PChainManualSubmitProps> = ({ cliCommand, onSubmit, disabled }) => {
  const [manualPChainTxId, setManualPChainTxId] = useState('');

  const handleSubmit = () => {
    if (manualPChainTxId.trim()) {
      onSubmit(manualPChainTxId.trim());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <CliAlternative command={cliCommand} />
      <div>
        <Input
          label="P-Chain transaction ID"
          value={manualPChainTxId}
          onChange={setManualPChainTxId}
          placeholder="Paste the ID the command prints"
        />
        <Button onClick={handleSubmit} disabled={disabled || !manualPChainTxId.trim()}>
          Continue with this transaction
        </Button>
      </div>
    </div>
  );
};
