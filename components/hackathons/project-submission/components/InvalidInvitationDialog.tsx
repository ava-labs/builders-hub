import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface InvalidInvitationProps {
    open: boolean;
    hackathonId: string;
    onOpenChange: (open: boolean) => void;
}

export default function InvalidInvitationComponent({open, hackathonId, onOpenChange}: InvalidInvitationProps) {
    const router = useRouter();
    const { toast } = useToast();
    const wasActionTaken = useRef(false);

    // Reset the flag when modal opens
    useEffect(() => {
        if (open) {
            wasActionTaken.current = false;
        }
    }, [open]);

    const handleAccept = () => {
        wasActionTaken.current = true; // Mark that an action was taken
        router.push(`/hackathons/${hackathonId}`);
        onOpenChange(false);
    };

    const handleClose = (open: boolean) => {
        // If modal is closing and no action was taken, show toast and redirect
        if (!open && !wasActionTaken.current) {
            toast({
                title: "Redirecting...",
                description: "You will be redirected to hackathon",
                duration: 3000,
            });
            
            // Small delay to show the toast before redirecting
            setTimeout(() => {
                router.push(`/hackathons/${hackathonId}`);
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
                        onClick={() => {
                            // This will trigger handleClose with open=false
                            onOpenChange(false);
                        }}
                    >
                        ✕
                    </Button>
                </DialogClose>
                <DialogHeader>
                
                </DialogHeader>
                <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
                    <div className="flex flex-col px-6">
                        <p className="text-md dark:text-white text-gray-700">
                            Invitation link is not valid, you will be redirect to hackathon
                        </p>
                    </div>
        
                    <div className="flex flex-col items-center justify-center gap-4 ">
                        <Button
                            onClick={handleAccept}
                            className="dark:bg-white dark:text-black"
                        >
                            Accept 
                        </Button>
                    </div>
                </Card>
            </DialogContent>
        </Dialog>
    );
}