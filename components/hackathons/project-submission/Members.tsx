'use client'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";



export default function MembersComponent({project_id,hackaton_id,user_id,onProjectCreated}: projectProps) {
    const [members,setMembers]=useState<any[]>([])
    const [openModal, setOpenModal] = useState(false); // State for modal
    const [emails, setEmails] = useState<string[]>([]); // State for email inputs
    const [newEmail, setNewEmail] = useState(""); // State for new email input
    const [invitationSent, setInvitationSent] = useState(false);
    const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  

    
    const handleAddEmail = () => {
      if (newEmail && !emails.includes(newEmail) && validateEmail(newEmail)) {
        setEmails(prev => [...prev, newEmail]);
        checkEmailRegistered(newEmail)
          .then(isRegistered => {
            if (!isRegistered) {
              setInvalidEmails(prev => [...prev, newEmail]);
            }
          })
          .catch(err => {
            console.error("Error checking email registration:", err);
          });
        setNewEmail("");
      }
    };
    

      const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
    
      const checkEmailRegistered = async (email: string): Promise<boolean> => {
        try {

          const response = await axios.get(`/api/users/check?email=${encodeURIComponent(email)}`);
          return response.data.exists;
        } catch (error) {
          console.error("Error checking email registration:", error);
          return false;
        }
      };

      const handleRemoveEmail = (email: string) => {
        setEmails(emails.filter((e) => e !== email));
        setInvalidEmails(invalidEmails.filter((e) => e !== email));
      };

      const handleSendInvitations = async () => {
        if (emails.length === 0  || invalidEmails.length > 0) return;
        try {
           await axios.post(`/api/project/invite-member`,
             { emails:emails ,
              hackathon_id:hackaton_id,
               project_id :project_id,
               user_id:user_id}
            );
            if ((!project_id || project_id === "") && onProjectCreated) {
              onProjectCreated();
            }
          setInvitationSent(true);

          const response = await axios.get(`/api/project/${project_id}/members`);
          setMembers(response.data);
        } catch (error) {
          console.error("Error sending invitations:", error);
        }
      };

      const handleResendInvitation = async (email: string) => {
        try {
          await axios.post(`/api/project/invite-member`,
            { emails:[email] ,
             hackathon_id:hackaton_id,
              project_id :project_id,
              user_id:user_id}
           );
        
        } catch (error) {
          console.error("Error resending invitation:", error);
        }
      };
    

      const handleRemoveMember = async (email: string,id_user:string) => {
        try {
             await axios.patch(`/api/project/${project_id}/members/status`,
                  { user_id: id_user ,status: "Removed" });
          setMembers(members.filter((member) => member.email !== email));
        } catch (error) {
          console.error("Error removing member:", error);
        }
      };

      const handleRoleChange = async (member: any, newRole: string) => {
        try {
          await axios.patch(`/api/project/${project_id}/members`, { member_id: member.id, role: newRole });
 
          setMembers((prevMembers) =>
            prevMembers.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
          );
      
        } catch (error) {
          console.error("Error updating role:", error);
        }
      };


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
                    Enter the email addresses of the persons you want to invite
                    to your team.
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
                      <Button
                        onClick={handleSendInvitations}
                        disabled={emails.length === 0}
                        className="dark:bg-white"
                      >
                        Send Invitation
                      </Button>
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

        {/* Tabla con scroll horizontal en pantallas pequeñas */}
        <div className="overflow-x-auto">
          <Table className="border border-[#333] w-full min-w-[500px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member, index) => (
                <TableRow key={index} className="dark:hover:bg-[#2c2c2c]">
                  <TableCell>{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1 p-0  hover:bg-transparent"
                        >
                          {member.role}
                          <ChevronDown size={16} color="#71717a" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="dark:bg-zinc-800  rounded-md shadow-lg p-2"
                        sideOffset={5}
                      >
                        <DropdownMenuItem
                          className="cursor-pointer p-2 dark:hover:bg-zinc-700"
                          onSelect={() => handleRoleChange(member, "member")}
                        >
                          member
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer p-2 dark:hover:bg-zinc-700"
                          onSelect={() => handleRoleChange(member, "developer")}
                        >
                          developer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer p-2 dark:hover:bg-zinc-700"
                          onSelect={() => handleRoleChange(member, "PM")}
                        >
                          PM
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer p-2 dark:hover:bg-zinc-700"
                          onSelect={() =>
                            handleRoleChange(member, "Researcher")
                          }
                        >
                          Researcher
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>{member.status}</TableCell>
                  <TableCell>
                    {(user_id !== member.user_id  ) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal size={16} color="#71717a" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="bg-zinc-800 text-white rounded-md shadow-lg p-2"
                          sideOffset={5}
                        >
                          <DropdownMenuItem
                            className="p-2 hover:bg-zinc-700 cursor-pointer rounded"
                            onSelect={() =>
                              handleResendInvitation(member.email)
                            }
                          >
                            Resend Invitation
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="p-2 hover:bg-zinc-700 cursor-pointer rounded text-red-400"
                            onSelect={() => handleRemoveMember(member.email,member.user_id)}
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

      </>
    );
}