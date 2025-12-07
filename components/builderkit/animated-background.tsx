import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export const AnimatedBackground = () => {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const gridColor = isMounted
    ? resolvedTheme === "dark"
      ? "rgba(255,255,255,.05)"
      : "rgba(0,0,0,.05)"
    : "transparent";

  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0">
        {/* Geometric shapes */}
        <div className="absolute w-[500px] h-[500px] bg-[#1f66f4]/5 rounded-full blur-3xl animate-blob1 top-0 left-0" />
        <div className="absolute w-[400px] h-[400px] bg-[#1f66f4]/10 rounded-full blur-3xl animate-blob2 bottom-0 right-0" />
        <div className="absolute w-[300px] h-[300px] bg-[#1f66f4]/5 rounded-full blur-3xl animate-blob3 top-1/2 left-1/2" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 backdrop-blur-[100px]"
          style={{
            backgroundImage: `
                            linear-gradient(to right, ${gridColor} 1px, transparent 1px),
                            linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
                        `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>
    </div>
  );
};
