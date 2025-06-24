import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  CheckCircle,
  Coins,
  Shield,
  Settings,
  Target,
  Users,
  Flame
} from 'lucide-react';

export const EconomicsSection = () => (
  <div className="space-y-8">
    {/* Economic Model Overview */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="text-center p-6 bg-background/50 rounded-2xl border border-border/50">
        <Coins className="w-8 h-8 text-foreground mx-auto mb-3" />
        <div className="text-lg font-semibold mb-1">Gas Token</div>
        <div className="text-sm text-muted-foreground">Custom ERC-20</div>
      </div>
      <div className="text-center p-6 bg-background/50 rounded-2xl border border-border/50">
        <Shield className="w-8 h-8 text-foreground mx-auto mb-3" />
        <div className="text-lg font-semibold mb-1">Staking Token</div>
        <div className="text-sm text-muted-foreground">Validator Control</div>
      </div>
      <div className="text-center p-6 bg-background/50 rounded-2xl border border-border/50">
        <Settings className="w-8 h-8 text-foreground mx-auto mb-3" />
        <div className="text-lg font-semibold mb-1">Fee Models</div>
        <div className="text-sm text-muted-foreground">Flexible Options</div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="border border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Coins className="w-5 h-5 text-[#EB4C50]" />
            Gas Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              'Support for custom gas token',
              'Can be stablecoin or any ERC-20 token',
              'Can be shared across multiple L1s'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Shield className="w-5 h-5 text-[#EB4C50]" />
            Staking Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              'Can be same as gas/native token or separate',
              'Full control over validator set determination',
              'Custom implementations like node licenses'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    <Card className="border border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-xl">Transaction Fee Models</CardTitle>
        <CardDescription>
          Flexible fee distribution and reward mechanisms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Reward Address', desc: 'Set specific address to receive all transaction fees from blocks', icon: Target },
            { title: 'Fee Recipients', desc: 'Allow block producers to claim fees with their own addresses', icon: Users },
            { title: 'Burn All Fees', desc: 'Dynamically switch to burning all collected transaction fees', icon: Flame }
          ].map((model, idx) => (
            <div key={idx} className="p-4 border border-border/50 rounded-lg bg-background/50">
              <div className="flex items-center gap-2 mb-2">
                <model.icon className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">{model.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground">{model.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
); 