import React from "react";

import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  metadata: {
    total: number;
    last_page: number;
    current_page: number;
    per_page: number;
    prev_page: number | null;
    next_page: number | null;
  };
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  metadata,
  onPageChange,
  className = "",
}) => {
  const { current_page, last_page, prev_page, next_page } = metadata;

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (last_page <= maxPagesToShow) {
      for (let i = 1; i <= last_page; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(current_page);

      for (let i = 1; i <= 2; i++) {
        if (current_page - i > 0) {
          pageNumbers.unshift(current_page - i);
        }
      }

      for (let i = 1; i <= 2; i++) {
        if (current_page + i <= last_page) {
          pageNumbers.push(current_page + i);
        }
      }

      if (!pageNumbers.includes(1)) {
        if (pageNumbers[0] > 2) {
          pageNumbers.unshift(-1);
        }
        pageNumbers.unshift(1);
      }

      if (!pageNumbers.includes(last_page)) {
        if (pageNumbers[pageNumbers.length - 1] < last_page - 1) {
          pageNumbers.push(-1);
        }
        pageNumbers.push(last_page);
      }
    }

    return pageNumbers;
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > last_page || page === current_page) return;
    onPageChange(page);
  };

  return (
    <div className={`flex items-center justify-end gap-4 my-4 ${className}`}>
      <button
        onClick={() => prev_page && handlePageChange(prev_page)}
        disabled={!prev_page}
        className={`flex items-center justify-center p-2 rounded ${
          prev_page
            ? "text-[var(--primary-text-color)] hover:bg-[#27272A] cursor-pointer"
            : "text-gray-500 cursor-not-allowed"
        }`}
        aria-label='Previous page'
      >
        <ArrowLeft size={16} color={next_page ? "white" : "#9F9FA9"} />
        <span className='hidden sm:inline ml-1'>Previous</span>
      </button>

      <div className='hidden sm:flex gap-1'>
        {getPageNumbers().map((pageNum, index) =>
          pageNum === -1 ? (
            <span
              key={`ellipsis-${index}`}
              className='px-3 py-2 text-[var(--secondary-text-color)]'
            >
              ...
            </span>
          ) : (
            <button
              key={`page-${pageNum}`}
              onClick={() => handlePageChange(pageNum)}
              className={`px-3 py-1 rounded ${
                pageNum === current_page
                  ? "bg-[#2F2F33] text-white"
                  : "text-[var(--primary-text-color)] hover:bg-[#27272A]"
              }`}
            >
              {pageNum}
            </button>
          )
        )}
      </div>

      <span className='sm:hidden px-3 py-2 text-[var(--secondary-text-color)]'>
        {current_page} of {last_page}
      </span>

      <button
        onClick={() => next_page && handlePageChange(next_page)}
        disabled={!next_page}
        className={`flex items-center justify-center p-2 rounded ${
          next_page
            ? "text-[var(--primary-text-color)] hover:bg-[#27272A] cursor-pointer"
            : "text-gray-500 cursor-not-allowed"
        }`}
        aria-label='Next page'
      >
        <span className='hidden sm:inline mr-1'>Next</span>
        <ArrowRight size={16} color={next_page ? "white" : "#9F9FA9"} />
      </button>
    </div>
  );
};
