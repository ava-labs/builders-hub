import type { Metadata } from "next";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import { Card, Cards } from "fumadocs-ui/components/card";
import defaultComponents from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import { academy } from "@/lib/source";
import { createMetadata } from "@/utils/metadata";
import IndexedDBComponent from "@/components/tracker";
import { Callout } from "fumadocs-ui/components/callout";
import Instructors from "@/components/content-design/instructor";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import COURSES from "@/content/courses";
import { Popup, PopupContent, PopupTrigger } from "fumadocs-twoslash/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { AutoTypeTable } from "@/components/content-design/type-table";
import { Heading } from "fumadocs-ui/components/heading";
import Quiz from "@/components/quizzes/quiz";
import YouTube from "@/components/content-design/youtube";
import Gallery from "@/components/content-design/gallery";
import {
  CodeBlock,
  type CodeBlockProps,
  Pre,
} from "fumadocs-ui/components/codeblock";
import Mermaid from "@/components/content-design/mermaid";
import { Feedback } from "@/components/ui/feedback";
import { SidebarActions } from "@/components/ui/sidebar-actions";
import posthog from "posthog-js";

import ToolboxMdxWrapper from "@/components/toolbox/academy/wrapper/ToolboxMdxWrapper";
import CrossChainTransfer from "@/components/toolbox/console/primary-network/CrossChainTransfer";
import AvalancheGoDocker from "@/components/toolbox/console/layer-1/AvalancheGoDockerL1";
import CreateChain from "@/components/toolbox/console/layer-1/create/CreateChain";
import ConvertSubnetToL1 from "@/components/toolbox/console/layer-1/create/ConvertSubnetToL1";
import GenesisBuilder from "@/components/toolbox/console/layer-1/create/GenesisBuilder";
import DeployExampleERC20 from "@/components/toolbox/console/ictt/setup/DeployExampleERC20";
import DeployTokenHome from "@/components/toolbox/console/ictt/setup/DeployTokenHome";
import DeployWrappedNative from "@/components/toolbox/console/ictt/setup/DeployWrappedNative";
import DeployERC20TokenRemote from "@/components/toolbox/console/ictt/setup/DeployERC20TokenRemote";
import RegisterWithHome from "@/components/toolbox/console/ictt/setup/RegisterWithHome";
import TestSend from "@/components/toolbox/console/ictt/token-transfer/TestSend";
import TeleporterRegistry from "@/components/toolbox/console/icm/setup/TeleporterRegistry";
import ICMRelayer from "@/components/toolbox/console/icm/setup/ICMRelayer";
import Faucet from "@/components/toolbox/console/primary-network/Faucet";
import CreateManagedTestnetNode from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/CreateManagedTestnetNode";

export const dynamicParams = true;

const toolboxComponents = {
  ToolboxMdxWrapper,
  CrossChainTransfer,
  GenesisBuilder,
  CreateChain,
  AvalancheGoDocker,
  CreateManagedTestnetNode,
  ConvertToL1: ConvertSubnetToL1,
  DeployExampleERC20,
  DeployTokenHome,
  DeployWrappedNative,
  DeployERC20TokenRemote,
  RegisterWithHome,
  TestSend,
  TeleporterRegistry,
  ICMRelayer,
  Faucet,
};

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = academy.getPage(params.slug);

  if (!page) notFound();

  const path = `content/academy${page.url.replace('/academy/', '/')}.mdx`;
  const editUrl = `https://github.com/ava-labs/builders-hub/edit/master/${path}`;
  const MDX = page.data.body;
  // Check both official courses and entrepreneur courses
  // page.slugs[1] contains the course slug (e.g., "avalanche-fundamentals", "foundations-web3-venture")
  const course = COURSES.official.find((c) => c.slug === page.slugs[1]) 
    || COURSES.avalancheEntrepreneur.find((c) => c.slug === page.slugs[1]);

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        style: "clerk",
        single: false,
        enabled: true,
        footer: (
          <>
            <SidebarActions
              editUrl={editUrl}
              title={page.data.title || "Untitled"}
              pagePath={`/academy/${params.slug?.join("/")}`}
              pageType="academy"
            />
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-y-4 text-sm text-muted-foreground">
                <div>Instructors:</div>
                <Instructors names={course?.instructors || []} />
              </div>
              <Link
                href="https://t.me/avalancheacademy"
                target="_blank"
                className={cn(
                  buttonVariants({ size: "lg", variant: "secondary" })
                )}
              >
                Join Telegram Course Chat
              </Link>
            </div>
          </>
        ),
      }}
    >
      <DocsTitle>{page.data.title || "Untitled"}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody className="text-fd-foreground/80">
        <IndexedDBComponent />
        <MDX
          components={{
            ...defaultComponents,
            ...toolboxComponents,
            h1: (props) => <Heading as="h1" {...props} />,
            h2: (props) => <Heading as="h2" {...props} />,
            h3: (props) => <Heading as="h3" {...props} />,
            h4: (props) => <Heading as="h4" {...props} />,
            h5: (props) => <Heading as="h5" {...props} />,
            h6: (props) => <Heading as="h6" {...props} />,
            Button,
            Cards,
            Card,
            Callout,
            Accordion,
            Accordions,
            AutoTypeTable,
            Gallery,
            Mermaid,
            Quiz,
            Popup,
            PopupContent,
            PopupTrigger,
            Step,
            Steps,
            Tab,
            Tabs,
            TypeTable,
            YouTube,
            pre: ({
              title,
              className,
              icon,
              allowCopy,
              ...props
            }: CodeBlockProps) => (
              <CodeBlock title={title} icon={icon} allowCopy={allowCopy}>
                <Pre
                  className={cn("max-h-[1200px]", className)}
                  {...(props as any)}
                />
              </CodeBlock>
            ),
          }}
        />
      </DocsBody>
      <Feedback
        path={path}
        title={page.data.title || "Untitled"}
        pagePath={`/academy/${page.slugs.join("/")}`}
        onRateAction={async (url, feedback) => {
          "use server";
          await posthog.capture("on_rate_document", feedback);
        }}
      />
    </DocsPage>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = academy.getPage(params.slug);

  if (!page) notFound();

  const description =
    page.data.description ??
    "Learn how to build on Avalanche blockchain with Academy";

  const imageParams = new URLSearchParams();
  imageParams.set("title", `${page.data.title} | Avalanche Builder Hub`);
  imageParams.set("description", description);

  const image = {
    alt: "Banner",
    url: `/api/og/academy/${params.slug[0]}?${imageParams.toString()}`,
    width: 1200,
    height: 630,
  };

  return createMetadata({
    title: page.data.title,
    description,
    openGraph: {
      url: `/academy/${page.slugs.join("/")}`,
      images: image,
    },
    twitter: {
      images: image,
    },
  });
}

export async function generateStaticParams() {
  return academy.getPages().map((page) => ({
    slug: page.slugs,
  }));
}
