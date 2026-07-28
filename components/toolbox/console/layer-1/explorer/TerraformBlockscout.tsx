'use client';

import { useState } from 'react';
import { Step } from 'fumadocs-ui/components/steps';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { RPCURLInput } from '@/components/toolbox/components/RPCURLInput';
import { Input } from '@/components/toolbox/components/Input';
import {
  AVALANCHE_DEPLOY_REPO,
  BYO_INVENTORY_EXAMPLE,
  deriveWsUrl,
  genAnsibleByoCommand,
  genTerraformBlockscoutCommand,
  type DeployCloud,
} from './avalancheDeployCommands';

const CLOUDS: { value: DeployCloud; label: string }[] = [
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'GCP' },
  { value: 'azure', label: 'Azure' },
];

interface TerraformBlockscoutProps {
  blockchainId: string;
  evmChainId: number;
  chainName: string;
}

export default function TerraformBlockscout({ blockchainId, evmChainId, chainName }: TerraformBlockscoutProps) {
  const [cloud, setCloud] = useState<DeployCloud>('aws');
  const [byoRpcUrl, setByoRpcUrl] = useState('');
  const [byoWsUrl, setByoWsUrl] = useState('');

  const ready = !!blockchainId && evmChainId > 0 && !!chainName;
  const derivedWsUrl = byoRpcUrl ? deriveWsUrl(byoRpcUrl) : null;
  // Derivation wins: the manual field is only reachable while derivation
  // fails, and its stale value must not survive a switch to a derivable RPC.
  const effectiveByoWsUrl = derivedWsUrl || byoWsUrl || '';
  const multiWordChainName = /\s/.test(chainName.trim());

  return (
    <>
      <Step>
        <h3 className="text-xl font-bold mb-4">Avalanche Deploy Stack</h3>
        <p>
          This path deploys Blockscout as an add-on onto the cloud infrastructure provisioned by{' '}
          <a
            href={AVALANCHE_DEPLOY_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            avalanche-deploy
          </a>{' '}
          (Terraform + Ansible on AWS, GCP, or Azure). It requires a running L1 stack — validators and RPC nodes —
          deployed by that repo.
        </p>
        <p className="mt-2">
          Don't have one yet? Follow the{' '}
          <a
            href="/docs/tooling/avalanche-deploy/deploy-l1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Avalanche Deploy L1 guide
          </a>{' '}
          first, then come back here to add the explorer.
        </p>
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Open Your Deployment Checkout</h3>
        <p>
          Run the add-on from the same avalanche-deploy checkout that deployed your stack — <code>terraform apply</code>{' '}
          writes the Ansible inventory (<code>ansible/inventory/&lt;cloud&gt;_hosts</code>) into that working tree, and
          the Terraform state lives there too.
        </p>
        <DynamicCodeBlock lang="bash" code="cd avalanche-deploy" />
      </Step>

      {ready && (
        <>
          <Step>
            <h3 className="text-xl font-bold mb-4">Deploy Blockscout</h3>
            <p>Select the cloud provider your stack runs on:</p>
            <div className="grid grid-cols-3 gap-2 mt-4 mb-4">
              {CLOUDS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCloud(c.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    cloud === c.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium text-sm">{c.label}</div>
                </button>
              ))}
            </div>
            <p>Deploy the add-on with your L1's details:</p>
            <DynamicCodeBlock
              lang="bash"
              code={genTerraformBlockscoutCommand({ blockchainId, evmChainId, chainName, cloud })}
            />
            <p className="text-sm mt-2">
              Blockscout is deployed to your first archive RPC host (falls back to the first RPC host) and indexes the
              node running on that machine.
            </p>
            {multiWordChainName && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
                The current avalanche-deploy Makefile truncates multi-word chain names to the first word (the explorer
                would display "{chainName.trim().split(/\s+/)[0]}"). Use a single-word name here, or deploy via the
                direct playbook command in the last step, which preserves the full name.
              </div>
            )}
          </Step>

          <Step>
            <h3 className="text-xl font-bold mb-4">Expose the Explorer</h3>
            <p>
              By default the explorer ports are only reachable from your operator IP. To open them publicly, set the
              following in your <code>terraform.tfvars</code> and re-apply:
            </p>
            <DynamicCodeBlock lang="hcl" code="enable_public_blockscout = true" />
            <DynamicCodeBlock lang="bash" code={`terraform -chdir=terraform/l1/${cloud} apply`} />
            <p className="text-sm mt-2">
              This opens ports 4000 (API), 4001 (frontend), and 8050 (stats)
              {cloud === 'aws' ? ' — plus 4443, which only serves traffic if the Safe add-on’s nginx is deployed' : ''}.
              Note the explorer serves plain HTTP; put your own TLS termination in front for production use.
            </p>
          </Step>

          <Step>
            <h3 className="text-xl font-bold mb-4">Access Your Explorer</h3>
            <DynamicCodeBlock lang="bash" code={`terraform -chdir=terraform/l1/${cloud} output blockscout_url`} />
            <p className="text-sm mt-2">
              The frontend is served on port 4001 of the target host. On AWS the output is empty if you provisioned no
              archive RPC nodes (<code>rpc_archive_count = 0</code>); on GCP/Azure it points at the first RPC node.
            </p>
          </Step>

          <Step>
            <h3 className="text-xl font-bold mb-4">Alternative: Existing L1 or External RPC</h3>
            <Accordions type="single">
              <Accordion title="Deploy against an L1 not created by avalanche-deploy">
                <p>
                  The Blockscout role works against any L1 as long as you point it at a host and an RPC. Requirements
                  for the target host: Ubuntu on x86_64/amd64, reachable over SSH with passwordless sudo (the role
                  installs Docker itself). Save the following as <code>ansible/inventory/my_hosts</code> inside the
                  checkout:
                </p>
                <DynamicCodeBlock lang="ini" code={BYO_INVENTORY_EXAMPLE} />
                <p className="mt-4">Enter the RPC URL of your L1 (an archive node is recommended for full indexing):</p>
                <RPCURLInput
                  value={byoRpcUrl}
                  onChange={setByoRpcUrl}
                  helperText="Full RPC URL (e.g. https://your-node.com/ext/bc/blockchain-id/rpc)"
                  placeholder="https://your-node.com/ext/bc/blockchain-id/rpc"
                />
                {byoRpcUrl && !derivedWsUrl && (
                  <Input
                    label="WebSocket URL"
                    value={byoWsUrl}
                    onChange={setByoWsUrl}
                    helperText="Couldn't derive the ws endpoint from the RPC URL — enter it explicitly, or leave empty to skip realtime updates"
                  />
                )}
                {byoRpcUrl && (
                  <div className="mt-4">
                    <p className="mb-2">Run the playbook directly:</p>
                    <DynamicCodeBlock
                      lang="bash"
                      code={genAnsibleByoCommand({
                        blockchainId,
                        evmChainId,
                        chainName,
                        rpcUrl: byoRpcUrl,
                        wsUrl: effectiveByoWsUrl || undefined,
                      })}
                    />
                    {!effectiveByoWsUrl && (
                      <p className="text-sm mt-2">
                        Without a ws endpoint the explorer still works but won't stream new blocks in realtime.
                      </p>
                    )}
                  </div>
                )}
              </Accordion>
            </Accordions>
          </Step>
        </>
      )}
    </>
  );
}
