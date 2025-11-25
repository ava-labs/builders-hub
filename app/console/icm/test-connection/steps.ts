import { type StepDefinition } from "@/components/console/step-flow";
import DeployICMDemo from "@/components/toolbox/console/icm/test-connection/DeployICMDemo";
import SendICMMessage from "@/components/toolbox/console/icm/test-connection/SendICMMessage";

export const steps: StepDefinition[] = [
    {
      type: "single",
      key: "deploy-icm-demo",
      title: "Deploy ICM Demo",
      component: DeployICMDemo,
    },
    {
      type: "single",
      key: "send-icm-demo-message",
      title: "Send ICM Message",
      component: SendICMMessage,
    },
];
