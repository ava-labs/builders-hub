import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Coins, 
  Network, 
  Target
} from 'lucide-react';
import { DotsPattern, GridPattern, WavePattern, HexagonPattern } from './SvgPatterns';

const metrics = [
  {
    title: 'Gas Token',
    value: 'Fully Customizable',
    subtitle: 'ERC-20, stablecoin, ...',
    icon: Coins,
    pattern: DotsPattern,
  },
  {
    title: 'Throughput',
    value: 'Up to 8.4k TPS',
    subtitle: '(simple transfers / 175m gas per second)',
    icon: Zap,
    pattern: GridPattern,
  },
  {
    title: 'Block Time',
    value: 'Up to 125ms',
    subtitle: 'Configurable target rate',
    icon: Target,
    pattern: WavePattern,
  },
  {
    title: 'Interoperability',
    value: 'Native',
    subtitle: 'No third parties',
    icon: Network,
    pattern: HexagonPattern,
  }
];

export const MetricsSection = () => (
  <section className="space-y-12 pb-24 px-4">
    <div className="text-center space-y-4">
      
      <h2 className="text-4xl font-bold mb-6">Performance Metrics</h2>
      <p className="text-md text-muted-foreground mb-8">
        Industry-leading performance benchmarks that set new standards for blockchain technology
      </p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {metrics.map((metric, index) => (
        <Card key={index} className="border border-border bg-background shadow-none relative overflow-hidden h-[160px]">
          {/* Background Icon */}
          <div className="absolute right-[-30%] bottom-[-30%] text-foreground opacity-10 pointer-events-none select-none z-0" style={{height: '80%', width: '80%'}}>
            <metric.icon className="w-full h-full" />
          </div>
          <CardContent className="relative p-6 z-10 flex flex-col justify-center h-full">
            <div className="mb-2">
              <Badge variant="outline" className="text-xs bg-background border-border">
                {metric.title}
              </Badge>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-foreground">{metric.value}</h3>
              <p className="text-sm text-muted-foreground">{metric.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </section>
); 