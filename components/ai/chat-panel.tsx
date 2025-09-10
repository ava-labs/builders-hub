'use client';
import { useChat } from '@ai-sdk/react';
import { Maximize2, Send, Sparkles, StopCircle, X, RefreshCw, HelpCircle, Minimize2 } from 'lucide-react';
import { DialogClose, DialogTitle } from '@radix-ui/react-dialog';
import { cn } from '../../lib/cn';
import { buttonVariants } from '../ui/button';
import { ChatContext, useChatContext } from './context';
import { FormHTMLAttributes, HTMLAttributes, TextareaHTMLAttributes, useEffect, useRef, useState } from 'react';
import { Message } from './chat-message';
import React from 'react';

function SearchAIActions() {
  const { messages, status, setMessages, reload } = useChatContext();
  const isLoading = status === 'streaming';

  if (messages.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4 border-t border-fd-border/50">
      {!isLoading && messages.at(-1)?.role === 'assistant' && (
        <button
          type="button"
          className={cn(
            buttonVariants({
              variant: 'ghost',
              size: 'sm',
            }),
            'text-fd-muted-foreground hover:text-fd-foreground gap-1.5',
          )}
          onClick={() => reload()}
        >
          <RefreshCw className="size-3.5" />
          Regenerate
        </button>
      )}
      <button
        type="button"
        className={cn(
          buttonVariants({
            variant: 'ghost',
            size: 'sm',
          }),
          'text-fd-muted-foreground hover:text-fd-foreground',
        )}
        onClick={() => setMessages([])}
      >
        Clear Chat
      </button>
    </div>
  );
}

function Input(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [props.value]);

  return (
    <textarea
      ref={textareaRef}
      id="nd-ai-input"
      className={cn(
        'flex-1 resize-none bg-transparent px-4 py-3',
        'placeholder:text-fd-muted-foreground focus:outline-none',
        'min-h-[48px] max-h-[200px] leading-relaxed',
        props.className,
      )}
      rows={1}
      {...props}
    />
  );
}

