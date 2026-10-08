'use client';

import { useState, useEffect } from 'react';
import { Button } from '../Button';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { cn } from '../utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Input } from '../ui/input';
import type { ConvertToL1Validator } from '../ValidatorListInput';
import { validateManagedNodeCredentials, validateNodeCredentials } from './nodeCredentials';

type ManagedTestnetNodeSuggestion = {
  id: string;
  node_id: string;
  chain_name: string | null;
  public_key?: string;
  proof_of_possession?: string;
  subnet_id?: string;
};

interface Props {
  defaultAddress?: string;
  canAddMore: boolean;
  onAddValidator: (validator: ConvertToL1Validator) => void;
  selectedSubnetId?: string | null;
  existingNodeIds?: string[];
  isTestnet?: boolean;
}

export function AddValidatorControls({
  defaultAddress = '',
  canAddMore,
  onAddValidator,
  selectedSubnetId = null,
  existingNodeIds = [],
  isTestnet = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'managed' | 'json' | 'manual'>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [manualNodeID, setManualNodeID] = useState('');
  const [manualPublicKey, setManualPublicKey] = useState('');
  const [manualProof, setManualProof] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [managedNodes, setManagedNodes] = useState<ManagedTestnetNodeSuggestion[]>([]);
  const [managedNodesLoaded, setManagedNodesLoaded] = useState(false);

  const rpcCommand = `curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' -H "content-type:application/json;" 127.0.0.1:9650/ext/info`;

  // Fetch managed testnet nodes
  useEffect(() => {
    let isMounted = true;
    const fetchManagedNodes = async () => {
      try {
        const response = await fetch('/api/managed-testnet-nodes', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.message || data.error || 'Failed to fetch hosted nodes');
        }
        if (isMounted && Array.isArray(data.nodes)) {
          setManagedNodes(data.nodes as ManagedTestnetNodeSuggestion[]);
        }
      } catch (e) {
        console.error('Failed to fetch hosted nodes for autofill:', e);
      } finally {
        if (isMounted) setManagedNodesLoaded(true);
      }
    };
    fetchManagedNodes();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-select managed tab if there are available nodes for the selected subnet and we're on testnet
  useEffect(() => {
    if (managedNodesLoaded && isTestnet) {
      const filteredNodes = managedNodes.filter((n) => !selectedSubnetId || n.subnet_id === selectedSubnetId);
      if (filteredNodes.length > 0) {
        setActiveTab('managed');
      }
    }
  }, [managedNodes, managedNodesLoaded, selectedSubnetId, isTestnet]);

  const handleAutofillFromManaged = (choice: ManagedTestnetNodeSuggestion) => {
    setError(null);
    if (!choice.node_id) {
      setError('Hosted node is missing NodeID');
      return;
    }
    const existing = existingNodeIds.includes(choice.node_id);
    if (existing) {
      setError('A validator with this NodeID already exists.');
      return;
    }

    const validated = validateManagedNodeCredentials({
      nodeID: choice.node_id,
      publicKey: choice.public_key || '',
      proofOfPossession: choice.proof_of_possession || '',
    });
    if (!validated.ok) {
      setError(`Hosted node returned invalid credentials. ${validated.error}`);
      return;
    }
    const { nodeID, publicKey, proofOfPossession } = validated.value;

    const newValidator: ConvertToL1Validator = {
      nodeID,
      nodePOP: { publicKey, proofOfPossession },
      validatorWeight: BigInt(100),
      validatorBalance: BigInt(100000000),
      remainingBalanceOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
      deactivationOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
    };

    onAddValidator(newValidator);
  };

  const handleAddFromJson = () => {
    try {
      if (!jsonInput.trim()) {
        setError('Please enter a valid JSON response');
        return;
      }
      const parsed = JSON.parse(jsonInput);
      const { nodeID, nodePOP } = parsed.result ? parsed.result : parsed;
      if (!nodeID || !nodePOP?.publicKey || !nodePOP?.proofOfPossession) {
        setError('Invalid JSON format. Missing nodeID or nodePOP.');
        return;
      }
      const validated = validateNodeCredentials({
        nodeID,
        publicKey: nodePOP.publicKey,
        proofOfPossession: nodePOP.proofOfPossession,
      });
      if (!validated.ok) {
        setError(validated.error);
        return;
      }
      const validator: ConvertToL1Validator = {
        nodeID: validated.value.nodeID,
        nodePOP: {
          publicKey: validated.value.publicKey,
          proofOfPossession: validated.value.proofOfPossession,
        },
        validatorWeight: BigInt(100),
        validatorBalance: BigInt(100000000),
        remainingBalanceOwner: {
          addresses: defaultAddress ? [defaultAddress] : [],
          threshold: 1,
        },
        deactivationOwner: {
          addresses: defaultAddress ? [defaultAddress] : [],
          threshold: 1,
        },
      };
      onAddValidator(validator);
      setJsonInput('');
      setError(null);
    } catch (e) {
      setError(`Error parsing JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleAddManual = () => {
    if (!manualNodeID.trim() || !manualPublicKey.trim() || !manualProof.trim()) {
      setError('Please provide NodeID, BLS Public Key, and Proof of Possession');
      return;
    }
    const validated = validateNodeCredentials({
      nodeID: manualNodeID,
      publicKey: manualPublicKey,
      proofOfPossession: manualProof,
    });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    const validator: ConvertToL1Validator = {
      nodeID: validated.value.nodeID,
      nodePOP: {
        publicKey: validated.value.publicKey,
        proofOfPossession: validated.value.proofOfPossession,
      },
      validatorWeight: BigInt(100),
      validatorBalance: BigInt(100000000),
      remainingBalanceOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
      deactivationOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
    };
    onAddValidator(validator);
    setManualNodeID('');
    setManualPublicKey('');
    setManualProof('');
    setError(null);
  };

  const filteredManagedNodes = managedNodes.filter((n) => !selectedSubnetId || n.subnet_id === selectedSubnetId);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-1 dark:border-zinc-800">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Add Validator
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'managed' | 'json' | 'manual')}>
        <TabsList
          className={`grid h-auto w-full rounded-none border-b border-zinc-200 bg-transparent p-0 dark:border-zinc-800 ${isTestnet ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          {isTestnet && (
            <TabsTrigger
              value="managed"
              className="rounded-none border-b-2 border-transparent px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 focus-visible:ring-0 data-[state=active]:border-zinc-900 data-[state=active]:bg-transparent data-[state=active]:text-zinc-900 data-[state=active]:shadow-none dark:text-zinc-400 dark:hover:text-zinc-100 dark:data-[state=active]:border-zinc-100 dark:data-[state=active]:text-zinc-100"
            >
              Managed Node
            </TabsTrigger>
          )}
          <TabsTrigger
            value="json"
            className="rounded-none border-b-2 border-transparent px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 focus-visible:ring-0 data-[state=active]:border-zinc-900 data-[state=active]:bg-transparent data-[state=active]:text-zinc-900 data-[state=active]:shadow-none dark:text-zinc-400 dark:hover:text-zinc-100 dark:data-[state=active]:border-zinc-100 dark:data-[state=active]:text-zinc-100"
          >
            API Response
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="rounded-none border-b-2 border-transparent px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 focus-visible:ring-0 data-[state=active]:border-zinc-900 data-[state=active]:bg-transparent data-[state=active]:text-zinc-900 data-[state=active]:shadow-none dark:text-zinc-400 dark:hover:text-zinc-100 dark:data-[state=active]:border-zinc-100 dark:data-[state=active]:text-zinc-100"
          >
            Manual Input
          </TabsTrigger>
        </TabsList>

        {isTestnet && (
          <TabsContent value="managed" className="space-y-4">
            {!managedNodesLoaded ? (
              <div className="text-[13px] text-zinc-500 dark:text-zinc-400">Loading managed testnet nodes...</div>
            ) : filteredManagedNodes.length === 0 ? (
              <div className="space-y-3">
                <div className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  No managed testnet nodes found for the selected Subnet.
                </div>
                <div className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Need a managed testnet node? Visit{' '}
                  <a
                    href="/console/testnet-infra/nodes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 underline underline-offset-4 hover:decoration-[#E6212F] dark:text-zinc-100"
                  >
                    Free Testnet Infrastructure
                  </a>{' '}
                  to set one up.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredManagedNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between gap-3 border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="truncate font-mono text-[12px] leading-tight text-zinc-900 dark:text-zinc-100">
                        {node.node_id}
                      </div>
                      <div className="truncate text-[12px] leading-tight text-zinc-500 dark:text-zinc-400">
                        {node.chain_name ? `${node.chain_name} — ` : ''}Subnet: {node.subnet_id || 'unknown'}
                      </div>
                      {node.public_key && node.proof_of_possession ? (
                        <div className="text-[12px] leading-tight text-emerald-700 dark:text-emerald-400">
                          BLS PoP available
                        </div>
                      ) : (
                        <div className="text-[12px] leading-tight text-amber-700 dark:text-amber-400">
                          BLS info not available; paste JSON or enter manually
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleAutofillFromManaged(node)}
                      variant="primary"
                      className="shrink-0 !w-auto"
                      size="sm"
                      disabled={!canAddMore}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="json" className="space-y-4">
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            Click the copy button to copy the command and run it in your node's terminal to get the node credentials.
          </p>
          <DynamicCodeBlock code={rpcCommand} lang="zsh" />
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Paste the JSON response below:</p>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"jsonrpc":"2.0","result":{"nodeID":"...","nodePOP":{"publicKey":"...",  "proofOfPossession":"..."}},"id":1}'
            rows={4}
            className={cn(
              'w-full rounded-none p-3 font-mono text-[12px]',
              'bg-white dark:bg-zinc-950',
              'border border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
              'text-zinc-900 dark:text-zinc-100',
              'transition-colors focus:outline-none',
              'placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
            )}
          />
          <div className="pt-2">
            <Button
              onClick={handleAddFromJson}
              icon={undefined}
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!canAddMore}
            >
              Add Validator
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Node ID
              </label>
              <Input
                type="text"
                value={manualNodeID}
                onChange={(e) => setManualNodeID(e.target.value)}
                className="h-10 rounded-none border-zinc-200 bg-white font-mono text-[12px] text-zinc-900 shadow-none hover:border-zinc-400 focus-visible:border-zinc-900 focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus-visible:border-zinc-300"
                placeholder="NodeID-…"
              />
            </div>
            <div className="space-y-2">
              <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                BLS Public Key
              </label>
              <Input
                type="text"
                value={manualPublicKey}
                onChange={(e) => setManualPublicKey(e.target.value)}
                className="h-10 rounded-none border-zinc-200 bg-white font-mono text-[12px] text-zinc-900 shadow-none hover:border-zinc-400 focus-visible:border-zinc-900 focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus-visible:border-zinc-300"
                placeholder="0x…"
              />
            </div>
            <div className="space-y-2">
              <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                BLS Proof of Possession
              </label>
              <Input
                type="text"
                value={manualProof}
                onChange={(e) => setManualProof(e.target.value)}
                className="h-10 rounded-none border-zinc-200 bg-white font-mono text-[12px] text-zinc-900 shadow-none hover:border-zinc-400 focus-visible:border-zinc-900 focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus-visible:border-zinc-300"
                placeholder="0x…"
              />
            </div>
            <div>
              <Button onClick={handleAddManual} variant="primary" className="w-full sm:w-auto" disabled={!canAddMore}>
                Add Validator (Manual)
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="border border-red-200 bg-red-50/60 p-3 text-[13px] text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
