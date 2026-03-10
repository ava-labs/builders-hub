'use client'

import { Divider } from "@/components/ui/divider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetHackathons } from "@/hooks/use-get-hackathons";
import { Notification } from "@/types/notifications";
import { sendNotifications } from "@/utils/send-notification";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "../ui/toaster";
import { Spinner } from "@/components/ui/spinner"
import ReactMarkdown from "react-markdown";
import DOMPurify from "isomorphic-dompurify";
import remarkGfm from "remark-gfm";
import { useNotificationContentGuard } from "@/hooks/use-notification-content-guard";


type AudienceTab = "all" | "hackathons" | "custom";

const notificationsTypeOptions = [
  { value: "courseCompleted", label: "Course completed" },
  { value: "message", label: "Message" },
]

type DetectedContentType = "text/plain" | "text/markdown" | "text/html";

export function detectNotificationContentType(content: string): DetectedContentType {
  const trimmed: string = content.trim();

  if (!trimmed) {
    return "text/plain";
  }

  const htmlPattern: RegExp =
    /<([a-z][a-z0-9-]*)(\s[^>]*)?>[\s\S]*<\/\1>|<([a-z][a-z0-9-]*)(\s[^>]*)?\/?>/i;

  const markdownPattern: RegExp =
    /^(#{1,6}\s.+|>\s.+|[-*+]\s.+|\d+\.\s.+|```[\s\S]*```|`[^`]+`|\[.+\]\(.+\)|!\[.*\]\(.+\)|\*\*.+\*\*|__.+__|\*.+\*|_.+_)$/m;

  const looksLikeHtml: boolean = htmlPattern.test(trimmed);
  const looksLikeMarkdown: boolean = markdownPattern.test(trimmed);

  if (looksLikeHtml) {
    return "text/html";
  }

  if (looksLikeMarkdown) {
    return "text/markdown";
  }

  return "text/plain";
}

export default function SendNotificationsForm() {
  // Fields
  const [title, setTitle] = useState<string>("");
  const [shortDescription, setShortDescription] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [loading, setLoading] = useState(false)
  const [openAudienceDialog, setOpenAudienceDialog] = useState<boolean>(false);

  // Audience
  const [audienceTab, setAudienceTab] = useState<AudienceTab>("custom");
  const [selectedHackathons, setSelectedHackathons] = useState<string[]>([]);
  const [customUsersRaw, setCustomUsersRaw] = useState<string>("");
  const customUsersParsed: string[] = useMemo((): string[] => {
    return customUsersRaw
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }, [customUsersRaw]);
  const { toast } = useToast();
  const { data: hackathons } = useGetHackathons()
  const [sessionPayload, setSessionPayload] = useState<{ id: string, custom_attributes: string[] } | undefined>()
  const guardedContent = useNotificationContentGuard(content);

  const isValidForm = useMemo(() => {
    return (
      title &&
      type &&
      shortDescription &&
      content &&
      (audienceTab == 'all' || selectedHackathons.length > 0 || customUsersParsed.length > 0)
    )
  }, [title, content, selectedHackathons, audienceTab, customUsersParsed, guardedContent.isSafe]);


  const toggleHackathon = (hackathon: string): void => {
    setSelectedHackathons((prev: string[]) => {
      return prev.includes(hackathon)
        ? prev.filter((h: string) => h !== hackathon)
        : [...prev, hackathon];
    });
  };

  const buildBody = (): Notification[] => {
    return [
      {
        audience: {
          all: audienceTab === "all",
          hackathons: audienceTab == 'all' ? [] : selectedHackathons,
          users: audienceTab == 'all' ? [] : customUsersParsed,
        },
        type,
        title,
        short_description: shortDescription,
        content,
        content_type: guardedContent.detectedType,
      }
    ]
  };

  const send = async (): Promise<void> => {
    setLoading(true)
    const response = await sendNotifications(buildBody())
    toast({
      title: response.success ? 'Notification created' : 'Error at create notification',
      description: response.success ? 'Your notification has been successfully created.' : '',
    });
    setLoading(false)
  };

  useEffect(() => {
    const raw: string | null = localStorage.getItem("session_payload");

    if (raw === null) {
      setSessionPayload(undefined);
      return;
    }

    const payload: { id: string; custom_attributes: string[] } = JSON.parse(raw);
    setSessionPayload(payload);
  }, [openAudienceDialog]);

  return (
    <main className='container py-8 mx-auto min-h-[calc(100vh-92px)] lg:min-h-0 flex items-center justify-center relative px-2 pb-6 lg:px-14 '>
      <Toaster />
      <div className="w-full flex flex-col gap-4 items-end">
        <div className='w-full border shadow-sm rounded-md flex flex-col gap-8 py-14 px-8'>
          <div>
            <h1 className="text-2xl font-medium">Send notifications</h1>
            <p className="text-zinc-400">
              Create and send notifications to users. Make sure to complete all required information before sending them.
            </p>
            <Divider />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium">Title</h1>
            <Input
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder="Type the notification title"
            />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium">Short description</h1>
            <Input
              value={shortDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShortDescription(e.target.value)}
              placeholder="Type a short description"
            />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium">Type</h1>
            <Select value={type} onValueChange={(e) => setType(e)}>
              <SelectTrigger>
                <SelectValue placeholder="Select notification type" />
              </SelectTrigger>
              <SelectContent>
                {
                  notificationsTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>

          <div className="w-full flex flex-col gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <h1 className="text-xl font-medium">Content</h1>
              <div className="flex items-center gap-2">
                <Textarea
                  value={content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                  placeholder="Type a content"
                  className="custom-scroll h-20"
                />
              </div>
            </div>

            <div className="flex-1 w-full flex flex-col gap-2">
              <p className="text-xl font-medium">Content preview</p>
              <div className="custom-scroll p-4 min-h-20 overflow-y-auto border-2 bg-zinc-200 dark:bg-zinc-800 border-zinc-500 dark:border-zinc-500 rounded-lg dark:shadow-2xl">
                {
                  guardedContent.isSafe ? (

                (() => {
                  switch (guardedContent.detectedType) {
                    case "text/plain":
                      return content;

                    case "text/markdown":
                      return <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Keep styling consistent; customize as needed.
                          p: (props: React.ComponentPropsWithoutRef<"p">) => (
                            <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-6" {...props} />
                          ),
                          a: (props: React.ComponentPropsWithoutRef<"a">) => (
                            <a className="underline underline-offset-4" target="_blank" rel="noreferrer" {...props} />
                          ),
                          ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
                            <ul className="list-disc pl-5 space-y-1" {...props} />
                          ),
                          ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
                            <ol className="list-decimal pl-5 space-y-1" {...props} />
                          ),
                          code: (props: React.ComponentPropsWithoutRef<"code">) => (
                            <code className="px-1 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800/60" {...props} />
                          ),
                        }}
                      >
                        {content}
                      </ReactMarkdown>;
                    case "text/html": {
                      const sanitizedHtml: string = DOMPurify.sanitize(content);

                      return (
                        <div
                          className="prose prose-sm dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                        />
                      );
                    }


                    default:
                      return content;
                  }
                })()

                  ): (
                    <p>Unsafe content detected</p>
                  )
                }
              </div>
            </div>
          </div>


          {/* Si quieres cambiar "type" desde UI, agrega otro input/select aquí.
              Por ahora lo estás capturando con estado (default "n"). */}

          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-medium">Audience</h2>
            <Tabs
              value={audienceTab}
              onValueChange={(v: string) => setAudienceTab(v as AudienceTab)}
              className="w-full flex"
            >
              <TabsList className="mb-2">
                <TabsTrigger disabled={!sessionPayload?.custom_attributes.includes('devrel')} value="all">All</TabsTrigger>
                <TabsTrigger value="hackathons">Hackathons</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
              <div className="p-4 border border-border rounded-lg dark:shadow-2xl">
                <TabsContent value="all">
                  <div className="flex flex-col gap-4">

                    With this option, the notification will be sent to all users
                  </div>
                </TabsContent>

                <TabsContent value="hackathons">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4">
                      <div>
                        <p>
                          With this option, the notification will be sent to all users registered in the selected hackathons.
                        </p>
                        <Divider />
                      </div>
                      <div className="custom-scroll max-h-40 overflow-x-hidden overflow-y-auto flex flex-col gap-2">
                        {hackathons?.map((hackathon: { id: string, title: string }, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedHackathons.includes(hackathon.id)}
                              onCheckedChange={() => toggleHackathon(hackathon.id)}
                            />
                            <p>{hackathon.title}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {`${selectedHackathons.length} hackathon(s) selected, ${customUsersParsed.length > 0 ? `${customUsersParsed.length} email(s) parsed` : ''}`}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="custom">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div>
                        <p>
                          Enter the email addresses of the users you wish to send notifications to, separated by commas.
                        </p>
                        <Divider />
                      </div>
                      <Input
                        type="email"
                        value={customUsersRaw}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomUsersRaw(e.target.value)}
                        placeholder="email1@x.com, email2@x.com"
                      />
                      <p className="text-xs text-zinc-500">
                        {`Parsed: ${customUsersParsed.length} email(s)${selectedHackathons.length > 0 ? `, ${selectedHackathons.length} hackathon(s) selected` : ''}`}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </div>

            </Tabs>
          </div>
        </div>

        <Button onClick={send} disabled={!isValidForm || loading || !guardedContent.isSafe} className="bg-black dark:bg-white px-2 py-1 w-16 ">
          {
            loading ? (
              <Spinner data-icon="inline-center" />
            ) : (

              <p className="text-zinc-50 dark:text-zinc-900 text-sm font-medium">Send</p>
            )
          }
        </Button>
      </div>
    </main>
  )
}