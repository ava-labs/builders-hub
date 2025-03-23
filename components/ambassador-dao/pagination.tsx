"use client";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const PaginationComponent = () => {
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className='flex justify-end items-center mt-6 space-x-2'>
      <Button
        variant='outline'
        size='sm'
        className='bg-transparent flex items-center'
      >
        <ArrowLeft size={16} color='white' />
        Previous
      </Button>
      {[1, 2, 3].map((page) => (
        <Button
          key={page}
          size='sm'
          variant={"outline"}
          className={cn(
            "h-8 w-8 !bg-transparent",
            page === currentPage ? "!bg-[#2F2F33]" : ""
          )}
          onClick={() => setCurrentPage(page)}
        >
          {page}
        </Button>
      ))}
      <span className='px-2'>...</span>
      <Button
        variant='outline'
        size='sm'
        className='bg-transparent flex items-center'
      >
        Next
        <ArrowRight size={16} color='white' />
      </Button>
    </div>
  );
};
