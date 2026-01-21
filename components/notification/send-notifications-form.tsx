'use client'

import { Divider } from "@/components/ui/divider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetHackathons } from "@/hooks/use-get-hackathons";

type AudienceTab = "all" | "hackathons" | "custom";

type CreateNotificationBody = {
  notifications: Array<{
    audience: {
      all: boolean;
      hackathons: string[];
      users: string[];
    };
    type: string;
    title: string;
    short_description: string;
    content: string;
    content_type: string;
  }>;
};

export default function SendNotificationsForm() {
  // Fields
  const [title, setTitle] = useState<string>("");
  const [shortDescription, setShortDescription] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [contentType, setContentType] = useState<string>("");
  const [type, setType] = useState<string>("default");
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

  const { data: hackathons } = useGetHackathons()

  const isValidForm = useMemo(() => {
    return (
      title &&
      content &&
      contentType &&
      (audienceTab == 'all' || selectedHackathons.length > 0 || customUsersParsed.length > 0)
    )
  }, [title, content, contentType, selectedHackathons, audienceTab, customUsersParsed]);


  const toggleHackathon = (hackathon: string): void => {
    setSelectedHackathons((prev: string[]) => {
      return prev.includes(hackathon)
        ? prev.filter((h: string) => h !== hackathon)
        : [...prev, hackathon];
    });
  };

  const buildBody = (): CreateNotificationBody => {
    return {
      notifications: [
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
          content_type: contentType,
        }
      ]
    };
  };

  const send = async (): Promise<void> => {
    try {
      const body: CreateNotificationBody = buildBody();

      const response: Response = await fetch(`/api/notifications/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text: string = await response.text();
        throw new Error(text || "Failed to create notifications");
      }

    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
    <main className='container py-8 mx-auto min-h-[calc(100vh-92px)] lg:min-h-0 flex items-center justify-center relative px-2 pb-6 lg:px-14 '>
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
            <h1 className="text-xl font-medium">Content type</h1>
            <Select value={contentType} onValueChange={(e) => setContentType(e)}>
              <SelectTrigger>
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text/plain">text/plain</SelectItem>
                <SelectItem value="text/markdown">text/markdown</SelectItem>
                <SelectItem value="text/html">text/html</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium">Content</h1>
            <Textarea
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              placeholder="Type a content"
            />
          </div>


          {/* Si quieres cambiar "type" desde UI, agrega otro input/select aquí.
              Por ahora lo estás capturando con estado (default "n"). */}

          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-medium">Audience</h2>

            <Dialog open={openAudienceDialog} onOpenChange={() => setOpenAudienceDialog(!openAudienceDialog)}>
              <DialogTrigger className="bg-black dark:bg-white rounded-md px-2 py-1 w-20">
                <p className="text-zinc-50 dark:text-zinc-900 text-sm font-medium">Select</p>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Select your notification audience</DialogTitle>
                  <DialogDescription>
                    <Tabs
                      value={audienceTab}
                      onValueChange={(v: string) => setAudienceTab(v as AudienceTab)}
                      className="w-full flex items-center my-2"
                    >
                      <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="hackathons">Hackathons</TabsTrigger>
                        <TabsTrigger value="custom">Custom</TabsTrigger>
                      </TabsList>

                      <TabsContent value="all">
                        <div className="flex flex-col gap-4 items-center">

                          With this option, the notification will be sent to all users
                          <Button onClick={() => setOpenAudienceDialog(false)} className="bg-black dark:bg-white px-2 py-1 w-20 ">
                            <p className="text-zinc-50 dark:text-zinc-900 text-sm font-medium">Apply</p>
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="hackathons">
                        <div className="flex flex-col gap-4 items-center">
                          <div className="flex flex-col gap-4">
                            <p>
                              With this option, the notification will be sent to all users registered in the selected hackathons.
                            </p>
                            <div className="custom-scroll max-h-[160px] overflow-x-hidden overflow-y-auto flex flex-col gap-2">
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
                          </div>
                          <Button onClick={() => setOpenAudienceDialog(false)} className="bg-black dark:bg-white px-2 py-1 w-20 ">
                            <p className="text-zinc-50 dark:text-zinc-900 text-sm font-medium">Apply</p>
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="custom">
                        <div className="flex flex-col gap-4 items-center">
                          <div className="flex flex-col gap-2">
                            <p>
                              Enter the email addresses of the users you wish to send notifications to, separated by commas.
                            </p>
                            <Input
                              type="email"
                              value={customUsersRaw}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomUsersRaw(e.target.value)}
                              placeholder="email1@x.com, email2@x.com"
                            />
                            <p className="text-xs text-zinc-500">
                              Parsed: {customUsersParsed.length} email(s)
                            </p>
                          </div>
                          <Button onClick={() => setOpenAudienceDialog(false)} className="bg-black dark:bg-white px-2 py-1 w-20 ">
                            <p className="text-zinc-50 dark:text-zinc-900 text-sm font-medium">Apply</p>
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Button onClick={send} disabled={!isValidForm} className="bg-black dark:bg-white px-2 py-1 w-16 ">
          <p className="text-zinc-50 dark:text-zinc-900 text-sm font-medium">Send</p>
        </Button>
      </div>
    </main>
  )
}