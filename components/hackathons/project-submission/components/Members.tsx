"use client";
import { Button } from "@/components/ui/button";
import { BadgeCheck, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { projectProps } from "./SubmissionStep1";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { JoinTeamDialog } from "./JoinTeamDialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { ProjectMemberWarningDialog } from "./ProjectMemberWarningDialog";
import { useRouter, useSearchParams } from "next/navigation";
import { MemberStatus } from "@/types/project";
export default function MembersComponent({
  project_id,
  hackaton_id,
  user_id,
  onProjectCreated,
  onHandleSave,
  openjoinTeamDialog,
  onOpenChange,
  teamName,
  currentEmail,
  openCurrentProject,
  setOpenCurrentProject,
}: projectProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false); // State for modal
  const [emails, setEmails] = useState<string[]>([]); // State for email inputs
  const [newEmail, setNewEmail] = useState(""); // State for new email input
  const [invitationSent, setInvitationSent] = useState(false);
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [isValidingEmail, setIsValidingEmail] = useState(false);
  const roles: string[] = [
    "Member",
    "Developer",
    "PM",
    "Researcher",
    "Designer",
  ];

  const router = useRouter();
  const searchParams = useSearchParams();

  const handleAddEmail = () => {
    if (newEmail && !emails.includes(newEmail) && validateEmail(newEmail)) {
      setIsValidingEmail(true);
      setEmails((prev) => [...prev, newEmail]);
      setNewEmail("");
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email));
    setInvalidEmails(invalidEmails.filter((e) => e !== email));
  };

  const handleSendInvitations = async () => {
    if (emails.length === 0 || invalidEmails.length > 0) return;
    try {
      setSendingInvitation(true);
      if (onHandleSave) {
        await onHandleSave();
      }

      await axios.post(`/api/project/invite-member`, {
        emails: emails,
        hackathon_id: hackaton_id,
        project_id: project_id,
        user_id: user_id,
      });
      if ((!project_id || project_id === "") && onProjectCreated) {
        onProjectCreated();
      }

      setInvitationSent(true);

      const response = await axios.get(`/api/project/${project_id}/members`);
      setMembers(response.data);
    } catch (error) {
      console.error("Error sending invitations:", error);
    } finally {
      setSendingInvitation(false);
    }
  };

  const handleResendInvitation = async (email: string) => {
    try {
      await axios.post(`/api/project/invite-member`, {
        emails: [email],
        hackathon_id: hackaton_id,
        project_id: project_id,
        user_id: user_id,
      });
    } catch (error) {
      console.error("Error resending invitation:", error);
    }
  };

  const handleRemoveMember = async (email: string, id_user: string) => {
    try {
      await axios.patch(`/api/project/${project_id}/members/status`, {
        user_id: id_user,
        status: MemberStatus.REMOVED,
        email: email,
      });
      setMembers(members.filter((member) => member.email !== email));
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  const handleRoleChange = async (member: any, newRole: string) => {
    try {
      await axios.patch(`/api/project/${project_id}/members`, {
        member_id: member.id,
        role: newRole,
      });

      setMembers((prevMembers) =>
        prevMembers.map((m) =>
          m.id === member.id ? { ...m, role: newRole } : m
        )
      );
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const handleAcceptJoinTeam = async (result: boolean) => {
    if (result) {
      setMembers((prevMembers) =>
        prevMembers.map((m) =>
          m.user_id === user_id || m.email === currentEmail
            ? { ...m, status: MemberStatus.CONFIRMED }
            : m
        )
      );
    }
  };

  const handleAcceptJoinTeamWithPreviousProject = async (accepted: boolean) => {
    if(setOpenCurrentProject){
      setOpenCurrentProject(accepted);
    }
    if (!accepted) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("invitation");
     await updateMemberStatus(MemberStatus.REJECTED,false);
      router.push(`/hackathons/project-submission?${params.toString()}`);
      
      return;
    }
   await updateMemberStatus(MemberStatus.CONFIRMED,true);
   handleAcceptJoinTeam(true);

  };

  const updateMemberStatus = async (status: string,wasInOtherProject: boolean) => {
    try {
      axios
        .patch(`/api/project/${project_id}/members/status`, {
          user_id: user_id,
          status: status,
          wasInOtherProject: wasInOtherProject,
        })
        .then(() => {
          console.log("Status updated successfully");
        })
        .catch((error) => {
          console.error("Error updating status:", error);
        });
    
    } catch (error) {
      console.error("Error joining team:", error);
    }
  }

  useEffect(() => {
    if (!project_id) return;
    const fetchMembers = async () => {
      try {
        const response = await axios.get(`/api/project/${project_id}/members`);
        setMembers(response.data);
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };

    fetchMembers();
  }, [project_id]);

  return (
    <>
      <div className="flex justify-end mt-4">
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogTrigger asChild>
            <Button variant="outline" type="button">
              Invite Team Member
            </Button>
          </DialogTrigger>

          {!invitationSent ? (
            <DialogContent
              hideCloseButton={true}
              className="dark:bg-zinc-900 
                 dark:text-white rounded-lg p-6 w-full
                  max-w-md border border-zinc-400  px-4"
            >
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-6 right-4 dark:text-white hover:text-red-400 p-0 h-6 w-6"
                >
                  ✕
                </Button>
              </DialogClose>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Invite Member
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-400 mt-0 pt-0">
                  Enter the email addresses of the persons you want to invite to your team and then press <strong>Enter</strong>. When you've added all emails, click on <strong>Send Invitation</strong>.
                </DialogDescription>
              </DialogHeader>
              <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
                <div className="mt-2 mx-4 ">
                  <div
                    className="flex flex-wrap items-center gap-2 dark:bg-zinc-950 px-3  py-2 rounded-md min-h-[42px] focus-within:ring-2 focus-within:ring-zinc-600 border border-zinc-700"
                    onClick={() =>
                      document.getElementById("email-input")?.focus()
                    }
                  >
                    {emails.map((email) => (
                      <div
                        key={email}
                        className={`flex items-center bg-transparent text-white text-sm rounded-full px-2 py-1 ${
                          invalidEmails.includes(email)
                            ? "border border-red-500"
                            : ""
                        }`}
                      >
                        <span className="text-zinc-400">{email}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-2 h-4 w-4 text-zinc-400 hover:text-red-400 p-0"
                          onClick={() => handleRemoveEmail(email)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}

                    <input
                      id="email-input"
                      type="email"
                      value={newEmail}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          await handleAddEmail();
                        }
                      }}
                      placeholder={emails.length === 0 ? "Add email..." : ""}
                      className="  text-sm outline-none flex-1 min-w-[120px] py-1 px-3"
                    />
                  </div>
                  {invalidEmails.length > 0 && (
                    <p className="text-red-500 mb-2">
                      Some emails are not registered on the platform.
                    </p>
                  )}
                  <div className="flex justify-center mt-2">
                    <LoadingButton
                      isLoading={sendingInvitation}
                      loadingText="Sending..."
                      onClick={handleSendInvitations}
                      type="button"
                      disabled={emails.length === 0 || invalidEmails.length > 0}
                      className="dark:bg-white"
                    >
                      Send Invitation
                    </LoadingButton>
                  </div>
                </div>
              </Card>
            </DialogContent>
          ) : (
            <DialogContent
              className="dark:bg-zinc-900 
              dark:text-white rounded-lg p-6 w-full
               max-w-md border border-zinc-400  px-4"
              hideCloseButton={true}
            >
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-6 right-4 dark:text-white hover:text-red-400 p-0 h-6 w-6"
                >
                  ✕
                </Button>
              </DialogClose>
              <DialogTitle className="text-lg font-semibold">
                Invitation Sent!
              </DialogTitle>
              <Card className="border border-red-500 dark:bg-zinc-800 rounded-md mt-4">
                <div className="flex flex-col  px-4 py-2 gap-4">
                  <div className="flex items-center justify-center text-center">
                    <BadgeCheck width={35} height={35} color="#FF394A" />
                  </div>
                  <p className=" text-md ">
                    Invitation sent successfully to{" "}
                    <span className="font-semibold gap-2 text-md">
                      {emails.join("; ")}
                    </span>
                    . They will receive an email to join your team.
                  </p>
                  <div className="items-center justify-center text-center">
                    <DialogClose asChild>
                      <Button
                        onClick={() => {
                          setOpenModal(false);
                          setEmails([]);
                          setNewEmail("");
                          setInvitationSent(false);
                        }}
                        className="dark:bg-white border rounder-md max-w-16 "
                      >
                        Done
                      </Button>
                    </DialogClose>
                  </div>
                </div>
              </Card>
            </DialogContent>
          )}
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <Table className="border border-zinc-200 dark:border-zinc-800 w-full min-w-[500px]">
          <TableHeader>
            <TableRow className=" border-b-zinc-200 dark:border-b-zinc-800">
              <TableHead className="px-4 py-4">Name</TableHead>
              <TableHead className="px-4 py-4">Email</TableHead>
              <TableHead className="px-4 py-4">Role</TableHead>
              <TableHead className="px-4 py-4">Status</TableHead>
              <TableHead className="px-4 py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={index} className="dark:hover:bg-[#2c2c2c]">
                <TableCell className="px-4 py-4">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1 p-0 hover:bg-transparent"
                      >
                        {member.role}
                        <ChevronDown size={16} color="#71717a" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="dark:bg-zinc-800 rounded-md shadow-lg p-2"
                      sideOffset={5}
                    >
                      {roles.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          className="cursor-pointer p-2 dark:hover:bg-zinc-700"
                          onSelect={() => handleRoleChange(member, role)}
                        >
                          {role}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>{member.status}</TableCell>
                <TableCell>
                  {user_id !== member.user_id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal size={16} color="#71717a" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="dark:bg-zinc-800 dark:text-white rounded-md shadow-lg p-2"
                        sideOffset={5}
                      >
                        <DropdownMenuItem
                          className="p-2 hover:bg-zinc-700 cursor-pointer rounded"
                          onSelect={() => handleResendInvitation(member.email)}
                        >
                          Resend Invitation
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="p-2 hover:bg-zinc-700 cursor-pointer rounded text-red-400"
                          onSelect={() =>
                            handleRemoveMember(member.email, member.user_id)
                          }
                        >
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <JoinTeamDialog
        open={openjoinTeamDialog || false}
        onOpenChange={onOpenChange}
        setLoadData={handleAcceptJoinTeam}
        teamName={teamName as string}
        projectId={project_id as string}
        hackathonId={hackaton_id as string}
        currentUserId={user_id as string}
      />
      <ProjectMemberWarningDialog
        open={openCurrentProject || false}
        onOpenChange={setOpenCurrentProject || (() => {})}
        projectName={teamName as string}
        hackathonId={hackaton_id as string}
        setLoadData={handleAcceptJoinTeamWithPreviousProject}
      />
    </>
  );
}
