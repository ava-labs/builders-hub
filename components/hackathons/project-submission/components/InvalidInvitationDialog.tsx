import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { EventsLang, t } from "@/lib/events/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface InvalidInvitationProps {
    open: boolean;
    hackathonId: string;
    onOpenChange: (open: boolean) => void;
    lang?: EventsLang;
}

export default function InvalidInvitationComponent({ open, hackathonId, onOpenChange, lang = "en" }: InvalidInvitationProps) {
    const router = useRouter();
    const { toast } = useToast();
    const wasActionTaken = useRef(false);

    useEffect(() => {
        if (open) {
            wasActionTaken.current = false;
        }
    }, [open]);

    const handleAccept = () => {
        wasActionTaken.current = true;
        router.push(`/events/${hackathonId}`);
        onOpenChange(false);
    };

    const handleClose = (open: boolean) => {
        if (!open && !wasActionTaken.current) {
            toast({
                title: t(lang, "invitation.invalid.redirecting"),
                description: t(lang, "invitation.invalid.redirectDesc"),
                duration: 3000,
            });
            setTimeout(() => {
                router.push(`/events/${hackathonId}`);
            }, 1000);
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                hideCloseButton={true}
                className="dark:bg-zinc-900 dark:text-white rounded-lg p-6 w-full max-w-md border border-zinc-400 px-4"
            >
                <DialogClose asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-6 right-4 dark:text-white hover:text-red-400 p-0 h-6 w-6"
                        onClick={() => onOpenChange(false)}
                    >
                        ✕
                    </Button>
                </DialogClose>
                <DialogHeader />
                <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
                    <div className="flex flex-col px-6">
                        <p className="text-md dark:text-white text-gray-700">
                            {t(lang, "invitation.invalid.message")}
                        </p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-4">
                        <Button
                            onClick={handleAccept}
                            className="dark:bg-white dark:text-black"
                        >
                            {t(lang, "invitation.invalid.accept")}
                        </Button>
                    </div>
                </Card>
            </DialogContent>
        </Dialog>
    );
}
