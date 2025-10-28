interface ChainLogoProps {
  logoUrl?: string;
  chainName: string;
  className?: string;
}

export function ChainLogo({ logoUrl, chainName, className = '' }: ChainLogoProps) {
  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      // Multi-word: first letter of first 2 words
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    // Single word: first 2 letters
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className={`w-5 h-5 rounded-md overflow-hidden flex items-center justify-center ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${chainName} logo`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full rounded-md bg-muted border border-border flex items-center justify-center">
          <span className="text-[10px] font-bold text-muted-foreground leading-none">
            {getInitials(chainName)}
          </span>
        </div>
      )}
    </div>
  );
}