function SearchAIInput(props: FormHTMLAttributes<HTMLFormElement>) {
  const { status, input, setInput, handleSubmit, stop } = useChatContext();
  const isLoading = status === 'streaming' || status === 'submitted';
  const onStart = (e?: React.FormEvent) => {
    e?.preventDefault();
    handleSubmit(e);
  };

  useEffect(() => {
    if (isLoading) document.getElementById('nd-ai-input')?.focus();
  }, [isLoading]);

  return (
    <form
      {...props}
      className={cn(
        'flex items-center gap-3 px-4 pb-4 pt-3 border-t border-fd-border/50',
        props.className,
      )}
      onSubmit={onStart}
    >
      <div className="flex-1 relative flex items-end bg-fd-muted/50 rounded-xl border border-fd-border/50 focus-within:border-fd-ring transition-all">
        <Input
          value={input}
          placeholder="Message AI Assistant..."
          disabled={status === 'streaming' || status === 'submitted'}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onKeyDown={(event) => {
            if (!event.shiftKey && event.key === 'Enter') {
              onStart();
              event.preventDefault();
            }
          }}
        />
        <button
          type={isLoading ? 'button' : 'submit'}
          className={cn(
            'mb-[7px] mr-2 p-1.5 rounded-lg transition-all shrink-0',
            isLoading 
              ? 'bg-fd-background hover:bg-fd-muted text-fd-foreground border border-fd-border' 
              : input.length > 0 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'text-fd-muted-foreground cursor-not-allowed hover:text-fd-muted-foreground/70',
          )}
          disabled={!isLoading && input.length === 0}
          onClick={isLoading ? stop : undefined}
        >
          {isLoading ? (
            <StopCircle className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </div>
    </form>
  );
}

function List(props: Omit<HTMLAttributes<HTMLDivElement>, 'dir'>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    function callback() {
      const container = containerRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }

    const observer = new ResizeObserver(callback);
    callback();

    const element = containerRef.current?.firstElementChild;

    if (element) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      {...props}
      className={cn(
        'fd-scroll-container overflow-y-auto flex-1 min-h-0',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function SmallViewContent({ onExpand }: { onExpand: () => void }) {
  const [selectedModel, setSelectedModel] = useState<'anthropic' | 'openai'>('anthropic');
  
  const chat = useChat({
    id: 'search',
    streamProtocol: 'data',
    sendExtraMessageFields: true,
    body: {
      model: selectedModel,
    },
    onResponse(response) {
      if (response.status === 401) {
        console.error(response.statusText);
      }
    },
  });

  const messages = chat.messages.filter((msg) => msg.role !== 'system');
  const { status } = chat;

  return (
    <ChatContext.Provider value={chat}>
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-red-600" />
          <DialogTitle className="text-sm font-semibold">AI Assistant</DialogTitle>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onExpand}
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'size-7 rounded-md',
            )}
            aria-label="Expand to full view"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <DialogClose
            aria-label="Close"
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'size-7 rounded-md',
            )}
          >
            <X className="size-3.5" />
          </DialogClose>
        </div>
      </div>
      
      <List className="flex-1">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto size-10 rounded-full bg-fd-muted/50 flex items-center justify-center">
                <Sparkles className="size-5 text-red-600" />
              </div>
              <h3 className="text-sm font-medium">How can I help?</h3>
              <p className="text-xs text-fd-muted-foreground">
                Ask me anything about Avalanche
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-fd-border">
            {messages.map((item, index) => (
              <Message 
                key={item.id} 
                message={item} 
                isLast={index === messages.length - 1}
                onFollowUpClick={async (question) => {
                  await chat.append({
                    content: question,
                    role: 'user',
                  });
                }}
                isStreaming={status === 'streaming' && index === messages.length - 1 && item.role === 'assistant'}
              />
            ))}
            {status === 'streaming' && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 px-4 py-4 bg-fd-muted/30 message-streaming">
                <div className="flex size-6 shrink-0 items-center justify-center">
                  <Sparkles className="size-4 text-red-600" />
                </div>
                <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
                  <div className="flex gap-1">
                    <span className="size-2 rounded-full bg-red-600/60 animate-pulse [animation-delay:-0.4s]"></span>
                    <span className="size-2 rounded-full bg-red-600/60 animate-pulse [animation-delay:-0.2s]"></span>
                    <span className="size-2 rounded-full bg-red-600/60 animate-pulse"></span>
                  </div>
                  <span className="text-xs">AI is thinking...</span>
                </div>
              </div>
            )}
          </div>
        )}
        {messages.length > 0 && <SearchAIActions />}
      </List>
      
      <SearchAIInput className="px-3 pb-3 pt-2" />
      
      <div className="px-3 py-2 text-center">
        <p className="text-[10px] text-fd-muted-foreground flex items-center justify-center gap-1">
          Powered by
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'anthropic' | 'openai')}
            className={cn(
              "text-[10px] px-1 py-0.5 rounded border border-fd-border/50",
              "bg-fd-background hover:bg-fd-muted/50",
              "focus:outline-none focus:ring-1 focus:ring-red-600/20",
              "transition-colors cursor-pointer",
              "-my-0.5" // Align with text
            )}
            disabled={status === 'streaming'}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
          • Responses may be inaccurate
        </p>
      </div>
    </ChatContext.Provider>
  );
}

