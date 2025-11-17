'use client';

import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { NavbarDropdownInjector } from '@/components/navigation/navbar-dropdown-injector';
import { ForceMobileSidebar } from '@/components/navigation/force-mobile-sidebar';
import { DocsNavbarToggle } from '@/components/navigation/docs-navbar-toggle';
import { AcademyLayoutClient } from './layout.client';

type Tree = DocsLayoutProps['tree'];

interface AcademyDocsLayoutWrapperProps {
    children: ReactNode;
    defaultTree: Tree;
    avalancheTree: Tree;
    blockchainTree: Tree;
    entrepreneurTree: Tree;
}

export function AcademyDocsLayoutWrapper({
    children,
    defaultTree,
    avalancheTree,
    blockchainTree,
    entrepreneurTree,
}: AcademyDocsLayoutWrapperProps) {
    const pathname = usePathname();

    const activeTree = useMemo(() => {
        if (pathname.startsWith('/academy/entrepreneur')) {
            return entrepreneurTree ?? defaultTree;
        }
        if (pathname.startsWith('/academy/blockchain')) {
            return blockchainTree ?? defaultTree;
        }
        if (pathname === '/academy' || pathname.startsWith('/academy/avalanche-l1')) {
            return avalancheTree ?? defaultTree;
        }
        return defaultTree;
    }, [pathname, defaultTree, avalancheTree, blockchainTree, entrepreneurTree]);

    const academyOptions: DocsLayoutProps = useMemo(
        () => ({
            tree: activeTree,
            nav: {
                enabled: false,
            },
            sidebar: {
                collapsible: false,
            },
        }),
        [activeTree],
    );

    return (
        <>
            <NavbarDropdownInjector />
            <ForceMobileSidebar />
            <AcademyLayoutClient />
            <DocsNavbarToggle />
            <DocsLayout {...academyOptions}>
                <span
                    className="absolute inset-0 z-[-1] h-[64rem] max-h-screen overflow-hidden"
                    style={{
                        backgroundImage:
                            'radial-gradient(49.63% 57.02% at 58.99% -7.2%, hsl(var(--primary)/0.1) 39.4%, transparent 100%)',
                    }}
                >
                    <svg
                        width="790"
                        height="640"
                        viewBox="0 0 790 718"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="absolute -top-16 left-1/2 -translate-x-1/2 pl-48"
                    >
                        <mask
                            id="mask-dark"
                            style={{
                                maskType: 'alpha',
                            }}
                            maskUnits="userSpaceOnUse"
                            x="0"
                            y="-143"
                            width="936"
                            height="861"
                        >
                            <ellipse cx="468.373" cy="287.536" rx="467.627" ry="430.464" fill="url(#radial-dark)" />
                        </mask>
                        <g mask="url(#mask-dark)" className="fill-primary">
                            <path d="M506.419 281.855L446.417 297.931V359.885L506.419 343.71V281.855Z" fillOpacity="0.05" />
                            <path d="M384.768 188.752L324.766 204.828V266.781L384.768 250.606V188.752Z" fillOpacity="0.05" />
                            <path d="M263.625 347.002L203.623 363.078V425.031L263.625 408.856V347.002Z" fillOpacity="0.05" />
                            <path d="M385.089 440.096L325.087 456.172V518.125L385.089 501.95V440.096Z" fillOpacity="0.05" />
                            <path d="M627.756 123.527L567.754 139.603V201.557L627.756 185.382V123.527Z" fillOpacity="0.05" />
                            <path d="M445.32 46.918L385.318 62.994V124.947L445.32 108.772V46.918Z" fillOpacity="0.05" />
                            <path d="M749.192 279.59L689.19 295.666V357.619L749.192 341.444V279.59Z" fillOpacity="0.05" />
                            <path d="M627.905 437.912L567.903 453.988V515.941L627.905 499.766V437.912Z" fillOpacity="0.05" />
                            <path d="M202.491 175.656L142.489 191.732V253.685L202.491 237.511V175.656Z" fillOpacity="0.05" />
                            <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M446.54 -79.1784L949.537 -213.956L949.278 -214.922L446.54 -80.2137V-87.9997H445.54V-79.9457L385.832 -63.947V-87.9997H384.832V-63.679L325.124 -47.6803V-87.9997H324.124V-47.4124L264.416 -31.4137V-87.9997H263.416V-31.1457L203.708 -15.147L203.708 -87.9997H202.708L202.708 -14.8791L143 1.11966L143 -87.9997H142L142 1.3876L-80.8521 61.1006L-80.5932 62.0666L142 2.42287V64.2363L-65.1402 119.739L-64.8814 120.705L142 65.2715L142 127.085L-49.4278 178.378L-49.1689 179.344L142 128.12V189.936L-33.7155 237.019L-33.4566 237.985L142 190.971V252.787L-18.0025 295.659L-17.7437 296.625L142 253.822V315.635L-2.29068 354.298L-2.03186 355.264L142 316.671V378.484L13.4218 412.937L13.6806 413.903L142 379.519V441.335L29.1341 471.577L29.3929 472.543L142 442.37V504.184L44.8466 530.216L45.1054 531.182L142 505.219V567.032L60.5591 588.855L60.8179 589.82L142 568.068V629.881L76.2715 647.493L76.5303 648.459L142 630.917V692.732L91.9838 706.134L92.2426 707.1L142 693.767V698.42H143V693.499L202.708 677.501V698.42H203.708V677.233L263.416 661.234V698.42H264.416V660.966L324.124 644.967V698.42H325.124V644.699L384.832 628.701V690.514L107.696 764.773L107.954 765.738L384.832 691.549V698.42H385.832V691.281L445.54 675.283V698.42H446.54V675.015L506.248 659.016V698.42H507.248V658.748L566.956 642.749V698.42H567.956V642.481L627.664 626.483V688.298L123.409 823.413L123.667 824.379L627.664 689.334V698.42H628.664V689.066L688.372 673.067V698.42H689.372V672.799L749.08 656.8V698.42H750.08V656.532L809.788 640.534V698.42H810.788V640.266L870.496 624.267V698.42H871.496V623.999L931.204 608V698.42H932.204V607.732L1153.8 548.357L1153.54 547.391L932.204 606.697V544.881L1138.08 489.716L1137.83 488.75L932.204 543.846V482.033L1122.37 431.077L1122.11 430.111L932.204 480.997V419.182L1106.66 372.437L1106.4 371.471L932.204 418.147V356.333L1090.95 313.798L1090.69 312.832L932.204 355.298V293.484L1075.24 255.159L1074.98 254.193L932.204 292.449V230.636L1059.52 196.521L1059.26 195.555L932.204 229.6V167.785L1043.81 137.88L1043.55 136.914L932.204 166.75V104.936L1028.1 79.2413L1027.84 78.2754L932.204 103.901V42.0874L1012.39 20.6027L1012.13 19.6367L932.204 41.0522V-20.7634L996.674 -38.0379L996.415 -39.0039L932.204 -21.7987L932.204 -83.6142L980.961 -96.6786L980.702 -97.6445L932.204 -84.6495V-87.9997H931.204V-84.3815L871.496 -68.3828V-87.9997H870.496V-68.1149L810.788 -52.1161V-87.9997H809.788V-51.8482L750.08 -35.8495V-87.9997H749.08V-35.5815L689.372 -19.5828L689.372 -81.3963L965.249 -155.317L964.99 -156.283L689.372 -82.4316V-87.9997H688.372V-82.1637L628.664 -66.1649V-87.9997H627.664V-65.897L567.956 -49.8983V-87.9997H566.956V-49.6303L507.248 -33.6316V-87.9997H506.248V-33.3637L446.54 -17.365L446.54 -79.1784ZM445.54 -78.9104L385.832 -62.9117L385.832 -1.09831L445.54 -17.097L445.54 -78.9104Z"
                                fillOpacity="0.1"
                            />
                        </g>
                        <defs>
                            <radialGradient
                                id="radial-dark"
                                cx="0"
                                cy="0"
                                r="1"
                                gradientUnits="userSpaceOnUse"
                                gradientTransform="translate(468.373 287.536) rotate(90) scale(430.464 467.627)"
                            >
                                <stop stopColor="#D9D9D9" />
                                <stop offset="1" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                    </svg>
                </span>
                {children}
            </DocsLayout>
        </>
    );
}

