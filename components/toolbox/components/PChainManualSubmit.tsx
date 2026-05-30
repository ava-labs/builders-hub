import React, { useState } from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
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
    <div className="p-3 rounded-xl border bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 space-y-3">
      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        Run this command to submit the P-Chain transaction:
      </p>
      <DynamicCodeBlock lang="bash" code={cliCommand} />
      <Input
        label="P-Chain Transaction ID"
        value={manualPChainTxId}
        onChange={setManualPChainTxId}
        placeholder="Paste the P-Chain transaction ID after running the command above"
      />
      <Button onClick={handleSubmit} disabled={disabled || !manualPChainTxId.trim()}>
        Continue with P-Chain TX ID
      </Button>
    </div>
  );
};
