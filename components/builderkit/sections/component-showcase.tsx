import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';
import { CodeSnippet } from '@/components/builderkit/code-snippet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const components = {
  ictt: {
    name: 'ICTT',
    code: `import { ICTT } from '@avalabs/builderkit';

function App() {
  return (
    <div className="space-y-4">
      <ICTT />
    </div>
  );
}`,
    preview: (<></>)
  },
  faucet: {
    name: 'Faucet',
    code: `import { Faucet } from '@avalabs/builderkit';

function App() {
  return (
    <div className="space-y-4">
      <Faucet />
    </div>
  );
}`,
    preview: (<></>)
  }
};

export const ComponentShowcase = () => {
  const [activeComponent, setActiveComponent] = useState<keyof typeof components>('ictt');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('code');

  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold mb-6">
              Modern and Practical Components
            </h2>
            <p className="text-md text-muted-foreground mb-8">
              Start building quickly with ready-to-use components. Written in TypeScript, modern and customizable.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(components).map(([key, component]) => (
                <button
                  key={key}
                  onClick={() => setActiveComponent(key as keyof typeof components)}
                  className={cn(
                    "relative px-4 py-2 rounded-full text-sm font-medium transition-all border",
                    activeComponent === key 
                      ? "bg-[#1f66f4] text-white" 
                      : "text-gray-400 hover:text-muted-foreground"
                  )}
                >
                  <span className="relative z-10">{component.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white/20 dark:bg-black/20 backdrop-blur-xs rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
            <div className="border-b border-black/10 dark:border-white/10">
              <div className="flex">
                <TabButton
                  active={activeTab === 'code'}
                  onClick={() => setActiveTab('code')}
                >
                  Code
                </TabButton>
              </div>
            </div>
            <div className="h-[300px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeComponent}-${activeTab}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {activeTab === 'preview' ? (
                    <div className="p-8 flex items-center justify-center h-full">
                      {components[activeComponent].preview}
                    </div>
                  ) : (
                    <div className="relative group">
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-linear-to-b from-white/20 dark:from-black/20 to-transparent h-8" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-linear-to-t dark:from-black/20 to-transparent h-8 bottom-0" />
                      <div className="p-4 h-[300px] overflow-y-auto scrollbar-thin bg-black no-scrollbar">
                        <CodeSnippet code={components[activeComponent].code} />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const TabButton = ({ 
  children, 
  active, 
  onClick 
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex-1 px-4 py-3 text-sm font-medium transition-colors relative",
      active ? "text-black dark:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"
    )}
  >
    {children}
    {active && (
      <motion.div
        layoutId="activeTab"
        className="absolute bottom-0 left-0 right-0 h-1 bg-[#1f66f4]"
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      />
    )}
  </button>
);