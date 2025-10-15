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
    <div className="relative w-full max-w-md mx-auto mb-8">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search blogs by title, topic, author, or description..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-10 pr-10 rounded-xl bg-white text-sm"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
