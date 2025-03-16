import { Loader2 } from "lucide-react";
import React from "react";

const FullScreenLoader = () => {
  return (
    <div className='flex justify-center items-center h-screen bg-[#000]'>
      <div className='relative'>
        <div className='absolute inset-0 animate-ping rounded-full bg-[#fb2c365e] opacity-50'></div>
        <Loader2
          className='text-[#FB2C36] w-14 h-14 animate-spin'
          color='#FB2C36'
        />
      </div>
    </div>
  );
};

export default FullScreenLoader;
