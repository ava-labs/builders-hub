'use client';

import { stepFlowLayout } from '@/components/console/step-flow-route';
import DeployClientPage from './[step]/client-page';

// con-step-travel: the flow renders above its [step] route, so it stays mounted from step to step.
export default stepFlowLayout(DeployClientPage);
