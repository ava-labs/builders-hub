import React, { useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "../../../../components/ui/alert";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function Intro() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    babyJubJub: false,
    auditor: false,
    registrar: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">What is eERC?</h2>
      <p>
        <strong>Encrypted ERC (eERC)</strong> is a privacy-focused implementation of ERC20-like tokens that enables confidential transactions on the blockchain. Unlike traditional ERC20 tokens, where all balances and transfers are publicly visible, eERC uses advanced cryptographic techniques to keep transaction amounts and user balances private, while still allowing verification of their correctness.
      </p>
      <p>
        eERC addresses the challenge of balancing blockchain transparency with user privacy. It allows transactions to be verified without revealing the actual amounts being transferred, making it suitable for individuals and businesses that require financial privacy.
      </p>
      <p>
        Additionally, eERC includes a powerful auditability feature for regulatory compliance. Designated authorities can access transaction details through special auditor keys, ensuring that while transactions remain private to the public, authorized regulators can perform oversight when necessary. This approach maintains user privacy while supporting compliance frameworks in the blockchain ecosystem.
      </p>
      <p className="text-sm text-blue-600">
        Learn more in the <a href="https://docs.avacloud.io/encrypted-erc/getting-started/what-is-encrypted-erc" target="_blank" rel="noopener noreferrer" className="underline">official documentation</a>.
      </p>

      {/* Collapsible Sections */}
      <div className="space-y-4">
        {/* About BabyJubJub Curve */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <button
            onClick={() => toggleSection('babyJubJub')}
            className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors rounded-t-lg"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">About BabyJubJub Curve</h3>
            {expandedSections.babyJubJub ? (
              <ChevronDown className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            )}
          </button>
          
          {expandedSections.babyJubJub && (
            <div className="px-6 pb-6 pt-2 space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">Elliptic Curve Cryptography</h4>
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                  BabyJubJub is a specialized elliptic curve designed specifically for efficient cryptographic operations 
                  in zero-knowledge proofs (zkSNARKs). It's optimized for privacy-preserving blockchain applications, 
                  offering strong security with low computational overhead.
                </p>
              </div>
              
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">Why BabyJubJub?</h4>
                <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                  <li>• <strong>Efficiency:</strong> Optimized for zkSNARK operations with minimal computational cost</li>
                  <li>• <strong>Security:</strong> Provides strong cryptographic guarantees for privacy operations</li>
                  <li>• <strong>Compatibility:</strong> Designed to work seamlessly with zero-knowledge proof systems</li>
                  <li>• <strong>Scalability:</strong> Enables practical privacy-preserving transactions on blockchain</li>
                </ul>
              </div>
              
              <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-teal-800 dark:text-teal-200 mb-2">In eERC Context</h4>
                <p className="text-sm text-teal-700 dark:text-teal-300">
                  In eERC, BabyJubJub is used to represent public keys as points (X, Y coordinates) on the elliptic curve. 
                  These points enable secure and efficient privacy-preserving operations, allowing users to prove 
                  transaction validity without revealing sensitive information like amounts or balances.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* What is an Auditor? */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <button
            onClick={() => toggleSection('auditor')}
            className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors rounded-t-lg"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">What is an Auditor?</h3>
            {expandedSections.auditor ? (
              <ChevronDown className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            )}
          </button>
          
          {expandedSections.auditor && (
            <div className="px-6 pb-6 pt-2 space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Regulatory Compliance</h4>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  An auditor in eERC is a designated authority (like regulatory bodies, tax authorities, or compliance officers) 
                  who has special cryptographic keys that allow them to decrypt transaction details while maintaining privacy 
                  for regular users. This enables regulatory oversight without compromising the privacy benefits of eERC.
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Privacy-Preserving Oversight</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  The auditor public key is used to encrypt transaction data in a way that only authorized auditors can decrypt. 
                  This creates a balance between user privacy and regulatory compliance, ensuring that while transactions remain 
                  private to the public, authorized parties can perform necessary oversight when required by law.
                </p>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Key Features</h4>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>• <strong>Selective Disclosure:</strong> Only authorized auditors can access transaction details</li>
                  <li>• <strong>Privacy by Default:</strong> All transactions remain private to regular users</li>
                  <li>• <strong>Compliance Ready:</strong> Meets regulatory requirements for financial transparency</li>
                  <li>• <strong>Cryptographic Security:</strong> Uses advanced encryption to protect sensitive data</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* About Registrar Smart Contract */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <button
            onClick={() => toggleSection('registrar')}
            className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors rounded-t-lg"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">About Registrar Smart Contract</h3>
            {expandedSections.registrar ? (
              <ChevronDown className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            )}
          </button>
          
          {expandedSections.registrar && (
            <div className="px-6 pb-6 pt-2 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Centralized User Registry</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  The Registrar smart contract serves as a centralized registry that stores user registration information 
                  and their associated BabyJubJub public keys. It acts as the authoritative source for verifying user 
                  identities and their privacy credentials in the eERC ecosystem.
                </p>
              </div>
              
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-cyan-800 dark:text-cyan-200 mb-2">BabyJubJub Point Storage</h4>
                <p className="text-sm text-cyan-700 dark:text-cyan-300">
                  The registrar stores each user's BabyJubJub public key as a point with X and Y coordinates on the elliptic curve. 
                  These coordinates are stored as <code className="bg-white dark:bg-zinc-800 px-1 rounded text-xs">uint256[2]</code> arrays, 
                  representing the mathematical point (X, Y) that uniquely identifies the user's privacy key.
                </p>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">Key Functions</h4>
                <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
                  <li>• <strong>Registration:</strong> Stores user addresses mapped to their BabyJubJub public keys</li>
                  <li>• <strong>Verification:</strong> Allows checking if an address is registered and retrieving their public key</li>
                  <li>• <strong>Privacy Operations:</strong> Provides the foundation for all privacy-preserving transactions</li>
                  <li>• <strong>Audit Trail:</strong> Maintains a record of registered users for compliance purposes</li>
                </ul>
              </div>
              
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-rose-800 dark:text-rose-200 mb-2">How It Works</h4>
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  When a user registers with eERC, their wallet address is linked to their BabyJubJub public key coordinates 
                  in the registrar contract. This mapping enables the eERC system to verify user identities and perform 
                  privacy-preserving operations while maintaining the cryptographic security of the BabyJubJub curve.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <p>
        In this section, you can interact with eERC contracts in converter or standalone mode, depending on your privacy and compatibility needs.
      </p>
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Converter Privacy Token</AlertTitle>
          <AlertDescription>
            A Converter privacy token allows users to convert between a standard (public) ERC-20 token and a privacy-preserving eERC token. Users can deposit public tokens to receive private tokens, or withdraw private tokens back to public form. This enables flexible privacy, letting users choose when to keep their balances and transfers private.
          </AlertDescription>
        </Alert>
        <Alert>
          <AlertTitle>Standalone Privacy Token</AlertTitle>
          <AlertDescription>
            A Standalone privacy token exists only in the private (eERC) form. All balances and transfers are always private, with no public ERC-20 version or conversion mechanism. This is ideal when you want a token that is always private by design.
          </AlertDescription>
        </Alert>
      </div>
      <div className="flex gap-4 mt-6">
        <a href="#converterPrivacyTokenFlow">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition cursor-pointer">Test Converter Flow</button>
        </a>
        <a href="#standalonePrivacyTokenFlow">
          <button className="px-4 py-2 bg-zinc-200 text-zinc-800 rounded hover:bg-zinc-300 transition cursor-pointer">Test Standalone Flow</button>
        </a>
      </div>
    </div>
  );
} 