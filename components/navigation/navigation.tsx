import {
  IndentDecrease,
  Layers,
  MailIcon,
  MonitorCheck,
  Settings,
  SproutIcon,
  SquareGanttChart,
  TerminalIcon,
  Webhook,
  SquareIcon,
  ArrowLeftRight,
  Coins,
  SquareCode,
  SquareStackIcon,
  Triangle,
  ChevronDownIcon,
  Pyramid,
  HandCoins,
  Server,
  Code,
  TrendingUp,
  ScanFace,
  Telescope,
  LayoutTemplate,
  Building2,
  BookOpen,
  Podcast,
  Wallet,
} from "lucide-react";
import { RootToggle } from "fumadocs-ui/components/layout/root-toggle";

interface Option {
  title: string;
  description: string;
  icon: React.ReactNode;
  url: string;
}

interface DocsDropdownProps {
  buttonStyle?: "Docs" | "currentElement";
}

export function DocsDropdown({
  buttonStyle = "Docs",
}: DocsDropdownProps): React.ReactElement {
  const options: Option[] = [
    ...(buttonStyle === "Docs"
      ? [
          {
            title: "Docs",
            description: "",
            icon: <></>,
            url: "",
          },
        ]
      : []),
    {
      title: "Avalanche Protocol",
      description: "Learn about Avalanche",
      icon: <SproutIcon />,
      url: "/learn",
    },
    {
      title: "Smart Contracts",
      description: "Build Apps on Avalanche",
      icon: <SquareGanttChart />,
      url: "/dapps",
    },
    {
      title: "Avalanche L1s",
      description: "Build Your L1 Blockchain",
      icon: <Layers />,
      url: "/avalanche-l1s",
    },
    {
      title: "EVM Customization",
      description: "Customize the Ethereum VM",
      icon: <Pyramid />,
      url: "/evm-l1s",
    },
    {
      title: "Custom Virtual Machines",
      description: "Customize Your Execution Layer",
      icon: <IndentDecrease />,
      url: "/virtual-machines",
    },
    {
      title: "Nodes & Validators",
      description: "Participate in the Network",
      icon: <MonitorCheck />,
      url: "/nodes",
    },
    {
      title: "Interoperability",
      description: "ICM and ICM Contracts",
      icon: <MailIcon />,
      url: "/cross-chain",
    },
    {
      title: "Tooling",
      description: "CLI, Scripts, and More",
      icon: <Settings />,
      url: "/tooling",
    },
    {
      title: "API Docs",
      description: "Avalanche API References",
      icon: <Webhook />,
      url: "/api-reference",
    },
  ];

  return <RootToggle options={options} />;
}

export function AcademyDropdown() {
  const options: Option[] = [
    {
      title: "Courses",
      description: "",
      icon: <></>,
      url: "",
    },
    {
      title: "Blockchain Fundamentals",
      description: "Understand fundamental blockchain concepts.",
      icon: <SquareIcon className="w-5 h-5" />,
      url: "https://academy.avax.network/course/blockchain-fundamentals",
    },
    {
      title: "Avalanche Fundamentals",
      description: "Overview of Avalanche Consensus, L1s, and VMs.",
      icon: <Triangle className="w-5 h-5" />,
      url: "https://academy.avax.network/course/avalanche-fundamentals",
    },
    {
      title: "Interchain Messaging",
      description: "Build cross-chain dApps on Avalanche.",
      icon: <MailIcon className="w-5 h-5" />,
      url: "https://academy.avax.network/course/interchain-messaging",
    },
    {
      title: "Interchain Token Transfer",
      description: "Transfer assets between Avalanche blockchains.",
      icon: <ArrowLeftRight className="w-5 h-5" />,
      url: "https://academy.avax.network/course/interchain-token-transfer",
    },
    {
      title: "Customizing the EVM",
      description: "Add custom precompiles to the EVM.",
      icon: <SquareCode className="w-5 h-5" />,
      url: "https://academy.avax.network/course/customizing-evm",
    },
    {
      title: "Layer 1 Tokenomics",
      description: "Design tokenomics for your Avalanche L1.",
      icon: <Coins className="w-5 h-5" />,
      url: "https://academy.avax.network/course/l1-tokenomics",
    },
    {
      title: "AvaCloud APIs",
      description: "Use AvaCloud APIs to build web apps.",
      icon: <Webhook className="w-5 h-5" />,
      url: "https://academy.avax.network/course/avacloudapis",
    },
    {
      title: "HyperSDK",
      description: "Build high-performance blockchains with HyperSDK.",
      icon: <TerminalIcon className="w-5 h-5" />,
      url: "https://academy.avax.network/course/hypersdk",
    },
  ];
  return <RootToggle options={options} />;
}

export function GrantsDropdown() {
  const options: Option[] = [
    {
      title: "Grants & Programs",
      description: "",
      icon: <></>,
      url: "/grants",
    },
    {
      title: "Retro9000",
      description: "Build publicly and get rewarded.",
      icon: <HandCoins className="w-5 h-5" />,
      url: "https://www.avax.network/retro9000",
    },
    {
      title: "infraBUIDL()",
      description:
        "Infrastructure projects that enhance user and developer experience",
      icon: <Server className="w-5 h-5" />,
      url: "https://www.avax.network/infrabuidl-program",
    },
    {
      title: "Codebase",
      description:
        "Transforming ambitious builders into extraordinary founders",
      icon: <Code className="w-5 h-5" />,
      url: "https://codebase.avax.network/",
    },
    {
      title: "Blizzard Fund",
      description:
        "VC fund investing in innovative entrepreneurs driving growth on Avalanche",
      icon: <TrendingUp className="w-5 h-5" />,
      url: "https://www.blizzard.fund/",
    },
  ];
  return <RootToggle options={options} />;
}

export function IntegrationsDropdown() {
  const options: Option[] = [
    {
      title: "Integrations",
      description: "",
      icon: <></>,
      url: "/integrations",
    },
    {
      title: "Account Abstraction",
      description: "",
      icon: <ScanFace className="w-5 h-5" />,
      url: "/integrations#Account%20Abstraction",
    },
    {
      title: "Block Explorers",
      description: "",
      icon: <Telescope className="w-5 h-5" />,
      url: "/integrations#Block%20Explorers",
    },
    {
      title: "Blockchain as a Service",
      description: "",
      icon: <LayoutTemplate className="w-5 h-5" />,
      url: "/integrations#Blockchain%20as%20a%20Service",
    },
    {
      title: "Enterprise Solutions",
      description: "",
      icon: <Building2 className="w-5 h-5" />,
      url: "/integrations#Enterprise%20Solutions",
    },
    {
      title: "Indexers",
      description: "",
      icon: <BookOpen className="w-5 h-5" />,
      url: "/integrations#Indexers",
    },
    {
      title: "Oracles",
      description: "",
      icon: <Podcast className="w-5 h-5" />,
      url: "/integrations#Oracles",
    },
    {
      title: "Wallets",
      description: "",
      icon: <Wallet className="w-5 h-5" />,
      url: "/integrations#Wallet%20SDKs",
    },
  ];
  return <RootToggle options={options} />;
}

export function DropDownBar(): React.ReactElement {
  return (
    <div className="hidden sm:flex overflow-hidden items-center pl-4 space-x-3">
      <div className="shrink-0">
        <DocsDropdown />
      </div>
      <div className="shrink-0">
        <AcademyDropdown />
      </div>
      <div className="shrink-0">
        <GrantsDropdown />
      </div>
      <div className="shrink-0">
        <IntegrationsDropdown />
      </div>
    </div>
  );
}
