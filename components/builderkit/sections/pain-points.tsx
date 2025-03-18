import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { ScrollAnimation } from '@/components/builderkit/scroll-animation';
import { motion } from 'framer-motion';

const painPoints = [
  {
    number: '1',
    title: 'Accelerated Development Time',
    description: 'Accelerate your development time with pre-built components and flows',
    gradient: 'from-blue-500 to-indigo-500'
  },
  {
    number: '2',
    title: 'Simplified Blockchain Integration',
    description: 'Simplify your blockchain integration with our hooks and flows',
    gradient: 'from-indigo-500 to-purple-500'
  },
  {
    number: '3',
    title: 'Consistent User Experience',
    description: 'Maintain a consistent user experience across your entire application',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    number: '4',
    title: 'Enhanced Customization and Modularity',
    description: 'Customize and modularize your components and flows to fit your needs',
    gradient: 'from-pink-500 to-rose-500'
  },
  {
    number: '5',
    title: 'Creation of Common Know-How',
    description: 'Create common know-how across your team and the Avalanche Developer community',
    gradient: 'from-rose-500 to-orange-500'
  },
  {
    number: '6',
    title: 'Community Contributions and Ecosystem Growth',
    description: 'Contribute to the ecosystem and grow with us',
    gradient: 'from-orange-500 to-amber-500'
  }
];

export const PainPoints = () => {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent rendering until the component is mounted
  if (!isMounted) return null;

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-b from-white/0 dark:from-black/0 via-[#EB4C50]/5 to-white/0 dark:to-black/0" />
      
      <div className="max-w-7xl mx-auto px-4 relative">
        <ScrollAnimation>
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-6">Tackling Common Pain Points</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We've built solutions for the challenges developers face every day.
            </p>
          </div>
        </ScrollAnimation>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {painPoints.slice(0, 3).map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
            >
              <PainPointCard point={point} theme={resolvedTheme || 'light'} />
            </motion.div>
          ))}
          
          {painPoints.slice(3).map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
            >
              <PainPointCard point={point} theme={resolvedTheme || 'light'} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PainPointCard = ({ point, theme }: { point: typeof painPoints[0], theme: string }) => (
  <motion.div
    className="group relative h-full"
    whileHover={{ y: -8 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
  >
    <div 
      className="absolute inset-0 rounded-2xl bg-linear-to-br opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl"
    />
    <motion.div 
      className="relative h-full p-8 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/20 dark:bg-black/20 backdrop-blur-xs overflow-hidden"
      whileHover={{ 
        borderColor: `${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
        backgroundColor: `${theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`
      }}
      transition={{ duration: 0.3 }}
      key={theme}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div 
          className="absolute inset-0 bg-linear-to-br opacity-10"
          style={{
            background: `linear-gradient(to bottom right, ${point.gradient.split(' ')[1]}, ${point.gradient.split(' ')[3]})`
          }}
        />
      </div>
      
      <div className="relative z-10">
        <motion.div
          className="text-5xl font-bold mb-6 transition-colors duration-300 group-hover:text-white"
          style={{
            WebkitTextStroke: `${theme === 'dark' ? '2px #1f66f4' : '2px #1f66f4'}`,
            WebkitTextFillColor: `transparent`,
          }}
        >
          {point.number}
        </motion.div>
        <motion.h3 
          className="text-2xl font-semibold mb-4 group-hover:text-[#1f66f4] transition-colors duration-300"
        >
          {point.title}
        </motion.h3>
        <p className="text-gray-500 dark:text-gray-300 text-md leading-relaxed">
          {point.description}
        </p>
      </div>
    </motion.div>
  </motion.div>
);