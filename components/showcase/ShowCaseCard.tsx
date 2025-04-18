'use client';

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@radix-ui/react-dropdown-menu';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Project } from '@/types/showcase';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import React from 'react';
import { ProjectCard } from './ProjectCard';
import Link from 'next/link';
import { ProjectFilters } from '@/types/project';
import { useRouter } from 'next/navigation';
import { HackathonHeader } from '@/types/hackathons';
const tracks = ['AI', 'DeFi', 'RWA', 'Gaming', 'SocialFi', 'Tooling'];

type Props = {
  projects: Project[];
  events: HackathonHeader[];
  initialFilters: ProjectFilters;
  totalProjects: number;
};

export default function ShowCaseCard({
  projects,
  events,
  initialFilters,
  totalProjects,
}: Props) {
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(initialFilters.page ?? 1);
  const [recordsByPage, setRecordsByPage] = useState(
    initialFilters.recordsByPage ?? 12
  );
  const [totalPages, setTotalPages] = useState<number>(
    Math.ceil(totalProjects / recordsByPage) || 1
  );
  const router = useRouter();

  const selectedHackathon = events.find(event => event.id === filters.event);
  const availableTracks = selectedHackathon?.content?.tracks?.map(track => track.name) ?? [];
  

  const handleFilterChange = (type: keyof ProjectFilters, value: string) => {
    const newFilters = {
      ...filters,
      [type]: value === 'all' ? '' : value,
      ...(type !== 'page' ? { page: undefined } : {}),
      ...(type === 'event' ? { track: '' } : {}),
      ...(type == 'winningProjecs'
        ? value == 'true'
          ? { winningProjecs: true }
          : { winningProjecs: false }
        : {}),
    };

    setFilters(newFilters);

    const params = new URLSearchParams();
    if (newFilters.page) {
      params.set('page', newFilters.page.toString());
      setCurrentPage(Number(newFilters.page));
    }
    if (newFilters.recordsByPage) {
      params.set('recordsByPage', newFilters.recordsByPage.toString());
      setRecordsByPage(Number(newFilters.recordsByPage));
      setTotalPages(
        Math.ceil(totalProjects / Number(newFilters.recordsByPage))
      );
    }
    if (newFilters.event) params.set('event', newFilters.event);
    if (newFilters.track) params.set('track', newFilters.track);
    if (newFilters.search) params.set('search', newFilters.search);
    params.set('winningProjects', String(newFilters.winningProjecs));

    router.replace(`/showcase?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFilterChange('search', searchValue);
    }
  };

  return (
    <Card className='bg-zinc-50 dark:bg-zinc-950 relative border border-zinc-300 dark:border-zinc-800 p-8'>
      <CardHeader className='p-0'>
        <CardTitle className='text-2xl text-zinc-900 dark:text-zinc-50'>
          Showcase
        </CardTitle>
        <CardDescription className='text-zinc-600 text-base dark:text-zinc-400'>
          Discover innovative projects built during our hackathons. Filter by
          track, technology, and winners
        </CardDescription>
      </CardHeader>
      <Separator className='mt-6 bg-zinc-300 dark:bg-zinc-800 h-[2px]' />
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6'>
        <div className='w-full'>
          <Tabs
            defaultValue={
              filters.winningProjecs ? 'winingProjects' : 'allProjects'
            }
            className='w-full'
          >
            <TabsList className='w-full grid grid-cols-2 dark:!bg-zinc-800 bg-zinc-100'>
              <TabsTrigger
                onClick={() => handleFilterChange('winningProjecs', 'false')}
                value='allProjects'
                className={`${
                  filters.winningProjecs
                    ? '!bg-transparent'
                    : 'bg-zinc-50 dark:!bg-zinc-950'
                } border-none`}
              >
                All Projects
              </TabsTrigger>
              <TabsTrigger
                onClick={() => handleFilterChange('winningProjecs', 'true')}
                value='winingProjects'
                className={`${
                  filters.winningProjecs
                    ? 'bg-zinc-50 dark:!bg-zinc-950'
                    : '!bg-transparent'
                } border-none`}
              >
                Winning Projects
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className='relative w-full'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-[40px] w-5 text-zinc-400 stroke-zinc-700' />
          <Input
            type='text'
            defaultValue={filters.search}
            onChange={(e) => {
              const value = e.target.value;
              setSearchValue(value);
              if (value == '') {
                handleFilterChange('search', value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder='Search by name, event, location...'
            className='w-full min-h-[36px] text-sm px-3 pl-10 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-md dark:text-zinc-50 text-zinc-900 placeholder-zinc-500'
          />
        </div>
        <Select
          onValueChange={(value: string) => handleFilterChange('event', value)}
          value={filters.event}
        >
          <SelectTrigger className='w-full border border-zinc-300 dark:border-zinc-800'>
            <SelectValue placeholder='Select event' />
          </SelectTrigger>
          <SelectContent className='bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800'>
            <SelectItem value={'all'}>{'All events'}</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value: string) => handleFilterChange('track', value)}
          value={filters.track}
          disabled={!filters.event || filters.event === 'all'}
        >
          <SelectTrigger className='w-full border border-zinc-300 dark:border-zinc-800'>
            <SelectValue placeholder='Select track' />
          </SelectTrigger>
          <SelectContent className='bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800'>
            <SelectItem value={'all'}>{'All tracks'}</SelectItem>
            {availableTracks.map((track) => (
              <SelectItem key={track} value={track}>
                {track}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='mt-12'>
        <h1 className='text-2xl text-zinc-900 dark:text-zinc-50'>
          {totalProjects}{' '}
          {totalProjects > 1
            ? 'Projects'
            : totalProjects == 0
            ? 'No projects found'
            : 'Project'}{' '}
          found
        </h1>
        <Separator className='my-8 bg-zinc-300 dark:bg-zinc-800 h-[2px]' />
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {projects.map((project, index) => (
            <Link
              key={index}
              href={`/showcase/${project.id}`}
              className='w-full h-full'
            >
              <ProjectCard project={project} />
            </Link>
          ))}
        </div>
        <div className='w-full flex justify-end mt-8'>
          <Pagination className='flex justify-end gap-2'>
            <PaginationContent className='flex-wrap cursor-pointer'>
              {currentPage > 1 && (
                <PaginationItem
                  onClick={() =>
                    handleFilterChange('page', (currentPage - 1).toString())
                  }
                >
                  <PaginationPrevious />
                </PaginationItem>
              )}
              {Array.from(
                {
                  length: totalPages > 7 ? 7 : totalPages,
                },
                (_, i) =>
                  currentPage +
                  i -
                  (currentPage > 3
                    ? totalPages - currentPage > 3
                      ? 3
                      : totalPages - 1 - (totalPages - currentPage)
                    : currentPage - 1)
              ).map((page) => (
                <PaginationItem
                  key={page}
                  onClick={() => handleFilterChange('page', page.toString())}
                >
                  <PaginationLink isActive={page === currentPage}>
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {totalPages - currentPage > 3 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              {currentPage < totalPages && (
                <PaginationItem
                  onClick={() =>
                    handleFilterChange('page', (currentPage + 1).toString())
                  }
                >
                  <PaginationNext />
                </PaginationItem>
              )}

              <p className='mx-2'>
                Page {currentPage} of {totalPages}
              </p>

              <Select
                onValueChange={(value: string) =>
                  handleFilterChange('recordsByPage', value)
                }
                value={String(filters.recordsByPage)}
              >
                <SelectTrigger className='border border-zinc-300 dark:border-zinc-800'>
                  <SelectValue placeholder='Select track' />
                </SelectTrigger>
                <SelectContent className='bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800'>
                  {[
                    4,
                    8,
                    ...Array.from({ length: 5 }, (_, i) => (i + 1) * 12),
                  ].map((option) => (
                    <SelectItem key={option} value={option.toString()}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </Card>
  );
}
