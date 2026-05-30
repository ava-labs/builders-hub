'use client';
import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface BlogPost {
  url: string;
  data: {
    title: string;
    description: string;
    topics: string[];
    date: string;
    authors: string[];
  };
  file: {
    name: string;
  };
}

interface BlogSearchProps {
  blogs: BlogPost[];
  onFilteredResults: (filtered: BlogPost[]) => void;
}

export function BlogSearch({ blogs, onFilteredResults }: BlogSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredBlogs = useMemo(() => {
    if (!searchQuery.trim()) {
      return blogs;
    }

    const query = searchQuery.toLowerCase().trim();

    return blogs.filter((blog) => {
      const titleMatch = blog.data.title.toLowerCase().includes(query); // title search
      const topicMatch = blog.data.topics.some((topic) => topic.toLowerCase().includes(query)); // topic search
      const descriptionMatch = blog.data.description?.toLowerCase().includes(query); // description search
      const authorMatch = blog.data.authors.some((author) => author.toLowerCase().includes(query)); // author search
      return titleMatch || topicMatch || descriptionMatch || authorMatch;
    });
  }, [blogs, searchQuery]);

  useMemo(() => {
    onFilteredResults(filteredBlogs);
  }, [filteredBlogs, onFilteredResults]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
        <Input
          placeholder="Search by title, topic, author, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 pr-12 py-6 rounded-xl bg-card/60 backdrop-blur-sm border-border/50 text-base shadow-lg transition-all duration-300 focus:shadow-xl focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground/60 hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