export function Content({ onToolReference, onCollapse }: { onToolReference?: (consolePath: string) => void; onCollapse?: () => void }) {
  const [selectedModel, setSelectedModel] = useState<'anthropic' | 'openai'>('anthropic');
  
  const chat = useChat({
    id: 'search',
    streamProtocol: 'data',
    sendExtraMessageFields: true,
    body: {
      model: selectedModel,
    },
    onResponse(response) {
      if (response.status === 401) {
        console.error(response.statusText);
      }
    },
  });

  const messages = chat.messages.filter((msg) => msg.role !== 'system');
  const { status, append } = chat;
  const isLoading = status === 'streaming';

  const suggestedQuestions = [
    "How do I create a custom L1?",
    "How do I setup a block explorer for my L1?",
    "How do I setup a node?",
    "Where can I get testnet AVAX?",
    "Explain Avalanche's consensus mechanism",
    "What is the primary network?",
    "How do I setup ICTT?",
  ];

  const handleSuggestionClick = async (question: string) => {
    await append({
      content: question,
      role: 'user',
    });
  };

  return (
    <ChatContext.Provider value={chat}>
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-red-600" />
          <DialogTitle className="text-lg font-semibold">AI Assistant</DialogTitle>
        </div>
        <div className="flex items-center gap-1">
          {onCollapse && (
            <button
              onClick={onCollapse}
              className={cn(
                buttonVariants({ size: 'icon', variant: 'ghost' }),
                'size-8 rounded-md',
              )}
              aria-label="Collapse to small view"
            >
              <Minimize2 className="size-4" />
            </button>
          )}
          <DialogClose
            aria-label="Close"
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'size-8 rounded-md',
            )}
          >
            <X className="size-4" />
          </DialogClose>
        </div>
      </div>
      
      <List className="flex-1">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-2xl">
              <div className="space-y-4">
                <div className="mx-auto size-12 rounded-full bg-fd-muted/50 flex items-center justify-center">
                  <Sparkles className="size-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium">How can I help you today?</h3>
                <p className="text-sm text-fd-muted-foreground">
                  Ask me anything about the documentation or get help with your code.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(question)}
                    className={cn(
                      "group relative p-4 rounded-xl border border-fd-border/50 bg-fd-card",
                      "hover:border-red-600/50 hover:bg-red-50 dark:hover:bg-red-950/50 hover:shadow-md",
                      "transition-all duration-200 ease-out transform hover:scale-[1.02]",
                      "text-left text-sm overflow-hidden"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-fd-muted/50 transition-all duration-200">
                        <HelpCircle className="size-4 text-red-600 transition-colors duration-200" />
                      </div>
                      <span className="flex-1 text-fd-foreground/80 group-hover:text-fd-foreground leading-relaxed transition-colors duration-200">
                        {question}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-fd-border">
            {messages.map((item, index) => (
              <Message 
                key={item.id} 
                message={item} 
                isLast={index === messages.length - 1}
                onFollowUpClick={handleSuggestionClick}
                isStreaming={isLoading && index === messages.length - 1 && item.role === 'assistant'}
                onToolReference={onToolReference}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-4 px-4 py-6 bg-fd-muted/30 message-streaming">
                <div className="flex size-8 shrink-0 items-center justify-center">
                  <Sparkles className="size-5 text-red-600" />
                </div>
                <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                  <div className="flex gap-1">
                    <span className="size-2.5 rounded-full bg-red-600/60 animate-pulse [animation-delay:-0.4s]"></span>
                    <span className="size-2.5 rounded-full bg-red-600/60 animate-pulse [animation-delay:-0.2s]"></span>
                    <span className="size-2.5 rounded-full bg-red-600/60 animate-pulse"></span>
                  </div>
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </div>
            )}
          </div>
        )}
        {messages.length > 0 && <SearchAIActions />}
      </List>
      
      <SearchAIInput />
      
      <div className="px-4 py-2 text-center">
        <p className="text-xs text-fd-muted-foreground flex items-center justify-center gap-1">
          Powered by
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'anthropic' | 'openai')}
            className={cn(
              "text-xs px-1.5 py-0.5 rounded border border-fd-border/50",
              "bg-fd-background hover:bg-fd-muted/50",
              "focus:outline-none focus:ring-1 focus:ring-red-600/20",
              "transition-colors cursor-pointer",
              "-my-0.5" // Align with text
            )}
            disabled={isLoading}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
          • Responses may be inaccurate
        </p>
      </div>
    </ChatContext.Provider>
  );
}
