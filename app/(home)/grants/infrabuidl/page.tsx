"use client"
import GrantApplicationForm from '@/components/client/infrabuidl-form';
import Image from 'next/image';

const InfraBUIDLHeader = () => (
  <>
      <div className="w-full relative mb-8">
        <Image
          src="/infrabuidl.png"
          alt="Avalanche infraBUILD() Program"
          width={800}
          height={200}
          className="w-full h-auto rounded-lg"
          priority
        />
      </div>
      <h1 className="text-7xl font-bold mb-4 leading-tight font-mono">Avalanche<br/>infraBUIDL()<br/>Program</h1>
      <h2 className="text-2xl mb-6 font-semibold text-red-500 font-mono">Application Form</h2>
      
      <div className="mb-12 space-y-4">
        <p className="text-lg">
          The Avalanche infraBUIDL() Program is designed to fortify the Avalanche ecosystem 
          by supporting infrastructure projects that enhance user and developer experience.
        </p>
        
        <p className="text-gray-400 text-sm">
          infraBUIDL() will fund projects demonstrating innovation or strategic importance to 
          the broader Avalanche ecosystem. The program will support onramps, validator marketplaces, 
          VMs, wallets, oracles, interoperability tools, cryptography, bridges, explorers, RPCs, data 
          storage, indexers, token engineering, and more!To be considered for support from the program, 
          please fill out the form with all relevant details, and the Avalanche Foundation will 
          reach out to discuss your project.For further information on the infraBUIDL() Program, 
          including eligibility criteria and application requirements, visit the Forum.
        </p>
        
        <p className="text-gray-400 text-sm">
          For further information on the infraBUILD() Program, including eligibility criteria
          and application requirements, visit the <a href="https://forum.avax.network" className="text-red-500 underline">Forum</a>.
        </p>
      </div>
  </>
);

export default function Page() {
  return <GrantApplicationForm programType="infraBUIDL()" headerComponent={<InfraBUIDLHeader />} />;
}