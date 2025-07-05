import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Shield,
  Coins
} from 'lucide-react';
import { OverviewSection } from './OverviewSection';
import { PerformanceSection } from './PerformanceSection';
import { ValidationSection } from './ValidationSection';
import { EconomicsSection } from './EconomicsSection';

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    subtitle: 'Key advantages and technical specifications',
    icon: BarChart3,
    content: <OverviewSection />
  },
  {
    id: 'performance',
    title: 'Performance',
    subtitle: 'Scaling and performance characteristics',
    icon: TrendingUp,
    content: <PerformanceSection />
  },
  {
    id: 'validation',
    title: 'Validation',
    subtitle: 'Flexible validation mechanisms',
    icon: Shield,
    content: <ValidationSection />
  },
  {
    id: 'economics',
    title: 'Economics',
    subtitle: 'Tokenomics and fee structures',
    icon: Coins,
    content: <EconomicsSection />
  }
];

interface HorizontalScrollSectionProps {
  isInSlider: boolean;
  setIsInSlider: (value: boolean) => void;
}

export const HorizontalScrollSection = ({ isInSlider, setIsInSlider }: HorizontalScrollSectionProps) => {
  const [currentSection, setCurrentSection] = useState(0);

  return (
    <section className="py-24 w-full overflow-hidden">
      {/* Navigation Dots - Fixed Position */}
      <div className="flex justify-center gap-2 mb-8">
        {sections.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSection(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              currentSection === index 
                ? 'bg-[#EB4C50] scale-125' 
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
          />
        ))}
      </div>

      {/* Current Section Display */}
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold">{sections[currentSection].title}</h3>
        <p className="text-sm text-muted-foreground">{sections[currentSection].subtitle}</p>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-center gap-4 mb-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
          disabled={currentSection === 0}
          className="rounded-full w-12 h-12 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background/90"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSection(Math.min(sections.length - 1, currentSection + 1))}
          disabled={currentSection === sections.length - 1}
          className="rounded-full w-12 h-12 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background/90"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Responsive Section Container - NO horizontal scroll */}
      <div className="w-full overflow-hidden">
        <div className="w-full">
          {sections.map((section, index) => (
            <div
              key={section.id}
              style={{ display: currentSection === index ? 'block' : 'none' }}
              className="w-full overflow-hidden"
            >
              <div className="w-full px-2 sm:px-4 md:px-8 max-w-4xl md:max-w-5xl lg:max-w-6xl mx-auto">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}; 