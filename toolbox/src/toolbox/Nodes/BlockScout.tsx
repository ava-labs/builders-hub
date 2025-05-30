"use client";

import { useState, useEffect, useMemo } from "react";
import { Container } from "../../components/Container";
import { Input } from "../../components/Input";
import { getBlockchainInfo } from "../../coreViem/utils/glacier";
import InputChainId from "../../components/InputChainId";

import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { dockerInstallInstructions, type OS } from "./AvalanchegoDocker";

const genCaddyfile = (domain: string) => `
${domain} {
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

const genDockerCompose = (domain: string) => `
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
    command: sh -c "bin/blockscout eval \"Elixir.Explorer.ReleaseTasks.create_and_migrate()\" && bin/blockscout start"
    environment:
      ETHEREUM_JSONRPC_VARIANT: geth
      ETHEREUM_JSONRPC_HTTP_URL: http://avago:9650/ext/bc/SUDoK9P89PCcguskyof41fZexw7U3zubDP2DZpGf3HbFWwJ4E/rpc # TODO: change to dynamic
      ETHEREUM_JSONRPC_TRACE_URL: http://avago:9650/ext/bc/SUDoK9P89PCcguskyof41fZexw7U3zubDP2DZpGf3HbFWwJ4E/rpc # TODO: change to dynamic
      DATABASE_URL: postgresql://postgres:ceWb1MeLBEeOIfk65gU8EjF8@db:5432/blockscout # TODO: what is this ?
      SECRET_KEY_BASE: 56NtB48ear7+wMSf0IQuWDAAazhpb31qyc7GiyspBP2vh7t5zlCsF5QDv76chXeN # TODO: what is this ?
      NETWORK: EVM 
      SUBNETWORK: MySubnet # TODO: what is this ?
      PORT: 4000 
      INDEXER_DISABLE_PENDING_TRANSACTIONS_FETCHER: false
      INDEXER_DISABLE_INTERNAL_TRANSACTIONS_FETCHER: false
      # LOGO: /app/apps/block_scout_web/assets/static/images/ash-logo-circle-30.svg # TODO: change to dynamic ?
      # FOOTER_LOGO: /app/apps/block_scout_web/assets/static/images/ash-logo-circle-30.svg # TODO: change to dynamic ?
      # FAVICON_MASTER_URL: /app/apps/block_scout_web/assets/static/images/ash-logo-circle-30.svg # TODO: change to dynamic ?
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
      # FAVICON_MASTER_URL: https://ash.center/img/ash-logo.svg # TODO: change to dynamic ?
      NEXT_PUBLIC_NETWORK_NAME: Ash Subnet # TODO: change to dynamic
      NEXT_PUBLIC_NETWORK_SHORT_NAME: Ash # TODO: change to dynamic
      NEXT_PUBLIC_NETWORK_ID: 66666 # TODO: change to dynamic
      NEXT_PUBLIC_NETWORK_RPC_URL: https://${domain}/ext/bc/SUDoK9P89PCcguskyof41fZexw7U3zubDP2DZpGf3HbFWwJ4E/rpc # TODO: change to dynamic
      NEXT_PUBLIC_NETWORK_CURRENCY_NAME: AshCoin # TODO: change to dynamic
      NEXT_PUBLIC_NETWORK_CURRENCY_SYMBOL: ASH # TODO: change to dynamic
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
      - target: 80
        published: 80
      - target: 443
        published: 443
  avago:
    image: containerman17/subnet-evm-plus:latest # TODO: use the official subnet-evm image
    container_name: avago
    restart: always
    ports: # TODO: reconsider ports
      - "9650:9650"
      - "9651:9651"
    volumes:
      - ~/.avalanchego:/root/.avalanchego
    environment:
      AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK: "true"
      AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns"
      AVAGO_HTTP_HOST: "0.0.0.0"
      AVAGO_TRACK_SUBNETS: "oerPWBbtbe13eWbo3AegYUrHuSETeTwyNy7szoHJJ1QQBL9nu,h7egyVb6fKHMDpVaEsTEcy7YaEnXrayxZS4A1AEU4pyBzmwGp" # TODO:
      AVAGO_HTTP_ALLOWED_HOSTS: "*"  # TODO: generate chain config
      AVAGO_CHAIN_CONFIG_CONTENT: "eyJTVURvSzlQODlQQ2NndXNreW9mNDFmWmV4dzdVM3p1YkRQMkRacEdmM0hiRld3SjRFIjp7IkNvbmZpZyI6ImV5SnNiMmN0YkdWMlpXd2lPaUprWldKMVp5SXNJbmRoY25BdFlYQnBMV1Z1WVdKc1pXUWlPblJ5ZFdVc0ltVjBhQzFoY0dseklqcGJJbVYwYUNJc0ltVjBhQzFtYVd4MFpYSWlMQ0p1WlhRaUxDSmhaRzFwYmlJc0luZGxZak1pTENKcGJuUmxjbTVoYkMxbGRHZ2lMQ0pwYm5SbGNtNWhiQzFpYkc5amEyTm9ZV2x1SWl3aWFXNTBaWEp1WVd3dGRISmhibk5oWTNScGIyNGlMQ0pwYm5SbGNtNWhiQzFrWldKMVp5SXNJbWx1ZEdWeWJtRnNMV0ZqWTI5MWJuUWlMQ0pwYm5SbGNtNWhiQzF3WlhKemIyNWhiQ0lzSW1SbFluVm5JaXdpWkdWaWRXY3RkSEpoWTJWeUlpd2laR1ZpZFdjdFptbHNaUzEwY21GalpYSWlMQ0prWldKMVp5MW9ZVzVrYkdWeUlsMTkiLCJVcGdyYWRlIjpudWxsfX0="
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

