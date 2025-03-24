"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface PaginationComponentProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}

export const PaginationComponent = ({
  currentPage,
  onPageChange,
  totalPages,
}: PaginationComponentProps) => {
  return (
    <div className='flex justify-end items-center mt-6 space-x-2'>
      <Button
        variant='outline'
        size='sm'
        className='bg-transparent flex items-center'
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ArrowLeft size={16} color='white' />
        Previous
      </Button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Button
          key={page}
          size='sm'
          variant={"outline"}
          className={cn(
            "h-8 w-8 !bg-transparent",
            page === currentPage ? "!bg-[#2F2F33]" : ""
          )}
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}
      {/* <span className='px-2'>...</span> */}
      <Button
        variant='outline'
        size='sm'
        className='bg-transparent flex items-center'
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
        <ArrowRight size={16} color='white' />
      </Button>
    </div>
  );
};
