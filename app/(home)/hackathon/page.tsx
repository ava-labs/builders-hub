"use client"
import React, { useState, ReactNode } from "react";
import Link from 'next/link';
import { ArrowUpRight, Code, Link as Zap, X, Book, Users, SquareTerminal, Box, Network } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

const Card = ({ children, className = "", onClick = () => {} }: { children: ReactNode; className?: string; onClick?: () => void }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`} onClick={onClick}>
    {children}
  </div>
);

const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-block px-2 py-1 text-sm font-semibold rounded-full ${className}`}>
    {children}
  </span>
);

interface Resource {
  name: string;
  url: string;
}

interface Track {
  id: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Open';
  color: string;
  icon: React.ReactNode;
  challengeDetails?: string[];
  technologies?: { [key: string]: string | { description: string; skills?: string } };
  examples?: string[];
  resources?: Resource[];
}

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; track: Track }> = ({ isOpen, onClose, track }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 flex justify-between items-center p-6 border-b dark:border-gray-700">
          <div className="flex items-center">
            {track.icon}
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 ml-3">{track.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">{track.description}</p>
          
          {track.challengeDetails && track.challengeDetails.length > 0 && (
            <Section title="Challenge Details">
              <ul className="list-disc pl-5 space-y-2">
                {track.challengeDetails.map((detail, index) => (
                  <li key={index} className="text-gray-600 dark:text-gray-400">{detail}</li>
                ))}
              </ul>
            </Section>
          )}
          
          {track.technologies && Object.keys(track.technologies).length > 0 && (
            <Section title="Technologies">
              {Object.entries(track.technologies).map(([name, details], index) => (
                <div key={index} className="mb-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200">{name}</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {typeof details === 'string' ? details : details.description}
                  </p>
                  {typeof details !== 'string' && details.skills && (
                    <p className="text-sm text-gray-500 mt-1">Skills required: {details.skills}</p>
                  )}
                </div>
              ))}
            </Section>
          )}
          
          {track.examples && track.examples.length > 0 && (
            <Section title="Examples">
              <ul className="list-disc pl-5 space-y-2">
                {track.examples.map((example, index) => (
                  <li key={index} className="text-gray-600 dark:text-gray-400">{example}</li>
                ))}
              </ul>
            </Section>
          )}
          
          {track.resources && track.resources.length > 0 && (
            <Section title="Recommended Resources">
              <ul className="list-disc pl-5 space-y-2">
                {track.resources.map((resource, index) => (
                  <li key={index}>
                    <Link 
                      href={resource.url} 
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {resource.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-700">{title}</h3>
    {children}
  </div>
);

const TrackCard: React.FC<{ track: Track }> = ({ track }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const badgeColors = {
    'Beginner': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
    'Intermediate': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    'Advanced': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
    'Open': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100'
  };

  return (
    <>
      <div 
        className={`group bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden h-full flex flex-col relative cursor-pointer transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-102 border-l-4 ${track.color}`}
        onClick={() => setIsModalOpen(true)}
      >
        <div className="absolute top-3 right-3 text-gray-400 transition-all duration-300 ease-in-out group-hover:text-blue-600">
          <ArrowUpRight size={28} className="transform transition-transform duration-300 ease-in-out group-hover:translate-x-1 group-hover:-translate-y-1"/>
        </div>
        <div className="p-6 grow">
          <div className="flex items-center mb-4">
            <div className={`p-2 rounded-full ${track.color} bg-opacity-20 mr-3`}>
              {track.icon}
            </div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{track.title}</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-4">{track.description}</p>
          <Badge className={`mb-2 ${badgeColors[track.difficulty]}`}>
            {track.difficulty}
          </Badge>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} track={track} />
    </>
  );
};

export default function HackathonPage() {
  const tracks: Track[] = [
    {
      id: 'nodes-network',
      title: 'Nodes and Network',
      description: "Develop solutions for staking management contracts, on-chain governance, membership platforms, and validator node group management.",
      difficulty: 'Advanced',
      color: 'border-red-500 text-red-700',
      icon: <Box size={24} className="text-red-500" />,
      examples: [
        'Build staking management smart contracts for validator nodes.',
        'Create on-chain governance frameworks to manage decentralized networks.',
        'Develop platforms to manage memberships and validator node groups.'
      ],
      resources: [
        { name: 'Avalanche Validator Guide', url: 'https://build.avax.network/docs/nodes' },
        { name: 'Governance Models', url: 'https://github.com/ava-labs/icm-contracts/tree/main/contracts/governance' }
      ]
    },
    {
      id: 'virtual-machines',
      title: 'Virtual Machines',
      description: "Customize the execution layer of your blockchain by enhancing the EVM or creating dedicated virtual machines for specific functionalities, optimizing resource usage, and increasing TPS.",
      difficulty: 'Advanced',
      color: 'border-blue-500 text-blue-700',
      icon: <SquareTerminal size={24} className="text-blue-500" />,
      examples: [
        'Add custom functionality to the EVM for specialized use cases.',
        'Develop dedicated virtual machines for optimized transaction processing.',
        'Utilize modular frameworks to modify transaction logic.'
      ],
      resources: [
        { name: 'Customize the EVM:', url: 'https://academy.avax.network/course/customizing-evm' },
        { name: 'Custom VM with HyperSDK:', url: 'https://github.com/ava-labs/hypersdk' }
      ]
    },
    {
      id: 'cross-chain-dapps',
      title: 'Cross-Chain Decentralized Applications (dApps)',
      description: "Develop cross-chain decentralized applications on your own customizable L1 that seamlessly interacts with multiple blockchain networks using ICM and ICTT.",
      difficulty: 'Intermediate',
      color: 'border-green-500 text-green-700',
      icon: <Zap size={24} className="text-green-500" />,
      examples: [
        'Create DeFi, SocialFi, or Gaming dApps that operate across multiple Avalanche L1s and other blockchains.',
        'Develop applications utilizing staking, governance, or NFTs with cross-chain functionality.',
        'Integrate seamless user experiences with multi-network infrastructures.'
      ],
      resources: [
        { name: 'InterChain Messaging', url: 'https://academy.avax.network/course/interchain-messaging' },
        { name: 'InterChain Token Transfer', url: 'https://academy.avax.network/course/interchain-token-transfer' },
        { name: 'Cross-Chain Communication', url: 'https://build.avax.network/docs/build/avalanchego/cross-chain' }
      ]
    },
    {
      id: 'tooling',
      title: 'Developer Tooling',
      description: "Leverage Avalanche's technology by creating developer tools that simplify building and deploying applications on Avalanche.",
      difficulty: 'Intermediate',
      color: 'border-purple-500 text-purple-700',
      icon: <Code size={24} className="text-purple-500" />,
      examples: [
        'Develop SDKs or APIs to improve developer experience.',
          'Build tools for smart contract deployment and testing.',
        'Create dashboards for network monitoring and analytics.'
      ],
      resources: [
        { name: 'Avalanche SDK', url: 'https://github.com/ava-labs/avalanchejs' },
        { name: 'Developer Tools', url: 'https://build.avax.network/docs/tools' }
        ]
    },
    {
      id: 'ai-agents-avalanche',
      title: 'AI Agents for Avalanche',
      description: "Develop intelligent AI agents that interact with the Avalanche blockchain to automate tasks, analyze data, and enhance user experiences within decentralized ecosystems.",
      difficulty: 'Advanced',
      color: 'border-red-500 text-red-700',
      icon: <Network size={24} className="text-red-500" />,
      examples: [
        'Create an agent that monitors Avalanche smart contracts and alerts users to significant events.',
        'Build an AI agent that analyzes transaction data for trends and insights.',
        'Develop agents that assist with wallet management and automate staking or bridging processes.'
      ],
      resources: [
        { name: 'AvalancheJS', url: 'https://github.com/ava-labs/avalanchejs' },
        { name: 'Avalanche Developer Documentation', url: 'https://build.avax.network/docs/' }
      ]
    },
  ];

  return (
    <main className="container relative py-6">
      <div className="py-12 sm:py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto w-full lg:mx-0">
          <img src="/hackathon-images/AvalancheSummit_London_HackathonLogo_Blue.png" alt="Summit London Logo" className="mx-auto h-32 w-auto" />
         <p className="mt-12 text-center text-lg leading-8 text-muted-foreground">
            At Avalanche, we believe in the power of technology to transform industries and solve real-world problems.
            This hackathon aims to harness the potential of Avalanche's robust technology stack to address pressing issues and create scalable, practical solutions. 
          </p>
          <div className="mt-8 text-center">
            <p className="text-lg font-semibold">Date: May 23-25, 2025</p>
            <p className="text-lg font-semibold">
              Location: <a href="https://www.google.com/maps/search/?api=1&query=Second%20Home%20Spitalfields&query_place_id=ChIJrWaBB7YcdkgRw6Fv--wBXIU" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Second Home Spitalfields
              London, England 🇬🇧</a>
            </p>
          </div>
        </div>
          <div className="flex items-center max-w-xl p-4 mx-auto mt-4 text-sm rounded-lg group" style={{ justifyContent: "center" }}>
            <Link href="https://lu.ma/avalanchesummitlondonhackathon?utm_source=builder_hub" className={buttonVariants({ size: 'lg', variant: 'default' })}>
              Register Here! →
            </Link>
          </div>
        </div>
      </div>

      <div className="py-6 sm:py-6">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <Card className="bg-linear-to-r from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-900">
            <div className="p-8 text-center">
              <h3 className="text-3xl font-bold mb-4 flex justify-center items-center gap-2 text-yellow-600 dark:text-yellow-300">
                <span>🏆</span> Prizes
              </h3>
              <div className="text-5xl font-extrabold text-gray-800 dark:text-gray-100 mb-4">
                $50,000 Prize Pool
              </div>
              <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">
                Distributed across all tracks based on project impact and innovation. (Plus partner's prizes).
              </p>
              <div className="mb-6">
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Top participants may earn a spot in the{" "}
                  <Link href="https://codebase.avax.network/" passHref>
                    <strong className="text-yellow-500 hover:underline">
                    Codebase Incubator Program
                    </strong>
                  </Link>, gaining access to exclusive resources and mentorship.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="py-12 sm:py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Hackathon Tracks</h2>
          {/*
          <p className="text-lg text-gray-600 dark:text-gray-400">
              To be Announced...<strong>Stay Tuned!</strong>
          </p>
          */}
          
          <div className="grid gap-6 md:grid-cols-2">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div> 
          
        </div>
      </div>

      {/*<div className="py-8 sm:py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <PartnerTracks />  
        </div>
      </div>
      */}
      
      <div className="py-12 sm:py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Partner and Sponsors</h2>
            
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Are you a project looking for developers to test your product and enhance the Avalanche Ecosystem?{" "}
              <Link href="https://share.hsforms.com/1kflciOGOQuCDSGGMWdpWSw4h8ew" passHref>
                <strong className="text-yellow-500 hover:underline">
                Apply as Sponsor
                </strong>
              </Link>, and get your own hackathon track!
            </p>
        </div>
      </div>

      <div className="py-4 sm:py-4">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-3xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Resources and Support</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <div className="p-6">
                <Users className="h-6 w-6 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Technical Mentorship</h3>
                <p className="text-gray-600 dark:text-gray-400">The DevRel team at Ava Labs will be available to guide teams on various technologies throughout the hackathon.</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <Book className="h-6 w-6 text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Workshops</h3>
                <p className="text-gray-600 dark:text-gray-400">Attend hands-on workshops on Avalanche technologies, cross-chain communication, blockchain customization, and data visualization.</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <SquareTerminal className="h-6 w-6 text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Developer Resources</h3>
                <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                  <li>
                    <Link href="https://build.avax.network/docs" className="flex items-center text-blue-600 dark:text-blue-400 hover:underline">
                      Avalanche Docs
                    </Link>
                  </li>
                  <li>
                    <Link href="https://academy.avax.network" className="flex items-center text-blue-600 dark:text-blue-400 hover:underline">
                      Avalanche Academy
                    </Link>
                  </li>
                  <li>
                    <Link href="https://core.app/tools/testnet-faucet/?subnet=c&token=c" className="flex items-center text-blue-600 dark:text-blue-400 hover:underline">
                      Avalanche Faucet
                    </Link>
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}