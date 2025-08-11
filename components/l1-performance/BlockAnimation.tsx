'use client';

import { useEffect, useState } from 'react';

interface BlockAnimationProps {
  className?: string;
}

interface Block {
  id: number;
  y: number;
  hash: string;
  height: number;
  isActive: boolean;
}

export const BlockAnimation: React.FC<BlockAnimationProps> = ({ className = '' }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [nextId, setNextId] = useState(0);

  // Generate random hash-like string
  const generateHash = () => {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 8; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  };

  // Generate random block height
  const generateHeight = () => Math.floor(Math.random() * 900000) + 100000;

  // Simple system: One block at a time
  useEffect(() => {
    const interval = setInterval(() => {
      setBlocks(prev => {
        const minSpacing = 25; // Minimum distance
        const maxSpacing = 40; // Maximum distance
        
        // Move all blocks down
        let updatedBlocks = prev.map(block => ({
          ...block,
          y: block.y + 1.5
        })).filter(block => block.y < 130); // Remove blocks that are off screen
        
        // Add new block if there's space
        const lastBlock = updatedBlocks.length > 0 
          ? updatedBlocks.reduce((highest, block) => block.y < highest.y ? block : highest)
          : null;
        
        const shouldAddBlock = !lastBlock || lastBlock.y > minSpacing;
        
        if (shouldAddBlock) {
          const randomSpacing = minSpacing + Math.random() * (maxSpacing - minSpacing);
          const newBlockY = lastBlock ? lastBlock.y - randomSpacing : -20;
          
          updatedBlocks.push({
            id: nextId,
            y: newBlockY,
            hash: generateHash(),
            height: generateHeight(),
            isActive: false
          });
          
          setNextId(prev => prev + 1);
        }
        
        // Update active state
        return updatedBlocks.map(block => ({
          ...block,
          isActive: block.y >= 40 && block.y <= 60
        }));
      });
    }, 40);

    return () => clearInterval(interval);
  }, [nextId]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}>
      {/* Chain line */}
      <div className="absolute right-12 top-0 w-0.5 h-full bg-gradient-to-b from-transparent via-foreground/10 to-transparent" />
      
      {/* Blocks */}
      {blocks.map(block => (
        <div
          key={block.id}
          className={`absolute transition-transform duration-200`}
          style={{
            top: `${block.y}%`,
            right: '48px', // Exactly align with chain line
            transform: `translateY(-50%) translateX(50%)`,
          }}
        >
          {/* Block container */}
          <div className={`
            w-12 h-6 rounded-sm border transition-all duration-200
            ${block.isActive 
              ? 'bg-blue-500/20 border-blue-400/40 shadow-lg scale-110' 
              : 'bg-foreground/5 border-foreground/10 scale-100'
            }
          `}>
            {/* Block content */}
            <div className="p-1 text-xs font-mono">
              <div className={`text-[8px] leading-none ${
                block.isActive ? 'text-blue-400' : 'text-foreground/40'
              }`}>
                #{block.height}
              </div>
              <div className={`text-[6px] leading-none mt-0.5 ${
                block.isActive ? 'text-blue-300' : 'text-foreground/30'
              }`}>
                {block.hash}
              </div>
            </div>
          </div>
          
          {/* Active block glow */}
          {block.isActive && (
            <div className="absolute inset-0 rounded-sm bg-blue-400/10 animate-pulse" />
          )}
        </div>
      ))}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/5 to-background/80 pointer-events-none" />
    </div>
  );
};