export default function BlockScout() {
    const [chainId, setChainId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [domain, setDomain] = useState("");
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [composeYaml, setComposeYaml] = useState("");
    const [caddyfile, setCaddyfile] = useState("");

    useEffect(() => {
        setSubnetIdError(null);
        setSubnetId("");
        if (!chainId) return

        getBlockchainInfo(chainId).then((chainInfo) => {
            setSubnetId(chainInfo.subnetId);
        }).catch((error) => {
            setSubnetIdError((error as Error).message);
        });
    }, [chainId]);

    const domainError = useMemo(() => {
        if (!domain) return null;
        // Updated regex to handle both traditional domains and IP-based domains like 1.2.3.4.sslip.io
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
        if (!domainRegex.test(domain)) return "Please enter a valid domain name (e.g. example.com or 1.2.3.4.sslip.io)";
        return null;
    }, [domain]);

    useEffect(() => {
        let ready = !!domain && !!subnetId && !domainError && !subnetIdError

        if (ready) {
            setCaddyfile(genCaddyfile(domain));
            setComposeYaml(genDockerCompose());
        } else {
            setCaddyfile("");
            setComposeYaml("");
        }
    }, [domain, subnetId, domainError, subnetIdError]);

    return (
        <>
            <Container
                title="Node Setup with Docker"
                description="This will start a Docker container running an RPC or validator node that tracks your L1."
            >
                <Steps>
                    <Step>
                        <h3 className="text-xl font-bold mb-4">Set up Instance</h3>
                        <p>Set up a linux server with any cloud provider, like AWS, GCP, Azure, or Digital Ocean. 4 vCPUs, 8GB RAM, 40GB storage is enough to get you started.</p>
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
                                <p>Enter your domain name or server's public IP address. For a free domain, use your server's public IP with .sslip.io (e.g. 1.2.3.4.sslip.io). Get your IP with 'curl checkip.amazonaws.com'.</p>
                                <Input
                                    label="Domain"
                                    value={domain}
                                    onChange={setDomain}
                                    error={domainError}
                                    helperText="Enter your domain name or IP address with .sslip.io (e.g. 1.2.3.4.sslip.io)"
                                />
                            </Step>
                        </>)}

                    {composeYaml && (<>
                        <Step>
                            <h3 className="text-xl font-bold mb-4">Caddyfile</h3>
                            <p>Put this in a file called <code>Caddyfile</code> in the working directory. <code>compose.yml</code> will be created in the same directory.</p>
                            <DynamicCodeBlock lang="yaml" code={caddyfile} />
                        </Step>
                        <Step>
                            <h3 className="text-xl font-bold mb-4">Docker Compose</h3>
                            <p>Put this in a file called <code>compose.yml</code> and run <code>docker compose up -d</code> to start the node.</p>
                            <DynamicCodeBlock lang="yaml" code={composeYaml} />
                        </Step>
                    </>)}


                </Steps>


            </Container >
        </>
    );
};
