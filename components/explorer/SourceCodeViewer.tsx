"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FileCode, FolderOpen, Folder, ChevronRight, ChevronDown, X, GripVertical, PanelRightClose, PanelRightOpen, Download } from "lucide-react";
import { codeToHtml } from "shiki";
import JSZip from "jszip";

interface SourceFile {
  content: string;
}

interface SourceCodeViewerProps {
  sources: Record<string, SourceFile>;
  themeColor?: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
}

interface TabData {
  path: string;
  highlightedCodeLight: string;
  highlightedCodeDark: string;
  isLoading: boolean;
}

// Build a file tree from flat file paths
function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  
  for (const path of paths) {
    // Handle paths that may start with "/" or not
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const parts = normalizedPath.split('/').filter(p => p.length > 0);
    let current = root;
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = `${currentPath}/${part}`;
      const isDirectory = i < parts.length - 1;
      
      let existing = current.find(n => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isDirectory,
          children: []
        };
        current.push(existing);
      }
      current = existing.children;
    }
  }
  
  // Sort: directories first, then files, both alphabetically
  const sortTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    }).map(node => ({
      ...node,
      children: sortTree(node.children)
    }));
  };
  
  return sortTree(root);
}

// Get file extension for language detection
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'sol': 'solidity',
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'tsx',
    'jsx': 'jsx',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'yml': 'yaml',
    'yaml': 'yaml',
    'toml': 'toml',
    'sh': 'bash',
    'bash': 'bash',
    'txt': 'plaintext',
  };
  return langMap[ext] || 'plaintext';
}

