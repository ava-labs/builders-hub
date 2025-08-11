import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Coins, 
  Network, 
  Target
} from 'lucide-react';
import { DotsPattern, GridPattern, WavePattern, HexagonPattern } from './SvgPatterns';
import { TokenBackground } from './TokenBackground';
import { NumberCounter } from './NumberCounter';
import { NetworkAnimation } from './NetworkAnimation';
import { BlockAnimation } from './BlockAnimation';
import { ElectricEffect } from './ElectricEffect';
import { useSequentialAnimation } from '@/hooks/use-sequential-animation';

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
    subtitle: '(simple transfers / 85m gas per second)',
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

export const MetricsSection = () => {
  const { containerRef, getItemStyle } = useSequentialAnimation({
    itemCount: metrics.length,
    delay: 150,
    duration: 500
  });

  return (
    <section className="space-y-12 pb-24 px-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold mb-6">Performance Metrics</h2>
        <p className="text-md text-muted-foreground mb-8">
          Industry-leading performance benchmarks that set new standards for blockchain technology
        </p>
      </div>
      
      <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {metrics.map((metric, index) => (
          <div key={index} style={getItemStyle(index)}>
            <Card className="border border-border/50 bg-background/40 backdrop-blur-sm shadow-none relative overflow-hidden h-[160px]">
          {/* Special Token Background for Gas Token card */}
          {metric.title === 'Gas Token' && (
            <TokenBackground />
          )}
          
          {/* Special Network Animation for Interoperability card */}
          {metric.title === 'Interoperability' && (
            <NetworkAnimation />
          )}
          
          {/* Special Block Animation for Block Time card */}
          {metric.title === 'Block Time' && (
            <BlockAnimation />
          )}
          
          {/* Special Electric Effect for Throughput card */}
          {metric.title === 'Throughput' && (
            <ElectricEffect />
          )}
          
          {/* Background Icon for other cards */}
          {metric.title !== 'Gas Token' && metric.title !== 'Interoperability' && metric.title !== 'Block Time' && metric.title !== 'Throughput' && (
            <div className="absolute right-[-30%] bottom-[-30%] text-foreground opacity-10 pointer-events-none select-none z-0" style={{height: '80%', width: '80%'}}>
              <metric.icon className="w-full h-full" />
            </div>
          )}
          
          <CardContent className="relative p-6 z-10 flex flex-col justify-center h-full">
            <div className="mb-2">
              <Badge variant="outline" className="text-xs bg-background/60 backdrop-blur-lg border-border/40">
                {metric.title}
              </Badge>
            </div>
            <div className="space-y-1">
              {metric.title === 'Throughput' ? (
                <h3 className="text-2xl font-bold text-foreground">
                  Up to <NumberCounter end={8.4} decimals={1} className="inline" />k TPS
                </h3>
              ) : (
                <h3 className="text-2xl font-bold text-foreground">{metric.value}</h3>
              )}
              <p className="text-sm text-muted-foreground">{metric.subtitle}</p>
            </div>
          </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
}; 