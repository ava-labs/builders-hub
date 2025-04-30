import React from "react";
import Image from "next/image";
import Empty from "@/public/ambassador-dao-images/Empty.png";
import EmptyWhite from "@/public/ambassador-dao-images/emptyWhite.png";

const EmptyState = ({
  title = "No Jobs Match Your Filters",
  description = "Try adjusting criteria",
  className = "",
}) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full min-h-[500px] rounded-lg overflow-hidden text-[var(--white-text-color)] ${className}`}
    >
      <div className='absolute'>
        <div className='hidden dark:block'>
          <Image
            src={Empty}
            alt='Empty state background'
            priority
            className='object-cover object-center'
            height={500}
            width={700}
          />
        </div>
        <div className='block dark:hidden'>
          <Image
            src={EmptyWhite}
            alt='Empty state background'
            priority
            className='object-cover object-center'
            height={500}
            width={700}
          />
        </div>
      </div>

      <div className='relative z-20 text-center px-4 py-8'>
        <h3 className='text-xl font-medium mb-2'>{title}</h3>
        <p className='text-sm text-gray-200'>{description}</p>
      </div>
    </div>
  );
};

export default EmptyState;
