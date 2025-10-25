"use client";

import { useState, useEffect, useMemo } from "react";
import { Container } from "@/components/toolbox/components/Container";
import { Input } from "@/components/toolbox/components/Input";
import { getBlockchainInfo, getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import InputChainId from "@/components/toolbox/components/InputChainId";
import InputSubnetId from "@/components/toolbox/components/InputSubnetId";
import BlockchainDetailsDisplay from "@/components/toolbox/components/BlockchainDetailsDisplay";
import versions from '@/scripts/versions.json';
import { ProgressSteps as Steps, ProgressStep as Step } from "@/components/toolbox/components/ProgressSteps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { nodeConfigBase64 } from "./config";
import { useL1ByChainId } from "@/components/toolbox/stores/l1ListStore";
import { Success } from "@/components/toolbox/components/Success";
import { nipify, HostInput } from "@/components/toolbox/components/HostInput";
import { RadioGroup } from "@/components/toolbox/components/RadioGroup";
import { RPCURLInput } from "@/components/toolbox/components/RPCURLInput";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { DockerInstallation } from "@/components/toolbox/components/DockerInstallation";
import { NodeBootstrapCheck } from "@/components/toolbox/components/NodeBootstrapCheck";
import { Checkbox } from "@/components/toolbox/components/Checkbox";
import { Button } from "@/components/toolbox/components/Button";


const dockerComposePsOutput = `NAME          IMAGE                                 COMMAND                  SERVICE       CREATED        STATUS        PORTS
avago         avaplatform/subnet-evm_avalanchego:${versions['avaplatform/subnet-evm_avalanchego']}  "./avalanchego"          avago         1 minute ago   Up 1 minute   127.0.0.1:9650->9650/tcp, 0.0.0.0:9651->9651/tcp, :::9651->9651/tcp
backend       blockscout/blockscout:6.10.1                       "sh -c 'bin/blocksco…"   backend       1 minute ago   Up 1 minute   
bc_frontend   ghcr.io/blockscout/frontend:v1.37.4                "./entrypoint.sh nod…"   bc_frontend   1 minute ago   Up 1 minute   3000/tcp
caddy         caddy:latest                                       "caddy run --config …"   caddy         1 minute ago   Up 1 minute   0.0.0.0:80->80/tcp, :::80->80/tcp, 0.0.0.0:443->443/tcp, :::443->443/tcp, 443/udp, 2019/tcp
db            postgres:15                                        "docker-entrypoint.s…"   db            1 minute ago   Up 1 minute   0.0.0.0:7432->5432/tcp, :::7432->5432/tcp
redis-db      redis:alpine                                       "docker-entrypoint.s…"   redis-db      1 minute ago   Up 1 minute   6379/tcp`;

const dockerComposePsOutputNoAvago = `NAME          IMAGE                                 COMMAND                  SERVICE       CREATED        STATUS        PORTS
backend       blockscout/blockscout:6.10.1          "sh -c 'bin/blocksco…"   backend       1 minute ago   Up 1 minute   
bc_frontend   ghcr.io/blockscout/frontend:v1.37.4   "./entrypoint.sh nod…"   bc_frontend   1 minute ago   Up 1 minute   3000/tcp
caddy         caddy:latest                          "caddy run --config …"   caddy         1 minute ago   Up 1 minute   0.0.0.0:80->80/tcp, :::80->80/tcp, 0.0.0.0:443->443/tcp, :::443->443/tcp, 443/udp, 2019/tcp
db            postgres:15                           "docker-entrypoint.s…"   db            1 minute ago   Up 1 minute   0.0.0.0:7432->5432/tcp, :::7432->5432/tcp
redis-db      redis:alpine                          "docker-entrypoint.s…"   redis-db      1 minute ago   Up 1 minute   6379/tcp`;

const genCaddyfile = (domain: string,) => `
${nipify(domain)} {
    # Backend API routes
    handle /api* {
        reverse_proxy backend:4000
    }
    
    handle /socket* {
        reverse_proxy backend:4000
    }
    
    handle /sitemap.xml {
        reverse_proxy backend:4000
    }
    
    handle /auth* {
        reverse_proxy backend:4000
    }
    
    handle /metrics {
        reverse_proxy backend:4000
    }
    
    # Shared files with directory browsing
    handle /shared/* {
        root * /var
        file_server browse
    }
    
    # Frontend (default catch-all)
    handle {
        reverse_proxy bc_frontend:3000
    }
}
`

interface DockerComposeConfig {
  domain: string;
  subnetId: string;
  blockchainId: string;
  networkName: string;
  networkShortName: string;
  tokenName: string;
  tokenSymbol: string;
  rpcUrl: string;
  includeAvago: boolean;
  isTestnet: boolean;
}

const genDockerCompose = (config: DockerComposeConfig) => {
  const domain = nipify(config.domain);
  const composeConfig = `
services:
  redis-db:
    image: 'redis:alpine'
    container_name: redis-db
    command: redis-server
  db-init:
    image: postgres:15
    entrypoint:
      - sh
      - -c
      - |
        chown -R 2000:2000 /var/lib/postgresql/data
    volumes:
      - postgres_data:/var/lib/postgresql/data
  db:
    depends_on:
      db-init:
        condition: service_completed_successfully
    image: postgres:15
    shm_size: 256m
    restart: always
    container_name: 'db'
    command: postgres -c 'max_connections=200' -c 'client_connection_check_interval=60000'
    environment:
        POSTGRES_PASSWORD: ""
        POSTGRES_USER: "postgres"
        POSTGRES_HOST_AUTH_METHOD: "trust"
    ports:
      - target: 5432
        published: 7432
    volumes:
      - postgres_data:/var/lib/postgresql/data
  backend:
    depends_on:
      - db
      - redis-db
    image: blockscout/blockscout:6.10.1
    pull_policy: always
    restart: always
    stop_grace_period: 5m
    container_name: 'backend'
    command: sh -c 'bin/blockscout eval \"Elixir.Explorer.ReleaseTasks.create_and_migrate()\" && bin/blockscout start'
    environment:
      ETHEREUM_JSONRPC_VARIANT: geth
      ETHEREUM_JSONRPC_HTTP_URL: ${config.rpcUrl} 
      ETHEREUM_JSONRPC_TRACE_URL: ${config.rpcUrl} 
      DATABASE_URL: postgresql://postgres:ceWb1MeLBEeOIfk65gU8EjF8@db:5432/blockscout # TODO: default, please change
      SECRET_KEY_BASE: 56NtB48ear7+wMSf0IQuWDAAazhpb31qyc7GiyspBP2vh7t5zlCsF5QDv76chXeN # TODO: default, please change
      NETWORK: EVM 
      SUBNETWORK: MySubnet # TODO: what is this ?
      PORT: 4000 
      INDEXER_DISABLE_PENDING_TRANSACTIONS_FETCHER: false
      INDEXER_DISABLE_INTERNAL_TRANSACTIONS_FETCHER: false
      ECTO_USE_SSL: false
      DISABLE_EXCHANGE_RATES: true
      SUPPORTED_CHAINS: "[]"
      TXS_STATS_DAYS_TO_COMPILE_AT_INIT: 10
      MICROSERVICE_SC_VERIFIER_ENABLED: false
      MICROSERVICE_SC_VERIFIER_URL: http://sc-verifier:8050
      MICROSERVICE_SC_VERIFIER_TYPE: sc_verifier
      MICROSERVICE_VISUALIZE_SOL2UML_ENABLED: false
      MICROSERVICE_VISUALIZE_SOL2UML_URL: http://visualizer:8050
      MICROSERVICE_SIG_PROVIDER_ENABLED: false
      MICROSERVICE_SIG_PROVIDER_URL: http://sig-provider:8050
    links:
      - db:database
    # volumes:
    #   - /etc/blockscout/conf/custom/images:/app/apps/block_scout_web/assets/static/images
  bc_frontend:
    depends_on:
      - backend
      - caddy
    image: ghcr.io/blockscout/frontend:v1.37.4
    pull_policy: always
    platform: linux/amd64
    restart: always
    container_name: 'bc_frontend'
    environment:
      NEXT_PUBLIC_API_HOST: ${domain}
      NEXT_PUBLIC_API_PROTOCOL: https
      NEXT_PUBLIC_API_BASE_PATH: /
      FAVICON_MASTER_URL: https://ash.center/img/ash-logo.svg # TODO: change to dynamic ?
      NEXT_PUBLIC_NETWORK_NAME: ${config.networkName}
      NEXT_PUBLIC_NETWORK_SHORT_NAME: ${config.networkShortName}
      NEXT_PUBLIC_NETWORK_ID: 66666 # TODO: change to dynamic
      NEXT_PUBLIC_NETWORK_RPC_URL: ${config.includeAvago ? `https://${domain}/ext/bc/${config.blockchainId}/rpc` : config.rpcUrl}
      NEXT_PUBLIC_NETWORK_CURRENCY_NAME: ${config.tokenName}
      NEXT_PUBLIC_NETWORK_CURRENCY_SYMBOL: ${config.tokenSymbol}
      NEXT_PUBLIC_NETWORK_CURRENCY_DECIMALS: 18 
      NEXT_PUBLIC_APP_HOST: ${domain}
      NEXT_PUBLIC_APP_PROTOCOL: https
      NEXT_PUBLIC_HOMEPAGE_CHARTS: "['daily_txs']"
      NEXT_PUBLIC_IS_TESTNET: true
      NEXT_PUBLIC_API_WEBSOCKET_PROTOCOL: wss
      NEXT_PUBLIC_API_SPEC_URL: https://raw.githubusercontent.com/blockscout/blockscout-api-v2-swagger/main/swagger.yaml
      NEXT_PUBLIC_VISUALIZE_API_HOST: https://${domain}
      NEXT_PUBLIC_VISUALIZE_API_BASE_PATH: /visualizer-service
      NEXT_PUBLIC_STATS_API_HOST: ""
      NEXT_PUBLIC_STATS_API_BASE_PATH: /stats-service
  caddy:
    depends_on:
      - backend
    image: caddy:latest
    container_name: caddy
    restart: always
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    volumes:
      - "./Caddyfile:/etc/caddy/Caddyfile"
      - caddy_data:/data
      - caddy_config:/config
    ports:
      - "80:80"
      - "443:443"`;

  const avalancheGoService = config.includeAvago ? `
  avago:
    image: avaplatform/subnet-evm_avalanchego:${versions['avaplatform/subnet-evm_avalanchego']}
    container_name: avago
    restart: always
    ports:
      - "127.0.0.1:9650:9650"
      - "9651:9651"
    volumes:
      - ~/.avalanchego:/root/.avalanchego
    environment:
      AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK: "true"
      AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns"
      AVAGO_NETWORK_ID: ${config.isTestnet ? "fuji" : "mainnet"}
      AVAGO_HTTP_HOST: "0.0.0.0"
      AVAGO_TRACK_SUBNETS: "${config.subnetId}" 
      AVAGO_HTTP_ALLOWED_HOSTS: "*"
      AVAGO_CHAIN_CONFIG_CONTENT: "${nodeConfigBase64(config.blockchainId, true, false)}"
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"` : '';

  return `${composeConfig}${avalancheGoService}

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
`
}

export default function BlockScout() {
  const [chainId, setChainId] = useState("");
  const [subnetId, setSubnetId] = useState("");
  const [subnet, setSubnet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [domain, setDomain] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [networkShortName, setNetworkShortName] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
  const [composeYaml, setComposeYaml] = useState("");
  const [caddyfile, setCaddyfile] = useState("");
  const [explorerReady, setExplorerReady] = useState(false);
  const [rpcOption, setRpcOption] = useState<'local' | 'existing'>('local');
  const [existingRpcUrl, setExistingRpcUrl] = useState('');
  const [servicesChecked, setServicesChecked] = useState(false);
  const { isTestnet } = useWalletStore()


  const getL1Info = useL1ByChainId(chainId);

  useEffect(() => {
    setSubnetIdError(null);
    setSubnetId("");
    setSubnet(null);
    if (!chainId) return

    // Set defaults from L1 store if available
    const l1Info = getL1Info();
    if (l1Info) {
      setNetworkName(l1Info.name);
      setNetworkShortName(l1Info.name.split(" ")[0]); // First word as short name
      setTokenName(l1Info.coinName);
      setTokenSymbol(l1Info.coinName);
    }

    setIsLoading(true);
    getBlockchainInfo(chainId)
      .then(async (chainInfo) => {
        setSubnetId(chainInfo.subnetId);
        try {
          const subnetInfo = await getSubnetInfo(chainInfo.subnetId);
          setSubnet(subnetInfo);
        } catch (error) {
          setSubnetIdError((error as Error).message);
        }
      })
      .catch((error) => {
        setSubnetIdError((error as Error).message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [chainId]);

  useEffect(() => {
    let ready = !!domain && !!subnetId && !!networkName && !!networkShortName && !!tokenName && !!tokenSymbol && !subnetIdError

    // Additional validation for existing RPC option
    if (rpcOption === 'existing') {
      ready = ready && !!existingRpcUrl;
    }

    if (ready) {
      setCaddyfile(genCaddyfile(domain));
      const rpcUrl = rpcOption === 'existing'
        ? existingRpcUrl
        : `http://avago:9650/ext/bc/${chainId}/rpc`;

      setComposeYaml(genDockerCompose({
        domain,
        subnetId,
        blockchainId: chainId,
        networkName,
        networkShortName,
        tokenName,
        tokenSymbol,
        rpcUrl,
        includeAvago: rpcOption === 'local',
        isTestnet: isTestnet ?? false
      }));
    } else {
      setCaddyfile("");
      setComposeYaml("");
    }
  }, [domain, subnetId, chainId, networkName, networkShortName, tokenName, tokenSymbol, subnetIdError, rpcOption, existingRpcUrl]);

  // Calculate current step and completed steps
  const currentStep = useMemo(() => {
    if (explorerReady) return 11; // All done
    if (composeYaml && servicesChecked) return 11; // Ready to launch
    if (composeYaml) return 10; // On access step
    if (!!domain && !!subnetId && !!networkName && !!networkShortName && !!tokenName && !!tokenSymbol) return 9; // On start step
    if (!!networkName || !!networkShortName || !!tokenName || !!tokenSymbol) return 6; // On network details
    if (!!domain) return 5; // On domain step
    if (rpcOption) return 4; // On RPC setup
    if (subnetId) return 3; // On L1 selection
    return 1; // Starting
  }, [subnetId, rpcOption, domain, networkName, networkShortName, tokenName, tokenSymbol, composeYaml, servicesChecked, explorerReady]);

  const completedSteps = useMemo(() => {
    const completed: number[] = [];
    // Step 1 & 2 are informational, mark as complete when moving forward
    if (chainId || subnetId) {
      completed.push(1);
      completed.push(2);
    }
    if (subnetId) completed.push(3);
    if (rpcOption) completed.push(4);
    if (domain) completed.push(5);
    if (networkName && networkShortName && tokenName && tokenSymbol) completed.push(6);
    if (composeYaml) {
      completed.push(7); // Caddyfile
      completed.push(8); // Docker Compose
      completed.push(9); // Start
    }
    if (servicesChecked) completed.push(10);
    if (explorerReady) completed.push(11);
    return completed;
  }, [chainId, subnetId, rpcOption, domain, networkName, networkShortName, tokenName, tokenSymbol, composeYaml, servicesChecked, explorerReady]);

  return (
    <>
      <Container
        title="Self-hosted Explorer Setup"
        description="This will set up a self-hosted explorer with its own RPC Node leveraging Docker Compose."
        githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/layer-1/create/SelfHostedExplorer.tsx"
      >
        <Steps currentStep={currentStep} completedSteps={completedSteps}>
          <Step stepNumber={1}>
            <h3 className="text-xl font-bold mb-4">Set up Instance</h3>
            <p>Set up a linux server with any cloud provider, like AWS, GCP, Azure, or Digital Ocean. 4 vCPUs, 8GB RAM, 40GB storage is enough to get you started. Choose more storage if the Explorer is for a long-running testnet or mainnet L1.</p>
          </Step>
          <Step stepNumber={2}>
            <DockerInstallation />
          </Step>



          <Step stepNumber={3}>
            <h3 className="text-xl font-bold mb-4">Select L1</h3>
            <p>Enter the Avalanche Blockchain ID (not EVM chain ID) of the L1 you want to run a node for.</p>

            <InputChainId
              value={chainId}
              onChange={setChainId}
              error={subnetIdError}
              hidePrimaryNetwork={true}
            />

            <InputSubnetId
              value={subnetId}
              onChange={setSubnetId}
              readOnly={true}
            />

            {/* Show subnet details if available */}
            <BlockchainDetailsDisplay
              subnet={subnet}
              isLoading={isLoading}
            />
          </Step>

          {subnetId && (
            <>
              <Step stepNumber={4}>
                <h3 className="text-xl font-bold mb-4">RPC Node Setup</h3>
                <p>Choose how you want to set up the RPC node for your explorer. We don't recommend running the explorer on the same machine as a validator or public RPC.</p>

                <div className="space-y-4 mt-4">
                  <RadioGroup
                    items={[
                      {
                        value: 'local',
                        label: 'Spin up a new dedicated RPC node with the explorer'
                      },
                      {
                        value: 'existing',
                        label: 'Use Existing RPC URL'
                      }
                    ]}
                    value={rpcOption}
                    onChange={(value) => setRpcOption(value as 'local' | 'existing')}
                    className="space-y-4"
                  />

                  {rpcOption === 'existing' && (
                    <div className="ml-6 mt-4">
                      <RPCURLInput
                        value={existingRpcUrl}
                        onChange={setExistingRpcUrl}
                        helperText="Enter the full RPC URL (e.g. https://your-node.com/ext/bc/blockchain-id/rpc) or localhost:9650 for an existing local RPC"
                        placeholder="https://your-node.com/ext/bc/blockchain-id/rpc"
                      />
                    </div>
                  )}
                </div>
              </Step>

              <Step stepNumber={5}>
                <h3 className="text-xl font-bold mb-4">Domain</h3>
                <p>Enter your domain name or server's public IP address. For a free domain, use your server's public IP, we will automatically add .sslip.io for the generated files.</p>

                <p>You can use the following command to check your IP:</p>
                <DynamicCodeBlock lang="bash" code="curl checkip.amazonaws.com" />

                <p className="mt-4">Paste the IP of your node below:</p>

                <HostInput
                  label="Domain or IPv4 address for reverse proxy (optional)"
                  value={domain}
                  onChange={setDomain}
                />
              </Step>

              <Step stepNumber={6}>
                <h3 className="text-xl font-bold mb-4">Network Details</h3>
                <p>Configure your network's public display information. These will be shown in the block explorer.</p>

                <div className="space-y-4">
                  <Input
                    label="Network Name"
                    value={networkName}
                    onChange={setNetworkName}
                    helperText="Full name of your network (e.g. My Custom Subnet)"
                  />

                  <Input
                    label="Network Short Name"
                    value={networkShortName}
                    onChange={setNetworkShortName}
                    helperText="Short name or abbreviation (e.g. MCS)"
                  />

                  <Input
                    label="Token Name"
                    value={tokenName}
                    onChange={setTokenName}
                    helperText="Name of your native token (e.g. MyToken)"
                  />

                  <Input
                    label="Token Symbol"
                    value={tokenSymbol}
                    onChange={setTokenSymbol}
                    helperText="Symbol of your native token (e.g. MTK)"
                  />
                </div>
              </Step>
            </>)}

          {composeYaml && (<>
            <Step stepNumber={7}>
              <h3 className="text-xl font-bold mb-4">Caddyfile</h3>
              <p>Create and edit the Caddyfile using the following steps:</p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Open the file in a text editor:</h4>
                  <DynamicCodeBlock lang="bash" code="nano ~/Caddyfile" />
                  <p className="text-sm mt-1">This will create and open the file in the nano text editor. You can also use other editors like vim or your preferred text editor.</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Paste the following content into the file:</h4>
                  <DynamicCodeBlock lang="yaml" code={caddyfile} />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Save and exit (if using nano):</h4>
                  <p className="text-sm">Press <code>Ctrl + X</code>, then <code>Y</code>, then <code>Enter</code> to save and exit</p>
                </div>
              </div>
            </Step>
            <Step stepNumber={8}>
              <h3 className="text-xl font-bold mb-4">Docker Compose</h3>
              <p>Create and edit the compose.yml file using the following steps:</p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Open the file in a text editor:</h4>
                  <DynamicCodeBlock lang="bash" code="nano ~/compose.yml" />
                  <p className="text-sm mt-1">This will create and open the file in the nano text editor. You can also use other editors like vim or your preferred text editor.</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Paste the following content into the file:</h4>
                  <DynamicCodeBlock lang="yaml" code={composeYaml} />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Save and exit (if using nano):</h4>
                  <p className="text-sm">Press <code>Ctrl + X</code>, then <code>Y</code>, then <code>Enter</code> to save and exit</p>
                </div>
              </div>
            </Step>

            <Step stepNumber={9}>
              <h3 className="text-xl font-bold mb-4">Start Your Explorer</h3>
              <p>Navigate to the directory containing your <code>Caddyfile</code> and <code>compose.yml</code> files and run these commands:</p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Start the services (detached mode):</h4>
                  <DynamicCodeBlock lang="bash" code="docker compose up -d" />
                  <p className="text-sm mt-1">The <code>-d</code> flag runs containers in the background so you can close your terminal.</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Check if everything is running:</h4>
                  <DynamicCodeBlock lang="bash" code="docker compose ps" />
                  <p className="text-sm mt-1">You should see output similar to this:</p>
                  <DynamicCodeBlock lang="bash" code={rpcOption === 'local' ? dockerComposePsOutput : dockerComposePsOutputNoAvago} />
                  <p className="text-sm mt-1">All services should show "Up" in the STATUS column. If any service shows "Exit" or keeps restarting, check its logs.</p>
                </div>

                {rpcOption === 'local' && (
                  <div>
                    <h4 className="font-semibold mb-2">Monitor the AvalancheGo node sync progress:</h4>
                    <DynamicCodeBlock lang="bash" code="docker logs -f avago" />
                    <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <h5 className="font-semibold mb-2">⚠️ Important Note About Sync Time</h5>
                      <p>
                        The AvalancheGo node needs to sync with the network before the explorer can function properly. For testnet, this process typically takes 5-10 minutes, for mainnet, it takes 1-2 hours. You'll see progress updates in the logs showing the syncing progress with the p-chain (fetching blocks & executing blocks).
                      </p>
                    </div>

                    <p className="text-sm mt-4">
                      Press <code>Ctrl+C</code> to stop watching logs.
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">Stop everything and clean up:</h4>
                  <DynamicCodeBlock lang="bash" code="docker compose down -v" />
                  <p className="text-sm mt-4">The <code>-v</code> flag removes volumes (databases). <strong>Warning:</strong> This forces reindexing.</p>
                </div>

                <p>If containers keep restarting, check logs with <code>docker logs [service-name]</code>. Use <code>docker compose restart [service-name]</code> to restart individual services.
                </p>
              </div>
            </Step>

            <Step stepNumber={10}>
              <h3 className="text-xl font-bold mb-4">Access Your Explorer</h3>
              <p>Before launching your BlockScout explorer, please confirm the following:</p>

              {rpcOption === 'local' && (
                <NodeBootstrapCheck
                  chainId={chainId}
                  domain={domain || "127.0.0.1:9650"}
                />
              )}

              <div className="mt-6 space-y-4">
                <Checkbox
                  label="All services are UP when running docker compose ps"
                  checked={servicesChecked}
                  onChange={setServicesChecked}
                />

                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      if (servicesChecked && (rpcOption === 'existing' || rpcOption === 'local')) {
                        setExplorerReady(true);
                        window.open(`https://${nipify(domain)}`, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    disabled={!servicesChecked}
                    className="px-8 py-3 text-xl"
                  >
                    Launch Explorer
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <img
                  src="/images/blockscout-sample.png"
                  alt="Blockscout Sample Image"
                  className="rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-full"
                />
                <p className="text-sm mt-2 text-center">
                  Preview of your BlockScout Explorer interface
                </p>
              </div>
            </Step>

            {explorerReady && (
              <Success
                label="BlockScout Explorer Setup Completed"
                value="Your self-hosted BlockScout explorer is now running and accessible. You can use it to explore transactions, blocks, and accounts on your L1."
              />
            )}
          </>)}
        </Steps>
      </Container>
    </>
  );
};