// File tree item component
function FileTreeItem({ 
  node, 
  selectedFile, 
  onSelect, 
  level = 0,
  expandedFolders,
  onToggleFolder,
  themeColor
}: { 
  node: FileTreeNode; 
  selectedFile: string | null;
  onSelect: (path: string) => void;
  level?: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  themeColor: string;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const normalizedSelectedFile = selectedFile ? (selectedFile.startsWith('/') ? selectedFile : `/${selectedFile}`) : null;
  const isSelected = normalizedSelectedFile === node.path;
  
  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="w-full flex items-center gap-1 px-2 py-0.5 text-[13px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                selectedFile={selectedFile}
                onSelect={onSelect}
                level={level + 1}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                themeColor={themeColor}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1 px-2 py-0.5 text-[13px] transition-colors cursor-pointer ${
        isSelected 
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100' 
          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
      }`}
      style={{ paddingLeft: `${level * 12 + 28}px` }}
    >
      <FileCode className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// Normalize a path to always start with /
function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export default function SourceCodeViewer({
  sources,
  themeColor = "#E57373",
}: SourceCodeViewerProps) {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [tabData, setTabData] = useState<Record<string, TabData>>({});
  const [explorerWidth, setExplorerWidth] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const codeContentRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<Set<string>>(new Set());

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const filePaths = useMemo(() => Object.keys(sources), [sources]);
  const fileTree = useMemo(() => buildFileTree(filePaths), [filePaths]);
  
  // Map normalized paths back to original paths
  const pathMap = useMemo(() => {
    const map: Record<string, string> = {};
    filePaths.forEach(path => {
      map[normalizePath(path)] = path;
    });
    return map;
  }, [filePaths]);
  
  // Get source content using either normalized or original path
  const getSource = useCallback((path: string) => {
    return sources[path] || sources[pathMap[path]] || sources[normalizePath(path)];
  }, [sources, pathMap]);
  
  // Auto-select first file and expand all folders on mount
  useEffect(() => {
    if (filePaths.length > 0 && openTabs.length === 0) {
      // Normalize the first file path to match file tree paths
      const firstFile = normalizePath(filePaths[0]);
      setOpenTabs([firstFile]);
      setActiveTab(firstFile);
      // Expand all parent folders
      const allFolders = new Set<string>();
      filePaths.forEach(path => {
        const normalizedPath = normalizePath(path);
        const parts = normalizedPath.split('/').filter(p => p.length > 0);
        let current = '';
        for (let i = 0; i < parts.length - 1; i++) {
          current = `${current}/${parts[i]}`;
          allFolders.add(current);
        }
      });
      setExpandedFolders(allFolders);
    }
  }, [filePaths, openTabs.length]);

  // Highlight code when tab becomes active (generate both light and dark versions)
  useEffect(() => {
    if (!activeTab) return;
    
    const source = getSource(activeTab);
    if (!source) return;
    
    // Check if already loading or loaded
    if (loadingRef.current.has(activeTab)) return;
    
    setTabData(prev => {
      // Check if already loaded
      if (prev[activeTab]?.highlightedCodeLight && prev[activeTab]?.highlightedCodeDark) {
        return prev;
      }
      return {
        ...prev,
        [activeTab]: { path: activeTab, highlightedCodeLight: '', highlightedCodeDark: '', isLoading: true }
      };
    });
    
    loadingRef.current.add(activeTab);

    const highlightCode = async () => {
      try {
        const language = getLanguage(activeTab);
        const [htmlLight, htmlDark] = await Promise.all([
          codeToHtml(source.content, { lang: language, theme: 'github-light' }),
          codeToHtml(source.content, { lang: language, theme: 'github-dark' }),
        ]);
        setTabData(prev => ({
          ...prev,
          [activeTab]: { path: activeTab, highlightedCodeLight: htmlLight, highlightedCodeDark: htmlDark, isLoading: false }
        }));
      } catch (err) {
        console.error('Syntax highlighting failed:', err);
        setTabData(prev => ({
          ...prev,
          [activeTab]: { path: activeTab, highlightedCodeLight: '', highlightedCodeDark: '', isLoading: false }
        }));
      } finally {
        loadingRef.current.delete(activeTab);
      }
    };

    highlightCode();
  }, [activeTab, getSource]);

  // Reset scroll position when tab changes
  useEffect(() => {
    if (codeContentRef.current) {
      codeContentRef.current.scrollTop = 0;
      codeContentRef.current.scrollLeft = 0;
    }
  }, [activeTab]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const openFile = (path: string) => {
    if (!openTabs.includes(path)) {
      setOpenTabs(prev => [...prev, path]);
    }
    setActiveTab(path);
  };

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t !== path);
    setOpenTabs(newTabs);
    
    if (activeTab === path) {
      // Switch to another tab or null
      const currentIndex = openTabs.indexOf(path);
      const newActiveTab = newTabs[Math.min(currentIndex, newTabs.length - 1)] || null;
      setActiveTab(newActiveTab);
    }
    
    // Clean up tab data
    setTabData(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  // Download all source files as zip
  const downloadAsZip = useCallback(async () => {
    const zip = new JSZip();
    
    // Add each file to the zip
    for (const [path, source] of Object.entries(sources)) {
      // Remove leading slash for zip file paths
      const zipPath = path.startsWith('/') ? path.slice(1) : path;
      zip.file(zipPath, source.content);
    }
    
    // Generate the zip file
    const blob = await zip.generateAsync({ type: 'blob' });
    
    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contract-source.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sources]);

  // Resizing logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      setExplorerWidth(Math.max(150, Math.min(400, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const activeSource = activeTab ? getSource(activeTab) : null;
  const currentContent = activeSource?.content || '';
  const currentTabData = activeTab ? tabData[activeTab] : null;
  const highlightedCode = isDarkMode ? currentTabData?.highlightedCodeDark : currentTabData?.highlightedCodeLight;

  return (
    <div 
      ref={containerRef}
      className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg min-h-[400px] max-h-[600px] overflow-hidden"
      style={{ cursor: isResizing ? 'col-resize' : 'default' }}
    >
      {/* Code Editor - Left Side */}
      <div className="flex-1 flex flex-col min-w-0">
        {openTabs.length > 0 ? (
          <>
            {/* Tab Bar - Chrome Style */}
            <div className="flex items-end bg-zinc-100 dark:bg-zinc-800 pt-2 px-2">
              <div className="flex-1 flex items-end gap-0.5 overflow-x-auto">
                {openTabs.map((tabPath) => (
                  <div
                    key={tabPath}
                    onClick={() => setActiveTab(tabPath)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-mono cursor-pointer rounded-t-lg transition-colors ${
                      activeTab === tabPath 
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 flex-shrink-0" style={{ color: activeTab === tabPath ? themeColor : undefined }} />
                    <span className="truncate max-w-[120px]">{tabPath.split('/').pop()}</span>
                    {openTabs.length > 1 && (
                      <button
                        onClick={(e) => closeTab(tabPath, e)}
                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Toggle Explorer Button */}
              <button
                onClick={() => setExplorerVisible(!explorerVisible)}
                className="flex items-center justify-center w-8 h-8 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer mb-0.5"
                title={explorerVisible ? 'Hide Explorer' : 'Show Explorer'}
              >
                {explorerVisible ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Breadcrumb */}
            {activeTab && (
              <div className="px-3 py-1 text-[11px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 font-mono truncate">
                {activeTab}
              </div>
            )}

            {/* Code Content */}
            <div ref={codeContentRef} className="flex-1 overflow-auto bg-white dark:bg-zinc-900">
              {!activeTab ? (
                <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-sm">
                  Select a file to view
                </div>
              ) : currentTabData?.isLoading ? (
                <div className="flex items-center justify-center h-32 text-zinc-500 dark:text-zinc-400 text-sm">
                  Loading...
                </div>
              ) : (
                <div className="text-[13px] font-mono overflow-auto p-3">
                  {highlightedCode ? (
                    <div 
                      className="shiki-container"
                      dangerouslySetInnerHTML={{ __html: highlightedCode }}
                    />
                  ) : (
                    <pre className="text-zinc-800 dark:text-zinc-200 m-0 whitespace-pre-wrap break-words">
                      {currentContent}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 text-sm gap-3 bg-white dark:bg-zinc-900">
            <span>Select a file to view its contents</span>
            {!explorerVisible && (
              <button
                onClick={() => setExplorerVisible(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
              >
                <PanelRightOpen className="w-4 h-4" />
                Show Explorer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resize Handle - Only show when explorer is visible */}
      {explorerVisible && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-500 cursor-col-resize flex items-center justify-center group transition-colors"
        >
          <GripVertical className="w-3 h-3 text-zinc-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* File Explorer - Right Side */}
      {explorerVisible && (
        <div 
          className="flex-shrink-0 flex flex-col bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700"
          style={{ width: explorerWidth }}
        >
          {/* Explorer Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Explorer
            </span>
            <button
              onClick={downloadAsZip}
              className="flex items-center justify-center w-6 h-6 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
              title="Download all files as ZIP"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* File Tree */}
          <div className="flex-1 overflow-y-auto py-1">
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                selectedFile={activeTab}
                onSelect={openFile}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                themeColor={themeColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Shiki styles */}
      <style jsx global>{`
        .shiki-container pre {
          background: transparent !important;
          margin: 0;
          padding: 0;
        }
        .shiki-container code {
          display: block;
        }
      `}</style>
    </div>
  );
}
