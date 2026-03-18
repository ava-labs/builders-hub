'use client';

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@radix-ui/react-dropdown-menu';
import { Search } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
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
import { ProjectCard } from './ProjectCard';
import { ProjectFilters } from '@/types/project';
import { useRouter } from 'next/navigation';
import { HackathonHeader } from '@/types/hackathons';
import { useExports } from './hooks/useExports';
import { LoadingButton } from '../ui/loading-button';
import { useSession, getSession } from 'next-auth/react';
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "../ui/toaster";
import NotFound from '@/app/not-found';
import { useLoginCompleteListener } from '@/hooks/useLoginModal';

type Props = {
  projects: Project[];
  events: HackathonHeader[];
  initialFilters: ProjectFilters;
  totalProjects: number;
};

// Helper function to check user permissions
function checkUserPermissions(customAttributes: string[] = []) {
  const hasShowcaseRole = customAttributes.includes('showcase');
  const isDevrel = customAttributes.includes('devrel');
  const hasHackathonCreator = customAttributes.includes('hackathonCreator');

  return {
    hasShowcaseAccess: hasShowcaseRole || isDevrel,
    hasExportAccess: hasHackathonCreator || isDevrel,
  };
}

export default function ShowCaseCard({
  projects,
  events,
  initialFilters,
  totalProjects,
}: Props) {
  const [searchValue, setSearchValue] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(initialFilters.page ?? 1);
  const { data: session, status, update } = useSession();
  const [recordsByPage, setRecordsByPage] = useState(
    initialFilters.recordsByPage ?? 12
  );
  const [totalPages, setTotalPages] = useState<number>(
    Math.ceil(totalProjects / recordsByPage) || 1
  );
  const [isExporting, setIsExporting] = useState(false);
  const router = useRouter();
  const { exportToExcel } = useExports();
  const selectedHackathon = events.find(event => event.id === filters.event);
  const availableTracks = selectedHackathon?.content?.tracks?.map(track => track.name) ?? [];
  const [hasExportAccess, setHasExportAccess] = useState(false);
  const { toast } = useToast();

  // Listen for login complete - refresh session and check permissions
  useLoginCompleteListener(useCallback(async () => {
    try {
      // Try to get session immediately first
      let freshSession = await getSession();

      // If not available, retry with progressive delays
      if (!freshSession?.user) {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          freshSession = await getSession();
          if (freshSession?.user) break;
        }
      }

      // Update permissions if we got a session
      if (freshSession?.user) {
        const { hasShowcaseAccess, hasExportAccess } = checkUserPermissions(
          freshSession.user.custom_attributes
        );
        setIsLoggedIn(hasShowcaseAccess);
        setHasExportAccess(hasExportAccess);
        await update();
      } else {
        // Session still not available after retries
        throw new Error('Session not available after multiple retries');
      }
    } catch (error) {
      console.error('Error refreshing session after login:', error);
      toast({
        title: "Session refresh failed",
        description: "Please refresh the page to continue.",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [update, toast]));

  const handleExport = async () => {
    const exportFilters: Record<string, unknown> = {
      ...(filters.event && { event: filters.event }),
      ...(filters.track && { track: filters.track }),
      ...(filters.search && { search: filters.search }),
      ...(typeof filters.winningProjecs === 'boolean' && {
        winningProjects: filters.winningProjecs
      }),
    };

    try {
      setIsExporting(true);
      await exportToExcel(exportFilters);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while exporting';
      console.error('Error exporting:', err);
      toast({
        title: "Error exporting projects",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Check permissions when session changes
  useEffect(() => {
    if (status === "loading") {
      setIsLoggedIn(null);
      return;
    }

    if (status === "authenticated" && session?.user) {
      const { hasShowcaseAccess, hasExportAccess } = checkUserPermissions(
        session.user.custom_attributes
      );
      setIsLoggedIn(hasShowcaseAccess);
      setHasExportAccess(hasExportAccess);
    } else {
      setIsLoggedIn(false);
      setHasExportAccess(false);
    }
  }, [session, status]);


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

  // Show loading while checking authentication
  if (isLoggedIn === null) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-50"></div>
      </div>
    );
  }

  // Show NotFound if not logged in or doesn't have required role
  if (isLoggedIn === false) {
    return <NotFound isAComponent={true} />;
  }

  return (
    
    <Card className='bg-zinc-50 dark:bg-zinc-950 relative border border-zinc-300 dark:border-zinc-800 p-8'>
       <Toaster />
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
      <div className='flex justify-end'>
        {hasExportAccess && (
          <LoadingButton
            variant='outline'
            isLoading={isExporting}
            onClick={handleExport}
            className='bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50'
          >
            Export Projects
          </LoadingButton>
        )}
      </div>
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
                className={`${filters.winningProjecs
                    ? '!bg-transparent'
                    : 'bg-zinc-50 dark:!bg-zinc-950'
                  } border-none`}
              >
                All Projects
              </TabsTrigger>
              <TabsTrigger
                onClick={() => handleFilterChange('winningProjecs', 'true')}
                value='winingProjects'
                className={`${filters.winningProjecs
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
          {totalProjects === 0
            ? 'No projects found'
            : `${totalProjects} ${totalProjects === 1 ? 'Project' : 'Projects'} found`}
        </h1>
        <Separator className='my-8 bg-zinc-300 dark:bg-zinc-800 h-[2px]' />
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {projects.map((project, index) => (

            <ProjectCard project={project} key={index} />

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
