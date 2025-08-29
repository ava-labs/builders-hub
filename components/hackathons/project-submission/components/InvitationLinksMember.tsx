import { useToast } from '@/hooks/use-toast';

export const InvitationLinksMember = ({invitationResult}:{invitationResult:any}) => {
    const { toast } = useToast();
  return (
    <ul className="space-y-2">
                    {invitationResult?.InviteLinks?.map((link: any) => (
                      <li key={link.User}>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                link.Invitation
                              );

                              toast({
                                title: "Copied!",
                                description:
                                  "Invitation link copied to clipboard",
                              });
                            } catch (err) {
                              console.error("Failed to copy link:", err);
                              toast({
                                title: "Copy failed",
                                description: "Could not copy link to clipboard",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="flex items-center justify-between w-full p-3 text-left bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
                          title="Click to copy invitation link"
                        >
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {link.User}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Click to copy link
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

  )
}
