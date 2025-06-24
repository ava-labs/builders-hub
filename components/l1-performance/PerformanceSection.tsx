import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle,
  Cpu,
  Globe,
  Info
} from 'lucide-react';

const validatorConfigs = [
  {
    type: 'Small Co-located',
    validators: 5,
    location: 'All in the same data center (minimal latency)',
    gasPerSecond: '175m',
    features: ['Minimal latency', 'Strict state growth control'],
    flag: '🏢',
    testResults: {
      blocksPerSecond: '7.14',
      transactionsPerSecond: '8,408',
      gasPerSecond: '176.5M',
      blockTime: '80ms',
    }
  },
  {
    type: 'Large Distributed',
    validators: 30,
    location: 'Globally distributed (higher decentralization)',
    gasPerSecond: '175m',
    features: ['Global distribution', 'Higher decentralization'],
    flag: '🌍',
    testResults: {
      blocksPerSecond: '2.7',
      transactionsPerSecond: '4,053',
      gasPerSecond: '85.3M',
      blockTime: '370ms',
    }
  }
];

export const PerformanceSection = () => (
  <div className="space-y-8">

    <div className="flex flex-col lg:flex-row items-stretch gap-8 justify-center mt-8">
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-border/40 bg-background/70 shadow-lg backdrop-blur-md p-8 flex flex-col gap-6">
          <div className="flex items-center gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-6 h-6 text-[#EB4C50]" />
                <span className="text-2xl font-bold text-foreground">{validatorConfigs[0].type}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1 font-medium">
                {validatorConfigs[0].validators} validators
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {validatorConfigs[0].location}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center p-4 bg-background/60 rounded-lg border border-border/30">
              <div className="text-lg font-bold text-foreground">{validatorConfigs[0].gasPerSecond}</div>
              <div className="text-xs text-muted-foreground">Gas/Second (Config)</div>
            </div>
            <div className="flex-1 text-center p-4 bg-background/60 rounded-lg border border-border/30">
              <div className="text-lg font-bold text-foreground">{validatorConfigs[0].validators}</div>
              <div className="text-xs text-muted-foreground">Validators</div>
            </div>
          </div>
          <div className="space-y-3 mt-2">
            <h5 className="font-semibold text-sm text-foreground/80">Key Features</h5>
            <ul className="space-y-2">
              {validatorConfigs[0].features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div className="px-4 py-1 rounded-full border border-muted-foreground/20 bg-background/70 text-base font-semibold text-muted-foreground shadow-sm flex items-center gap-2" style={{letterSpacing: '0.05em'}}>
          <Globe className="w-4 h-4 animate-spin" style={{animationDuration: '3s'}} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-border/40 bg-background/70 shadow-lg backdrop-blur-md p-8 flex flex-col gap-6">
          <div className="flex items-center gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-6 h-6 text-[#EB4C50]" />
                <span className="text-2xl font-bold text-foreground">{validatorConfigs[1].type}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1 font-medium">
                {validatorConfigs[1].validators} validators
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {validatorConfigs[1].location}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center p-4 bg-background/60 rounded-lg border border-border/30">
              <div className="text-lg font-bold text-foreground">{validatorConfigs[1].gasPerSecond}</div>
              <div className="text-xs text-muted-foreground">Gas/Second (Config)</div>
            </div>
            <div className="flex-1 text-center p-4 bg-background/60 rounded-lg border border-border/30">
              <div className="text-lg font-bold text-foreground">{validatorConfigs[1].validators}</div>
              <div className="text-xs text-muted-foreground">Validators</div>
            </div>
          </div>
          <div className="space-y-3 mt-2">
            <h5 className="font-semibold text-sm text-foreground/80">Key Features</h5>
            <ul className="space-y-2">
              {validatorConfigs[1].features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-10">
      <div className="rounded-2xl border border-border/40 bg-background/70 shadow-lg backdrop-blur-md p-8">
        <div className="mb-4 font-semibold text-sm text-muted-foreground">Performance Comparison</div>
        {/* Responsive chart grid: 2x2 on mobile, 4x1 on desktop */}
        <div className="grid grid-cols-2 md:flex md:items-end md:gap-0 gap-y-6 h-auto md:h-40">
          {/* Transactions per Second */}
          <div className="flex flex-col items-center flex-1 px-2 md:px-4">
            <div className="flex gap-1 h-full items-end">
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-[#EB4C50] rounded-t-lg" style={{ height: `${(84/120)*120}px` }} title="Small Co-located"></div>
              </div>
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-muted-foreground/40 rounded-t-lg" style={{ height: `${(40/120)*120}px` }} title="Large Distributed"></div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">TPS<br /><span className="font-bold text-foreground">8,408 / 4,053</span></div>
          </div>
          {/* Vertical HR - only on desktop */}
          <div className="hidden md:flex h-24 items-center">
            <div className="w-0.5 h-16 mx-2 rounded-full bg-muted-foreground/20" />
          </div>
          {/* Gas per Second */}
          <div className="flex flex-col items-center flex-1 px-2 md:px-4">
            <div className="flex gap-1 h-full items-end">
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-[#EB4C50] rounded-t-lg" style={{ height: `${(88/120)*120}px` }} title="Small Co-located"></div>
              </div>
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-muted-foreground/40 rounded-t-lg" style={{ height: `${(43/120)*120}px` }} title="Large Distributed"></div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">Gas/sec (M)<br /><span className="font-bold text-foreground">176.5 / 85.3</span></div>
          </div>
          {/* Vertical HR - only on desktop */}
          <div className="hidden md:flex h-24 items-center">
            <div className="w-0.5 h-16 mx-2 rounded-full bg-muted-foreground/20" />
          </div>
          {/* Blocks per Second */}
          <div className="flex flex-col items-center flex-1 px-2 md:px-4">
            <div className="flex gap-1 h-full items-end">
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-[#EB4C50] rounded-t-lg" style={{ height: `${(71/120)*120}px` }} title="Small Co-located"></div>
              </div>
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-muted-foreground/40 rounded-t-lg" style={{ height: `${(27/120)*120}px` }} title="Large Distributed"></div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">Blocks/sec<br /><span className="font-bold text-foreground">7.14 / 2.7</span></div>
          </div>
          {/* Vertical HR - only on desktop */}
          <div className="hidden md:flex h-24 items-center">
            <div className="w-0.5 h-16 mx-2 rounded-full bg-muted-foreground/20" />
          </div>
          {/* Block Time (lower is better) */}
          <div className="flex flex-col items-center flex-1 px-2 md:px-4">
            <div className="flex gap-1 h-full items-end">
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-[#EB4C50] rounded-t-lg" style={{ height: `${(32/148)*120}px` }} title="Small Co-located"></div>
              </div>
              <div className="flex flex-col justify-end">
                <div className="w-7 bg-muted-foreground/40 rounded-t-lg" style={{ height: `${(148/148)*120}px` }} title="Large Distributed"></div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">Block Time (ms)<br /><span className="font-bold text-foreground">80 / 370</span></div>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-[#EB4C50]"></span> Small Co-located</div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-muted-foreground/40"></span> Large Distributed</div>
        </div>
      </div>
    </div>

    <Card className="border border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Info className="w-5 h-5 text-[#EB4C50]" />
          Performance Explainer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-background/50 rounded-lg p-4 border border-border/50">
          <p className="text-muted-foreground leading-relaxed text-sm">
            <strong>TPS vs Gas vs Multi-dimensional fees:</strong> Any EVM that runs at {'>'}20m gas per second needs to enforce restrictions on resource usage. For example, if there was an EVM chain with 100m gas per second that allowed arbitrary transactions, you could use all the capacity to write to the state (on disk). The state is stored forever in the EVM (huge flaw) and this would result in rapid state growth that would slow the chain down over time.
          </p>
          <p className="text-muted-foreground leading-relaxed text-sm mt-3">
            The beauty of an L1 is that you can control the usage of the capacity by restricting which smart contracts can be deployed. This way you can push performance much further by implementing restrictions on the application layer (for example not just writing data to disk).
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
); 