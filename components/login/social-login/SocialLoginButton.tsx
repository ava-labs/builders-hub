import React from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

function SocialLoginButton({ name, image, onClick }: { name: string; image: string; onClick: () => void }) {
  return (
    <Button
      variant='outline'
      className='flex items-center gap-2 px-4 py-2 border border-gray-600 rounded-lg  Dark:bg-black  Dark:text-white  Dark:hover:bg-gray-800 transition'
      onClick={onClick}
    >
      <Image
        src={image}
        alt={name}
        width={24}
        height={16}
        className='filter invert dark:filter-none'
      ></Image>
      <span className='text-sm font-medium'>{name}</span>
    </Button>
  );
}

export default SocialLoginButton;