import type { Metadata } from "next";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import defaultComponents from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import { academy } from "@/lib/source";
import { createMetadata } from "@/utils/metadata";
import IndexedDBComponent from "@/components/tracker";
import Instructors from "@/components/content-design/instructor";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import COURSES from "@/content/courses";
import { sharedMDXComponents } from "@/components/mdx/shared-components";
import Quiz from "@/components/quizzes/quiz";
import {
  CodeBlock,
  type CodeBlockProps,
  Pre,
} from "fumadocs-ui/components/codeblock";
import { Feedback } from "@/components/ui/feedback";
import { SidebarActions } from "@/components/ui/sidebar-actions";
import posthog from "posthog-js";

import { getAuthSession } from "@/lib/auth/authSession";
import { hasTeam1AcademyAccess } from "@/lib/auth/roles";
import { AuthLoading } from "@/components/ui/auth-loading";
import { AccessDenied } from "@/components/ui/access-denied";
import { CourseOutlineProvider } from "@/components/academy/course/course-outline-context";
import { findCourseOutline, lessonPosition } from "@/lib/academy/course-outline";
import { LessonEyebrow } from "@/components/academy/lesson/lesson-eyebrow";
import { courseDiscipline } from "@/lib/academy/course-discipline";
import { CourseFacts, CourseHeader } from "@/components/academy/course/course-header";
import { CourseModules } from "@/components/academy/course/course-modules";
import { CourseCertificateCard } from "@/components/academy/course/course-certificate-card";
import { certificateAcademyFor } from "@/components/academy/certificate/certificate-artwork";
import { certificateCourseName } from "@/lib/academy/certificate-entry";

import ToolboxMdxWrapper from "@/components/toolbox/academy/wrapper/ToolboxMdxWrapper";
import CrossChainTransfer from "@/components/toolbox/console/primary-network/CrossChainTransfer";
import AvalancheGoDocker from "@/components/toolbox/console/layer-1/AvalancheGoDockerL1";
import CreateChain from "@/components/toolbox/console/layer-1/create/CreateChain";
import CreateSubnet from "@/components/toolbox/console/layer-1/create/CreateSubnet";
import ConvertSubnetToL1 from "@/components/toolbox/console/layer-1/create/ConvertSubnetToL1";
import GenesisBuilder from "@/components/toolbox/console/layer-1/create/GenesisBuilder";
import DeployExampleERC20 from "@/components/toolbox/console/ictt/setup/DeployExampleERC20";
import DeployTokenHome from "@/components/toolbox/console/ictt/setup/DeployTokenHome";
import DeployWrappedNative from "@/components/toolbox/console/ictt/setup/DeployWrappedNative";
import DeployERC20TokenRemote from "@/components/toolbox/console/ictt/setup/DeployERC20TokenRemote";
import DeployNativeTokenRemote from "@/components/toolbox/console/ictt/setup/DeployNativeTokenRemote";
import RegisterWithHome from "@/components/toolbox/console/ictt/setup/RegisterWithHome";
import AddCollateral from "@/components/toolbox/console/ictt/setup/AddCollateral";
import TestSend from "@/components/toolbox/console/ictt/token-transfer/TestSend";
import TeleporterRegistry from "@/components/toolbox/console/icm/setup/TeleporterRegistry";
import ICMRelayer from "@/components/toolbox/console/icm/setup/ICMRelayer";
import Faucet from "@/components/toolbox/console/primary-network/Faucet";
import CreateManagedTestnetNode from "@/components/toolbox/console/testnet-infra/managed-testnet-nodes/CreateManagedTestnetNode";
import CreateManagedTestnetRelayer from "@/components/toolbox/console/testnet-infra/managed-testnet-relayers/CreateManagedTestnetRelayer";
import DeployerAllowlist from "@/components/toolbox/console/l1-access-restrictions/DeployerAllowlist";
import TransactionAllowlist from "@/components/toolbox/console/l1-access-restrictions/TransactionAllowlist";
import DeployICMDemo from "@/components/toolbox/console/icm/test-connection/DeployICMDemo";

