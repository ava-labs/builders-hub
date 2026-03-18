import { dataApi, metricsApi, pChainApi, cChainApi, xChainApi } from '@/lib/openapi';
import { createAPIPage } from 'fumadocs-openapi/ui';
import dataApiClient from './data-api-page.client';
import metricsApiClient from './metrics-api-page.client';
import pchainApiClient from './pchain-api-page.client';
import cchainApiClient from './cchain-api-page.client';
import xchainApiClient from './xchain-api-page.client';

const DataAPIPageBase = createAPIPage(dataApi, {
  client: dataApiClient,
});

export function DataAPIPage(props: any) {
  return (
    <div className="data-api-playground">
      <DataAPIPageBase {...props} />
    </div>
  );
}

const MetricsAPIPageBase = createAPIPage(metricsApi, {
  client: metricsApiClient,
});

export function MetricsAPIPage(props: any) {
  return (
    <div className="metrics-api-playground">
      <MetricsAPIPageBase {...props} />
    </div>
  );
}

const PChainAPIPageBase = createAPIPage(pChainApi, {
  client: pchainApiClient,
});

export function PChainAPIPage(props: any) {
  return (
    <div className="pchain-api-playground">
      <PChainAPIPageBase {...props} />
    </div>
  );
}

const CChainAPIPageBase = createAPIPage(cChainApi, {
  client: cchainApiClient,
});

export function CChainAPIPage(props: any) {
  return (
    <div className="cchain-api-playground">
      <CChainAPIPageBase {...props} />
    </div>
  );
}

const XChainAPIPageBase = createAPIPage(xChainApi, {
  client: xchainApiClient,
});

export function XChainAPIPage(props: any) {
  return (
    <div className="xchain-api-playground">
      <XChainAPIPageBase {...props} />
    </div>
  );
}

