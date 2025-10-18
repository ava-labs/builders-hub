import React from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

function SocialLoginButton({ name, image, onClick }: { name: string; image: string; onClick: () => void }) {
  return (
    <Button
      variant='outline'
      className='h-11 flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 group'
      onClick={onClick}
    >
      <Image
        src={image}
        alt={name}
        width={20}
        height={20}
        className='opacity-80 group-hover:opacity-100 transition-opacity filter invert dark:filter-none'
      />
      <span className='sr-only'>{name}</span>
    </Button>
  );
}

export default SocialLoginButton;