'use client';

import { useState } from 'react';
import { Step } from 'fumadocs-ui/components/steps';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { RadioGroup } from '@/components/toolbox/components/RadioGroup';
import { RPCURLInput } from '@/components/toolbox/components/RPCURLInput';
import { Input } from '@/components/toolbox/components/Input';
import {
  AVALANCHE_DEPLOY_REPO,
  deriveWsUrl,
  genHelmBlockscoutCommand,
  genHelmIngressCommand,
  genInClusterRpcUrls,
} from './avalancheDeployCommands';

interface KubernetesBlockscoutProps {
  blockchainId: string;
  evmChainId: number;
  chainName: string;
}

export default function KubernetesBlockscout({ blockchainId, evmChainId, chainName }: KubernetesBlockscoutProps) {
  const [rpcOption, setRpcOption] = useState<'in-cluster' | 'existing'>('in-cluster');
  const [existingRpcUrl, setExistingRpcUrl] = useState('');
  const [existingWsUrl, setExistingWsUrl] = useState('');

  const ready = !!blockchainId && evmChainId > 0 && !!chainName;
  const inCluster = genInClusterRpcUrls(blockchainId);
  const derivedWsUrl = existingRpcUrl ? deriveWsUrl(existingRpcUrl) : null;

  const rpcUrl = rpcOption === 'in-cluster' ? inCluster.rpcUrl : existingRpcUrl;
  // Derivation wins: the manual field is only reachable while derivation
  // fails, and its stale value must not survive a switch to a derivable RPC.
  const wsUrl = rpcOption === 'in-cluster' ? inCluster.wsUrl : derivedWsUrl || existingWsUrl || '';

  return (
    <>
      <Step>
        <h3 className="text-xl font-bold mb-4">Prerequisites</h3>
        <p>
          A Kubernetes cluster with <code>kubectl</code> connected and <code>helm</code> v3 installed. Your L1's RPC
          endpoint must be reachable from inside the cluster — either the{' '}
          <a
            href={AVALANCHE_DEPLOY_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            avalanche-deploy
          </a>{' '}
          L1 charts running in the same cluster, or an external RPC URL.
        </p>
        <p className="mt-2">
          Not running your L1 on Kubernetes yet? Follow the{' '}
          <a
            href="/docs/tooling/avalanche-deploy/deploy-l1-kubernetes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Avalanche Deploy Kubernetes guide
          </a>{' '}
          first.
        </p>
      </Step>

      <Step>
        <h3 className="text-xl font-bold mb-4">Clone Avalanche Deploy</h3>
        <p>
          The Blockscout Helm chart lives in the avalanche-deploy repo. Unlike the Terraform path, a fresh clone works
          here — the chart only needs your kubectl context:
        </p>
        <DynamicCodeBlock lang="bash" code={`git clone ${AVALANCHE_DEPLOY_REPO} && cd avalanche-deploy/kubernetes`} />
      </Step>

      {ready && (
        <>
          <Step>
            <h3 className="text-xl font-bold mb-4">RPC Endpoint</h3>
            <p>Choose where Blockscout should index your L1 from:</p>
            <div className="space-y-4 mt-4">
              <RadioGroup
                items={[
                  {
                    value: 'in-cluster',
                    label: 'Use the avalanche-deploy in-cluster RPC (l1-rpc release)',
                    details: inCluster.rpcUrl,
                  },
                  {
                    value: 'existing',
                    label: 'Use an existing RPC URL',
                  },
                ]}
                value={rpcOption}
                onChange={(value) => setRpcOption(value as 'in-cluster' | 'existing')}
                className="space-y-4"
                idPrefix="k8s-"
              />
              {rpcOption === 'existing' && (
                <div className="ml-6 mt-4">
                  <RPCURLInput
                    value={existingRpcUrl}
                    onChange={setExistingRpcUrl}
                    helperText="Full RPC URL reachable from inside the cluster (e.g. https://your-node.com/ext/bc/blockchain-id/rpc)"
                    placeholder="https://your-node.com/ext/bc/blockchain-id/rpc"
                  />
                  {existingRpcUrl && !derivedWsUrl && (
                    <Input
                      label="WebSocket URL"
                      value={existingWsUrl}
                      onChange={setExistingWsUrl}
                      helperText="Couldn't derive the ws endpoint from the RPC URL — enter it explicitly, or leave empty to skip realtime updates"
                    />
                  )}
                </div>
              )}
            </div>
          </Step>

          {rpcUrl && (
            <Step>
              <h3 className="text-xl font-bold mb-4">Install the Blockscout Chart</h3>
              <p>Install (or upgrade) the chart with your L1's details:</p>
              <DynamicCodeBlock
                lang="bash"
                code={genHelmBlockscoutCommand({
                  blockchainId,
                  evmChainId,
                  chainName,
                  rpcUrl,
                  wsUrl: wsUrl || undefined,
                })}
              />
              <p className="text-sm mt-2">
                We render the full <code>helm</code> command instead of <code>make k8s-blockscout</code> on purpose: the
                make wrapper doesn't pass the RPC URL to the chart, which leaves the indexer unconfigured.
                {!wsUrl && ' Without a ws endpoint the explorer still works but won’t stream new blocks in realtime.'}
              </p>
            </Step>
          )}

          <Step>
            <h3 className="text-xl font-bold mb-4">Access Your Explorer</h3>
            <p>Port-forward both the frontend and the backend (the UI loads its data from the backend API):</p>
            <DynamicCodeBlock
              lang="bash"
              code={
                'kubectl port-forward svc/blockscout-frontend 3000:3000 &\nkubectl port-forward svc/blockscout-backend 4000:4000 &'
              }
            />
            <p className="text-sm mt-2">
              The chart pins the frontend's API host to the in-cluster service name <code>blockscout-backend</code>, so
              your browser needs to resolve it locally before the UI can load data:
            </p>
            <DynamicCodeBlock lang="bash" code={'echo "127.0.0.1 blockscout-backend" | sudo tee -a /etc/hosts'} />
            <p className="text-sm mt-2">
              Then visit <code>http://localhost:3000</code>.
            </p>
            <div className="mt-4">
              <Accordions type="single">
                <Accordion title="Expose publicly with Ingress + TLS">
                  <p>
                    The chart ships a standard Ingress. Enable it with your domains (an Ingress controller must be
                    installed in the cluster):
                  </p>
                  <DynamicCodeBlock
                    lang="bash"
                    code={genHelmIngressCommand('explorer.example.com', 'explorer-api.example.com')}
                  />
                  <p className="text-sm mt-2">
                    For HTTPS, add TLS secrets via <code>ingress.tls</code> (e.g. with cert-manager) — see{' '}
                    <code>kubernetes/helm/blockscout/values.yaml</code> in the repo for the full ingress options. Note
                    the chart currently pins the frontend's API host to the in-cluster backend service name, so browsers
                    reaching the UI through the ingress can't load data until that value points at your public API host
                    — override <code>NEXT_PUBLIC_API_HOST</code> (or patch the chart) as part of public exposure.
                  </p>
                </Accordion>
              </Accordions>
            </div>
          </Step>

          <Step>
            <h3 className="text-xl font-bold mb-4">Verify Indexing</h3>
            <p>Watch the backend logs to confirm blocks are being indexed:</p>
            <DynamicCodeBlock lang="bash" code="kubectl logs -f deploy/blockscout-backend" />
          </Step>
        </>
      )}
    </>
  );
}
