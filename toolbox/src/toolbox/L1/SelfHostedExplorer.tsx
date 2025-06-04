"use client";

import { useState, useEffect, useMemo } from "react";
import { Container } from "../../components/Container";
import { Input } from "../../components/Input";
import { getBlockchainInfo } from "../../coreViem/utils/glacier";
import InputChainId from "../../components/InputChainId";
import versions from "../../versions.json";
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { dockerInstallInstructions, type OS, nodeConfigBase64 } from "../Nodes/AvalanchegoDocker";
import { useL1ByChainId } from "../../stores/l1ListStore";
import { Success } from "../../components/Success";
import { Button } from "../../components/Button";

const dockerComposeInstallInstructions: Record<string, string> = {
  'Ubuntu/Debian': `# Install Docker Compose v2 plugin
mkdir -p ~/.docker/cli-plugins && \\
curl -SL https://github.com/docker/compose/releases/download/v2.26.1/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose && \\
chmod +x ~/.docker/cli-plugins/docker-compose && \\

# Test Docker Compose installation
docker compose version
`,
  'Amazon Linux 2023+': `# Install Docker Compose v2 plugin
mkdir -p ~/.docker/cli-plugins && \\
curl -SL https://github.com/docker/compose/releases/download/v2.26.1/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose && \\
chmod +x ~/.docker/cli-plugins/docker-compose && \\

# Test Docker Compose installation
docker compose version
`,
  'Fedora': `# Install Docker Compose v2 plugin
mkdir -p ~/.docker/cli-plugins && \\
curl -SL https://github.com/docker/compose/releases/download/v2.26.1/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose && \\
chmod +x ~/.docker/cli-plugins/docker-compose && \\

# Test Docker Compose installation
docker compose version
`,
} as const;

const dockerComposePsOutput = `NAME          IMAGE                                 COMMAND                  SERVICE       CREATED        STATUS        PORTS
avago         avaplatform/subnet-evm:v0.7.3         "./avalanchego"          avago         1 minute ago   Up 1 minute   127.0.0.1:9650->9650/tcp, 0.0.0.0:9651->9651/tcp, :::9651->9651/tcp
backend       blockscout/blockscout:6.10.1          "sh -c 'bin/blocksco…"   backend       1 minute ago   Up 1 minute   
bc_frontend   ghcr.io/blockscout/frontend:v1.37.4   "./entrypoint.sh nod…"   bc_frontend   1 minute ago   Up 1 minute   3000/tcp
caddy         caddy:latest                          "caddy run --config …"   caddy         1 minute ago   Up 1 minute   0.0.0.0:80->80/tcp, :::80->80/tcp, 0.0.0.0:443->443/tcp, :::443->443/tcp, 443/udp, 2019/tcp
db            postgres:15                           "docker-entrypoint.s…"   db            1 minute ago   Up 1 minute   0.0.0.0:7432->5432/tcp, :::7432->5432/tcp
redis-db      redis:alpine                          "docker-entrypoint.s…"   redis-db      1 minute ago   Up 1 minute   6379/tcp`;

