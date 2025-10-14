"use client";
import { useEffect, useState } from "react";
import { FaucetClaimResult } from "@/hooks/useTestnetFaucet";

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

interface AutomatedFaucetSuccessEvent extends CustomEvent {
  detail: {
    results: FaucetClaimResult[];
    isPChain: boolean;
  };
}

export function AutomatedFaucetConfetti() {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
  ];

  const createParticles = (count: number = 50) => {
    const newParticles: ConfettiParticle[] = [];

    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Math.random(),
        x: Math.random() * window.innerWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    return newParticles;
  };

  const triggerConfetti = () => {
    setIsAnimating(true);
    setParticles(createParticles());
    setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 3000);
  };

  useEffect(() => {
    const handleAutomatedFaucetSuccess = (
      event: AutomatedFaucetSuccessEvent
    ) => {
      triggerConfetti();
    };

    window.addEventListener(
      "automated-faucet-success",
      handleAutomatedFaucetSuccess as EventListener
    );

    return () => {
      window.removeEventListener(
        "automated-faucet-success",
        handleAutomatedFaucetSuccess as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (!isAnimating || particles.length === 0) return;

    let animationFrame: number;

    const animate = () => {
      setParticles(
        (prevParticles) =>
          prevParticles
            .map((particle) => ({
              ...particle,
              x: particle.x + particle.vx,
              y: particle.y + particle.vy,
              vy: particle.vy + 0.1,
              rotation: particle.rotation + particle.rotationSpeed,
            }))
            .filter((particle) => particle.y < window.innerHeight + 50)
      );

      if (isAnimating) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isAnimating]);

  if (!isAnimating || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg)`,
            transition: "none",
          }}
        />
      ))}
    </div>
  );
}

const confettiStyles = `
  @keyframes confetti-fall {
    0% {
      transform: translateY(-100vh) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(720deg);
      opacity: 0;
    }
  }
  
  @keyframes confetti-shake {
    0%, 100% { transform: translateX(0px); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }
  
  .confetti-particle {
    animation: confetti-fall 3s ease-out forwards;
  }
  
  .confetti-shake {
    animation: confetti-shake 0.5s ease-in-out;
  }
`;

if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = confettiStyles;
  document.head.appendChild(styleSheet);
}
