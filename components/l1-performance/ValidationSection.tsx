import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  CheckCircle,
  Shield,
  Coins,
  Settings,
  ArrowRight
} from 'lucide-react';

const validationTypes = [
  {
    type: 'PoA (Proof of Authority)',
    description: 'Permissioned validator set with ownable manager contract',
    features: ['Ownable validator manager', 'Protected with onlyOwner modifier', 'Flexible ownership (EOA, multisig, contract)'],
    icon: Shield,
  },
  {
    type: 'PoS (Proof of Stake)',
    description: 'Permissionless staking with ERC20 or native token',
    features: ['Separate staking manager contracts', 'Lock/unlock stake functionality', 'Easy migration from PoA'],
    icon: Coins,
  },
  {
    type: 'Custom Validation',
    description: 'Fully customizable validation rules and mechanisms',
    features: ['Permissionless by default', 'Custom implementations possible', 'Hybrid models supported'],
    icon: Settings,
  }
];

export const ValidationSection = () => (
  <div className="space-y-12">

    {/* Interactive Validation Types */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {validationTypes.map((type, index) => (
        <div key={index} className="group relative h-full">
          <Card className="relative border border-border/40 bg-background/80 backdrop-blur-xl h-full flex flex-col">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#EB4C50]/10 to-transparent rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full" />
            
            <CardHeader className="pb-6 relative flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-background/60 to-background/40 border border-border/30 shadow-lg">
                    <type.icon className="w-8 h-8 text-[#EB4C50]" />
                  </div>
                  {/* Floating Indicator */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#EB4C50] rounded-full animate-pulse" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl font-bold text-foreground mb-2 group-hover:text-[#EB4C50] transition-colors duration-300">
                    {type.type}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                    {type.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0 flex-1 flex flex-col">
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                {type.features.map((feature, idx) => (
                  <div key={idx} className="group/feature relative flex-1">
                    <div className="flex items-start gap-3 p-4 bg-background/40 rounded-xl border border-border/20 h-full">
                      <div className="relative">
                        <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      </div>
                      <span className="text-sm text-foreground/90 leading-relaxed font-medium">
                        {feature}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>

    {/* Creative Migration Path */}
    <Card className="border border-border/40 bg-background/80 backdrop-blur-xl">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-bold text-foreground mb-2">Seamless Evolution</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Transform your validation model without disruption
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-center space-x-8">
          {[
            { label: 'PoA', desc: 'Permissioned', icon: Shield },
            { label: 'Transfer', desc: 'Validator Manager', icon: ArrowRight },
            { label: 'PoS', desc: 'Permissionless', icon: Coins }
          ].map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div className="flex flex-col items-center justify-center h-40 min-w-[120px]">
                <div className="flex flex-col items-center justify-center flex-1">
                  <div className="w-16 h-16 rounded-xl bg-background/60 border border-border/40 shadow-sm flex items-center justify-center mb-2">
                    <step.icon className="w-8 h-8 text-foreground" />
                  </div>
                  <div className="px-4 py-2 bg-background/40 rounded-lg border border-border/30 mt-1">
                    <span className="text-sm font-semibold text-foreground">{step.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{step.desc}</p>
                </div>
              </div>
              {idx < 2 && (
                <div className="flex items-center h-40">
                  <ArrowRight className="w-6 h-6 text-muted-foreground mx-6" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
); 