const genCaddyfile = (domain: string) => `
${domain.includes('.') ? domain : `${domain}.sslip.io`} {
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
    
    # Avago blockchain proxy
    handle /ext/bc/* {
        reverse_proxy avago:9650
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
}

const genDockerCompose = (config: DockerComposeConfig) => {
  const domain = config.domain.includes('.') ? config.domain : `${config.domain}.sslip.io`;
  return `
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
      ETHEREUM_JSONRPC_HTTP_URL: http://avago:9650/ext/bc/${config.blockchainId}/rpc 
      ETHEREUM_JSONRPC_TRACE_URL: http://avago:9650/ext/bc/${config.blockchainId}/rpc 
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
      NEXT_PUBLIC_NETWORK_RPC_URL: https://${domain}/ext/bc/${config.blockchainId}/rpc
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
      - "443:443"
  avago:
    image: avaplatform/subnet-evm:${versions['avaplatform/subnet-evm']}
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
      AVAGO_HTTP_HOST: "0.0.0.0"
      AVAGO_TRACK_SUBNETS: "${config.subnetId}" 
      AVAGO_HTTP_ALLOWED_HOSTS: "*"
      AVAGO_CHAIN_CONFIG_CONTENT: "${nodeConfigBase64(config.blockchainId, true, false)}"
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
`
}

export default function BlockScout() {
  const [chainId, setChainId] = useState("");
  const [subnetId, setSubnetId] = useState("");
  const [domain, setDomain] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [networkShortName, setNetworkShortName] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
  const [composeYaml, setComposeYaml] = useState("");
  const [caddyfile, setCaddyfile] = useState("");
  const [explorerReady, setExplorerReady] = useState(false);
  const [servicesUpChecked, setServicesUpChecked] = useState(false);
  const [bootstrappedChecked, setBootstrappedChecked] = useState(false);

  const getL1Info = useL1ByChainId(chainId);

  useEffect(() => {
    setSubnetIdError(null);
    setSubnetId("");
    if (!chainId) return

    // Set defaults from L1 store if available
    const l1Info = getL1Info();
    if (l1Info) {
      setNetworkName(l1Info.name);
      setNetworkShortName(l1Info.name.split(" ")[0]); // First word as short name
      setTokenName(l1Info.coinName);
      setTokenSymbol(l1Info.coinName);
    }

    getBlockchainInfo(chainId).then((chainInfo) => {
      setSubnetId(chainInfo.subnetId);
    }).catch((error) => {
      setSubnetIdError((error as Error).message);
    });
  }, [chainId]);

  const domainError = useMemo(() => {
    if (!domain) return null;

    // Check if it's a valid IP address
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(domain)) return null;

    // Check if it's a valid domain name
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) return "Please enter a valid domain name (e.g. example.com) or IP address (e.g. 1.2.3.4)";
    return null;
  }, [domain]);

  useEffect(() => {
    let ready = !!domain && !!subnetId && !!networkName && !!networkShortName && !!tokenName && !!tokenSymbol && !domainError && !subnetIdError

    if (ready) {
      setCaddyfile(genCaddyfile(domain));
      setComposeYaml(genDockerCompose({
        domain,
        subnetId,
        blockchainId: chainId,
        networkName,
        networkShortName,
        tokenName,
        tokenSymbol
      }));
    } else {
      setCaddyfile("");
      setComposeYaml("");
    }
  }, [domain, subnetId, chainId, networkName, networkShortName, tokenName, tokenSymbol, domainError, subnetIdError]);

  return (
    <>
      <Container
        title="Self-hosted Explorer Setup"
        description="This will set up a self-hosted explorer with its own RPC Node leveraging Docker Compose."
      >
        <Steps>
          <Step>
            <h3 className="text-xl font-bold mb-4">Set up Instance</h3>
            <p>Set up a linux server with any cloud provider, like AWS, GCP, Azure, or Digital Ocean. 4 vCPUs, 8GB RAM, 40GB storage is enough to get you started. Choose more storage if the Explorer is for a long-running testnet or mainnet L1.</p>
          </Step>
          <Step>
            <h3 className="text-xl font-bold mb-4">Docker Installation</h3>
            <p>Make sure you have Docker installed on your system. You can use the following commands to install it:</p>

            <Tabs items={Object.keys(dockerInstallInstructions)}>
              {Object.keys(dockerInstallInstructions).map((os) => (
                <Tab
                  key={os}
                  value={os as OS}
                >
                  <DynamicCodeBlock lang="bash" code={dockerInstallInstructions[os]} />
                </Tab>
              ))}
            </Tabs>
          </Step>

          <Step>
            <h3 className="text-xl font-bold mb-4">Docker Compose Installation</h3>
            <p>Now that Docker is installed, let's install Docker Compose. Select your operating system:</p>

            <Tabs items={Object.keys(dockerComposeInstallInstructions)}>
              {Object.keys(dockerComposeInstallInstructions).map((os) => (
                <Tab
                  key={os}
                  value={os as OS}
                >
                  <DynamicCodeBlock lang="bash" code={dockerComposeInstallInstructions[os]} />
                </Tab>
              ))}
            </Tabs>
          </Step>

          <Step>
            <h3 className="text-xl font-bold mb-4">Select L1</h3>
            <p>Enter the Avalanche Blockchain ID (not EVM chain ID) of the L1 you want to run a node for.</p>

            <InputChainId
              value={chainId}
              onChange={setChainId}
              hidePrimaryNetwork={true}
            />

            <Input
              label="Subnet ID"
              value={subnetId}
              disabled={true}
              error={subnetIdError}
            />
          </Step>

          {subnetId && (
            <>
              <Step>
                <h3 className="text-xl font-bold mb-4">Domain</h3>
                <p>Enter your domain name or server's public IP address. For a free domain, use your server's public IP, we will automatically add .sslip.io for the generated files.</p>

                <p>You can use the following command to check your IP:</p>
                <DynamicCodeBlock lang="bash" code="curl checkip.amazonaws.com" />

                <p className="mt-4">Paste the IP of your node below:</p>

                <Input
                  label="Domain or IPv4 address for reverse proxy (optional)"
                  value={domain}
                  onChange={(newValue) => setDomain(newValue.trim())}
                  error={domainError}
                  helperText="Enter your domain name or IP address (e.g. example.com or 1.2.3.4)"
                />
              </Step>

              <Step>
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
            <Step>
              <h3 className="text-xl font-bold mb-4">Caddyfile</h3>
              <p>Create and edit the Caddyfile using the following steps:</p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Create the file:</h4>
                  <DynamicCodeBlock lang="bash" code="touch ~/Caddyfile" />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Open the file in a text editor:</h4>
                  <DynamicCodeBlock lang="bash" code="nano ~/Caddyfile" />
                  <p className="text-sm text-gray-600 mt-1">This will open the nano text editor. You can also use other editors like vim or your preferred text editor.</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Paste the following content into the file:</h4>
                  <DynamicCodeBlock lang="yaml" code={caddyfile} />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">4. Save and exit (if using nano):</h4>
                  <p className="text-sm text-gray-600">Press <code>Ctrl + O</code>, then <code>Enter</code> to save</p>
                  <p className="text-sm text-gray-600">Press <code>Ctrl + X</code> to exit</p>
                </div>
              </div>
            </Step>
            <Step>
              <h3 className="text-xl font-bold mb-4">Docker Compose</h3>
              <p>Create and edit the compose.yml file using the following steps:</p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Create the file:</h4>
                  <DynamicCodeBlock lang="bash" code="touch ~/compose.yml" />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Open the file in a text editor:</h4>
                  <DynamicCodeBlock lang="bash" code="nano ~/compose.yml" />
                  <p className="text-sm text-gray-600 mt-1">This will open the nano text editor. You can also use other editors like vim or your preferred text editor.</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Paste the following content into the file:</h4>
                  <DynamicCodeBlock lang="yaml" code={composeYaml} />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">4. Save and exit (if using nano):</h4>
                  <p className="text-sm text-gray-600">Press <code>Ctrl + O</code>, then <code>Enter</code> to save</p>
                  <p className="text-sm text-gray-600">Press <code>Ctrl + X</code> to exit</p>
                </div>
              </div>
            </Step>

            <Step>
              <h3 className="text-xl font-bold mb-4">Start Your Explorer</h3>
              <p>Navigate to the directory containing your <code>Caddyfile</code> and <code>compose.yml</code> files and run these commands:</p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Start the services (detached mode):</h4>
                  <DynamicCodeBlock lang="bash" code="docker compose up -d" />
                  <p className="text-sm text-gray-600 mt-1">The <code>-d</code> flag runs containers in the background so you can close your terminal.</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Check if everything is running:</h4>
                  <DynamicCodeBlock lang="bash" code="docker compose ps" />
                  <p className="text-sm text-gray-600 mt-1">You should see output similar to this:</p>
                  <DynamicCodeBlock lang="bash" code={dockerComposePsOutput} />
                  <p className="text-sm text-gray-600 mt-1">All services should show "Up" in the STATUS column. If any service shows "Exit" or keeps restarting, check its logs.</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Monitor the AvalancheGo node sync progress:</h4>
                  <DynamicCodeBlock lang="bash" code="docker logs -f avago" />
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <h5 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">⚠️ Important Note About Sync Time</h5>
                    <p className="text-amber-700 dark:text-amber-300">
                      The AvalancheGo node needs to sync with the network before the explorer can function properly. For testnet, this process typically takes more than an hour. You'll see progress updates in the logs showing the bootstrapping process.
                    </p>
                  </div>

                  <p className="text-sm text-gray-600 mt-4">
                    Press <code>Ctrl+C</code> to stop watching logs.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Stop everything and clean up:</h4>
                  <DynamicCodeBlock lang="bash" code="docker compose down -v" />
                  <p className="text-sm text-gray-600 mt-4">The <code>-v</code> flag removes volumes (databases). <strong>Warning:</strong> This forces reindexing.</p>
                </div>

                <p>If containers keep restarting, check logs with <code>docker logs [service-name]</code>. Use <code>docker compose restart [service-name]</code> to restart individual services.
                </p>
              </div>
            </Step>

            <Step>
              <div className="space-y-6">
                <h3 className="text-xl font-bold mb-4">Access Your Explorer</h3>
                <p>Before launching your BlockScout explorer, please confirm the following:</p>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={servicesUpChecked}
                      onChange={e => setServicesUpChecked(e.target.checked)}
                      className="accent-blue-600 w-5 h-5"
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      All services are <span className="font-bold">UP</span> when running <code>docker compose ps</code>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bootstrappedChecked}
                      onChange={e => setBootstrappedChecked(e.target.checked)}
                      className="accent-blue-600 w-5 h-5 mt-1"
                    />
                    <span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        AvalancheGo node is fully bootstrapped
                      </span>
                      <div className="space-y-4 text-gray-700 dark:text-gray-300 mt-4">
                        <p>
                          During the bootstrapping process, the following command will return a <b>404 page not found</b> error:
                        </p>

                        <DynamicCodeBlock lang="bash" code={`curl -X POST --data '{ \n  \"jsonrpc\":\"2.0\", \"method\":\"eth_chainId\", \"params\":[], \"id\":1 \n}' -H 'content-type:application/json;' \\\nhttp://127.0.0.1:9650/ext/bc/${chainId}/rpc`} />

                        <p>
                          Once bootstrapping is complete, it will return a response like <code>{'{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":\"...\"}'}</code>.
                        </p>
                      </div>
                    </span>
                  </label>
                  <div className="flex justify-center">
                    <a
                      href={`https://${domain || "your-domain.com"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`
                        group relative inline-flex items-center justify-center
                        px-12 py-8 w-1/3
                        bg-gradient-to-r from-orange-400 to-red-500 
                        hover:from-orange-500 hover:to-red-600 
                        text-white font-bold text-3xl rounded-xl 
                        shadow-lg hover:shadow-xl 
                        transform hover:scale-105 
                        transition-all duration-200 ease-out 
                        no-underline
                        ${!(servicesUpChecked && bootstrappedChecked) ? 'opacity-50 pointer-events-none' : ''}
                      `}
                      style={{ textDecoration: 'none' }}
                      onClick={(e) => {
                        if (!servicesUpChecked || !bootstrappedChecked) {
                          e.preventDefault();
                          return;
                        }
                        setExplorerReady(true);
                      }}
                    >
                      <span className="relative z-10">Launch Explorer</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-300 to-red-400 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                    </a>
                  </div>
                  <div className="mt-6">
                    <img
                      src="/images/blockscout-sample.png"
                      alt="Blockscout Sample Image"
                      className="rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-full"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                      Preview of your BlockScout Explorer interface
                    </p>
                  </div>
                </div>
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
