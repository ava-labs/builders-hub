import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { 
  Shield,
  Users,
  Zap,
  Activity,
  ArrowRight,
  Globe
} from 'lucide-react';

const faqData = [
  {
    q: 'What types of validation models are available?',
    a: 'Avalanche supports flexible validator set management with audited reference implementations for both permissioned (Proof-of-Authority) and permissionless (Proof-of-Stake with optional delegation) models. These implementations are fully customizable to meet specific requirements.',
    icon: Shield
  },
  {
    q: 'How many validators can there be in a permissioned chain?',
    a: 'Avalanche L1 chains utilize the same consensus mechanism as the public Primary Network, which has been running with over 1,000 validators. The architecture supports significantly higher theoretical maximums, constrained mainly by network latency and hardware.',
    icon: Users
  },
  {
    q: 'Can the chain be gasless?',
    a: 'Yes. Avalanche L1s can support gasless transactions through several mechanisms, including using a valueless token for gas or completely abstracting gas via relayers that sponsor transaction fees on behalf of users.',
    icon: Zap
  },
  {
    q: 'What is the expected TPS, and is it affected by the number of validators?',
    a: 'EVM L1 performance depends on multiple factors: state size, transaction type, validator count, and network latency. With a small (~10), co-located validator set and an in-memory state (<100GB), throughput can reach up to 8,400 TPS, equivalent to ~175 million gas/second (for simple transfers). With ~30 globally distributed validators, performance is around 4,000 TPS, or ~85 million gas/second—assuming the state fits in memory.',
    icon: Activity
  },
  {
    q: 'How does the migration from PoA to PoS work?',
    a: 'It is easy to migrate from PoA to PoS. The ownership of the validator manager contract is transferred to a staking manager. The ERC20 or native token Staking Manager contracts are deployed separately and are made the owner of the PoA Validator Manager contract.',
    icon: ArrowRight
  },
  {
    q: 'How does interoperability work without trusted third-parties?',
    a: 'Avalanche L1s provide native interoperability without trusted third-parties. The system uses a flat interoperability fee per validator with no sequencer revenue share, settlement fees, DA costs or message-based interoperability fees. This enables fast cross-chain communication with 2 block confirmations (3s end-to-end).',
    icon: Globe
  }
];

export const FAQSection = () => (
  <section className="space-y-8 py-24 px-4">
    <div className="text-center space-y-4">
      <h2 className="text-4xl font-bold mb-6">Frequently Asked Questions</h2>
      <p className="text-md text-muted-foreground mb-8">
        Common questions about L1 performance and capabilities
      </p>
    </div>

    <div className="max-w-4xl mx-auto">
      <div className="space-y-4">
        {faqData.map((faq, idx) => (
          <Accordion key={idx} type="single" collapsible className="w-full">
            <AccordionItem value={`item-${idx}`} className="border border-border/30 bg-background/50 backdrop-blur-sm rounded-xl overflow-hidden hover:bg-background/70 transition-colors duration-200">
              <AccordionTrigger className="px-6 py-5 hover:no-underline group cursor-pointer">
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-shrink-0">
                    <div className="p-2 rounded-lg bg-background/60 border border-border/40 group-hover:bg-background/80 transition-colors duration-200">
                      <faq.icon className="w-4 h-4 text-muted-foreground group-hover:text-[#EB4C50] transition-colors duration-200" />
                    </div>
                  </div>
                  <span className="font-semibold text-lg text-foreground group-hover:text-[#EB4C50] transition-colors duration-200 text-left flex-1">
                    {faq.q}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5">
                <div className="pl-14">
                  <p className="text-muted-foreground leading-relaxed text-base">
                    {faq.a}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </div>
    </div>
  </section>
); 