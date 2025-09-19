import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3,
  CheckCircle,
  Gauge,
  Network,
  Shield,
  Zap
} from 'lucide-react';

export const OverviewSection = () => (
  <div className="space-y-8">
    {/* Hero Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="text-center p-6 bg-background/50 rounded-2xl border border-border/50">
        <div className="text-3xl font-bold text-foreground mb-2">100%</div>
        <div className="text-sm text-muted-foreground">EVM Compatible</div>
      </div>
      <div className="text-center p-6 bg-background/50 rounded-2xl border border-border/50">
        <div className="text-3xl font-bold text-foreground mb-2">∞</div>
        <div className="text-sm text-muted-foreground">Customizable</div>
      </div>
      <div className="text-center p-6 bg-background/50 rounded-2xl border border-border/50">
        <div className="text-3xl font-bold text-foreground mb-2">Native</div>
        <div className="text-sm text-muted-foreground">Interoperability</div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="group relative">
        <Card className="relative border border-border/40 bg-background/80 backdrop-blur-xl overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#EB4C50]/10 to-transparent rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full" />
          
          <CardHeader className="pb-6 relative">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-background/60 to-background/40 border border-border/30 shadow-lg">
                  <BarChart3 className="w-8 h-8 text-[#EB4C50]" />
                </div>
                {/* Floating Indicator */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#EB4C50] rounded-full" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl font-bold text-foreground mb-2">
                  Key Advantages
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-3">
              {[
                'Native interoperability without trusted third-parties',
                'Fully customizable gas tokens and transaction fees',
                'Flat interoperability fee per validator',
                'No sequencer revenue share or DA costs'
              ].map((item, idx) => (
                <div key={idx} className="group/feature relative">
                  <div className="flex items-start gap-3 p-4 bg-background/40 rounded-xl border border-border/20">
                    <div className="relative">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    </div>
                    <span className="text-sm text-foreground/90 leading-relaxed font-medium">
                      {item}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="group relative">
        <Card className="relative border border-border/40 bg-background/80 backdrop-blur-xl overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#EB4C50]/10 to-transparent rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full" />
          
          <CardHeader className="pb-6 relative">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-background/60 to-background/40 border border-border/30 shadow-lg">
                  <Gauge className="w-8 h-8 text-[#EB4C50]" />
                </div>
                {/* Floating Indicator */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#EB4C50] rounded-full" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl font-bold text-foreground mb-2">
                  Technical Specifications
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-3">
              {[
                { label: 'EVM Compatibility', value: 'Full', icon: CheckCircle },
                { label: 'RPC Compatibility', value: 'Geth/Besu', icon: Network },
                { label: 'Gasless Support', value: 'Yes', icon: Zap },
                { label: 'State Growth Control', value: 'Strict', icon: Shield }
              ].map((spec, idx) => (
                <div key={idx} className="group/feature relative">
                  <div className="flex justify-between items-center p-4 bg-background/40 rounded-xl border border-border/20">
                    <div className="flex items-center gap-3">
                      <spec.icon className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium text-sm text-foreground/90">{spec.label}</span>
                    </div>
                    <Badge variant="outline" className="text-xs bg-[#EB4C50]/10 border-[#EB4C50]/30 text-[#EB4C50] font-semibold">{spec.value}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
); 