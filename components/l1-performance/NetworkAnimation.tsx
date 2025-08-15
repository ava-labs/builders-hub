'use client';

import { useEffect, useState } from 'react';

interface NetworkAnimationProps {
  className?: string;
}

interface Node {
  id: string;
  x: number;
  y: number;
  size: number;
  isHub?: boolean;
}

interface Connection {
  from: string;
  to: string;
  isActive: boolean;
  progress: number;
  type: 'hub' | 'direct';
}

export const NetworkAnimation: React.FC<NetworkAnimationProps> = ({ className = '' }) => {
  const [connections, setConnections] = useState<Connection[]>([]);

  // Define nodes positions (relative to container) - shifted more right
  const nodes: Node[] = [
    // Hub node (center-right) - further right
    { id: 'hub', x: 75, y: 50, size: 8, isHub: true },
    
    // Inner ring - connected nodes
    { id: 'node1', x: 55, y: 30, size: 4 },
    { id: 'node2', x: 95, y: 30, size: 4 },
    { id: 'node3', x: 100, y: 55, size: 4 },
    { id: 'node4', x: 90, y: 75, size: 4 },
    { id: 'node5', x: 60, y: 75, size: 4 },
    { id: 'node6', x: 50, y: 55, size: 4 },
    
    // Outer ring - some connected, some autonomous
    { id: 'node7', x: 45, y: 15, size: 3 },
    { id: 'node8', x: 105, y: 15, size: 3 },
    { id: 'node9', x: 115, y: 45, size: 3 },
    { id: 'node10', x: 110, y: 85, size: 3 },
    { id: 'node11', x: 75, y: 95, size: 3 },
    { id: 'node12', x: 40, y: 85, size: 3 },
    { id: 'node13', x: 35, y: 45, size: 3 },
    
    // Additional outer nodes
    { id: 'node14', x: 85, y: 10, size: 3 },
    { id: 'node15', x: 25, y: 25, size: 3 },
    { id: 'node16', x: 120, y: 65, size: 3 },
    
    // Autonomous nodes (not connected to hub)
    { id: 'autonomous1', x: 37, y: 20, size: 2 },
    { id: 'autonomous2', x: 113, y: 25, size: 2 },
    { id: 'autonomous3', x: 110, y: 70, size: 2 },
    { id: 'autonomous4', x: 40, y: 70, size: 2 },
    { id: 'autonomous5', x: 22, y: 10, size: 2 },
    { id: 'autonomous6', x: 118, y: 90, size: 2 },
  ];

  // Only connected nodes (exclude autonomous)
  const connectedNodes = nodes.filter(node => !node.isHub && !node.id.startsWith('autonomous'));

  // Initialize connections
  useEffect(() => {
    const hubConnections: Connection[] = connectedNodes.map(node => ({
      from: 'hub',
      to: node.id,
      isActive: false,
      progress: 0,
      type: 'hub' as const
    }));

    // Add some direct connections between inner ring nodes only
    const directConnections: Connection[] = [
      { from: 'node1', to: 'node2', isActive: false, progress: 0, type: 'direct' },
      { from: 'node3', to: 'node4', isActive: false, progress: 0, type: 'direct' },
      { from: 'node5', to: 'node6', isActive: false, progress: 0, type: 'direct' },
    ];

    setConnections([...hubConnections, ...directConnections]);
  }, []);

  // Animation logic
  useEffect(() => {
    const interval = setInterval(() => {
      setConnections(prev => {
        const updated = [...prev];
        
        // Randomly activate connections (slower activation)
        const inactiveConnections = updated.filter(conn => !conn.isActive);
        if (inactiveConnections.length > 0 && Math.random() > 0.85) {
          const randomConn = inactiveConnections[Math.floor(Math.random() * inactiveConnections.length)];
          const index = updated.findIndex(conn => 
            conn.from === randomConn.from && conn.to === randomConn.to
          );
          if (index !== -1) {
            updated[index] = { ...updated[index], isActive: true, progress: 0 };
          }
        }

        // Update progress for active connections (slower movement)
        return updated.map(conn => {
          if (conn.isActive) {
            const newProgress = conn.progress + 0.02;
            if (newProgress >= 1) {
              return { ...conn, isActive: false, progress: 0 };
            }
            return { ...conn, progress: newProgress };
          }
          return conn;
        });
      });
    }, 80);

    return () => clearInterval(interval);
  }, []);

  const getNodeById = (id: string): Node | undefined => {
    return nodes.find(node => node.id === id);
  };

  const renderConnection = (connection: Connection) => {
    const fromNode = getNodeById(connection.from);
    const toNode = getNodeById(connection.to);
    
    if (!fromNode || !toNode) return null;

    const x1 = fromNode.x;
    const y1 = fromNode.y;
    const x2 = toNode.x;
    const y2 = toNode.y;

    // Calculate current position of the data packet
    const currentX = x1 + (x2 - x1) * connection.progress;
    const currentY = y1 + (y2 - y1) * connection.progress;

    return (
      <g key={`${connection.from}-${connection.to}`}>
        {/* Connection line */}
        <line
          x1={`${x1}%`}
          y1={`${y1}%`}
          x2={`${x2}%`}
          y2={`${y2}%`}
          stroke="currentColor"
          strokeWidth="0.3"
          opacity={connection.type === 'hub' ? 0.08 : 0.06}
          className="text-foreground"
        />
        
        {/* Animated data packet */}
        {connection.isActive && (
          <circle
            cx={`${currentX}%`}
            cy={`${currentY}%`}
            r="0.8"
            fill="currentColor"
            className={connection.type === 'hub' ? 'text-red-400' : 'text-green-400'}
            opacity="0.3"
          >
            <animate
              attributeName="r"
              values="0.8;1.5;0.8"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </g>
    );
  };

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0"
      >
        {/* Render connections */}
        {connections.map(renderConnection)}
        
        {/* Render nodes */}
        {nodes.map(node => (
          <g key={node.id}>
            {/* Node glow effect */}
            {node.isHub && (
              <circle
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r={node.size + 2}
                fill="currentColor"
                className="text-red-500"
                opacity="0.05"
              >
                <animate
                  attributeName="r"
                  values={`${node.size + 1};${node.size + 3};${node.size + 1}`}
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            
            {/* Main node */}
            <circle
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size}
              fill="currentColor"
              className={
                node.isHub 
                  ? 'text-red-500' 
                  : node.id.startsWith('autonomous') 
                    ? 'text-purple-400' 
                    : 'text-foreground'
              }
              opacity={
                node.isHub 
                  ? 0.4 
                  : node.id.startsWith('autonomous') 
                    ? 0.15 
                    : 0.2
              }
            />
            
            {/* Inner core for hub */}
            {node.isHub && (
              <circle
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r={node.size - 2}
                fill="currentColor"
                className="text-red-400"
                opacity="0.3"
              />
            )}
          </g>
        ))}
      </svg>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/10 to-background/80 pointer-events-none" />
    </div>
  );
};