export const dynamicParams = true;

const toolboxComponents = {
  ToolboxMdxWrapper,
  CrossChainTransfer,
  GenesisBuilder,
  CreateChain,
  CreateSubnet,
  AvalancheGoDocker,
  CreateManagedTestnetNode,
  ConvertToL1: ConvertSubnetToL1,
  DeployExampleERC20,
  DeployTokenHome,
  DeployWrappedNative,
  DeployERC20TokenRemote,
  DeployNativeTokenRemote,
  RegisterWithHome,
  AddCollateral,
  TestSend,
  TeleporterRegistry,
  ICMRelayer,
  CreateManagedTestnetRelayer,
  Faucet,
  DeployerAllowlist,
  TransactionAllowlist,
  DeployICMDemo,
};

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;

  // Team1 Academy: defense-in-depth gating (proxy.ts already covers this).
  if (params.slug?.[0] === "team1") {
    const session = await getAuthSession();
    if (!session?.user?.id) return <AuthLoading />;
    if (!hasTeam1AcademyAccess(session.user.custom_attributes)) {
      return (
        <AccessDenied message="The Team1 Academy is only accessible to Team1 members and the DevRel team." />
      );
    }
  }

  const page = academy.getPage(params.slug);

  if (!page) notFound();

  // Use page.path which contains the actual file path relative to collection root
  // (e.g., "avalanche-l1/course/module/index.mdx" for an index file)
  // This correctly handles both regular .mdx files and index.mdx files
  const path = `content/academy/${page.path}`;
  const editUrl = `https://github.com/ava-labs/builders-hub/edit/master/${path}`;
  const MDX = page.data.body;
  // page.slugs[1] contains the course slug (e.g., "avalanche-fundamentals")
  const course = COURSES.official.find((c) => c.slug === page.slugs[1]);
  const outline = findCourseOutline(academy.pageTree, page.slugs[0], page.slugs[1]);
  const isOverview = page.slugs.length === 2;
  const isCertificatePage = outline?.certificateUrl === page.url;
  // The facts the MDX body's components read (CertificatePage), from the outline above; never recomputed.
  const courseFacts = outline
    ? { name: outline.name, modules: outline.modules.length, lessons: outline.lessons.length }
    : null;
  const position = outline && !isOverview && !isCertificatePage ? lessonPosition(outline, page.url) : null;
  const certificatePage = isOverview && outline?.certificateUrl
    ? academy.getPage(outline.certificateUrl.split("/").slice(2))
    : undefined;

  return (
    <DocsPage
      toc={page.data.toc}
      breadcrumb={{ enabled: false }}
      article={{ className: "pt-10" }}
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
      {isOverview && outline && (
        <CourseHeader discipline={courseDiscipline(outline.track, outline.slug)} />
      )}
      {outline && position && (
        <LessonEyebrow outline={outline} position={position} lessonTitle={page.data.title} />
      )}
      <DocsTitle>{page.data.title || "Untitled"}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      {isOverview && outline && <CourseFacts outline={outline} duration={course?.duration} />}
      <DocsBody className="text-fd-foreground/80">
        <IndexedDBComponent />
        <CourseOutlineProvider value={courseFacts}>
          <MDX
            components={{
              ...defaultComponents,
              ...toolboxComponents,
              ...sharedMDXComponents,
              Button,
              Quiz,
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
        </CourseOutlineProvider>
      </DocsBody>
      {isOverview && outline && <CourseModules outline={outline} />}
      {isOverview && outline?.certificateUrl && (
        <CourseCertificateCard
          academy={certificateAcademyFor(outline.track)}
          courseTitle={certificateCourseName(outline) ?? outline.name}
          href={outline.certificateUrl}
          label={certificatePage?.data.title ?? "Certificate"}
          afterModules={outline.modules.length > 0}
        />
      )}
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
    url: `/api/og/academy/${params.slug[0]}?${imageParams.toString()}&v=2`,
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
