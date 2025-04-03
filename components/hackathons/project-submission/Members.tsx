'use client'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BadgeCheck, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { projectProps } from "./SubmissionStep1";
import axios from "axios";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"; // For the dropdown
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

export default function MembersComponent({ project_id }: projectProps){
    const [members,setMembers]=useState<any[]>([])
    const [openModal, setOpenModal] = useState(false); // State for modal
    const [emails, setEmails] = useState<string[]>([]); // State for email inputs
    const [newEmail, setNewEmail] = useState(""); // State for new email input
    const [invitationSent, setInvitationSent] = useState(false);


    
      const handleAddEmail = () => {
        if (newEmail && !emails.includes(newEmail) && validateEmail(newEmail)) {
          setEmails([...emails, newEmail]);
          setNewEmail(""); // Clear the input after adding
        }
      };
    
      // Function to validate email format
      const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
    
      // Function to remove an email from the array
      const handleRemoveEmail = (email: string) => {
        setEmails(emails.filter((e) => e !== email));
      };
    
      // Function to handle sending invitations
      const handleSendInvitations = async () => {
        if (emails.length === 0) return;
        try {
          // await axios.post(`/api/project/${project_id}/invite`, { emails });
        
          setInvitationSent(true);
          // Refetch members to update the table
          const response = await axios.get(`/api/project/${project_id}/members`);
          setMembers(response.data);
        } catch (error) {
          console.error("Error sending invitations:", error);
        }
      };
    
      // Function to resend invitation
      const handleResendInvitation = async (email: string) => {
        try {
          await axios.post(`/api/project/${project_id}/resend-invitation`, { email });
          alert(`Invitation resent to ${email}`);
        } catch (error) {
          console.error("Error resending invitation:", error);
        }
      };
    
      // Function to remove member
      const handleRemoveMember = async (email: string) => {
        try {
          await axios.delete(`/api/project/${project_id}/member`, { data: { email } });
          setMembers(members.filter((member) => member.email !== email));
          alert(`${email} has been removed`);
        } catch (error) {
          console.error("Error removing member:", error);
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
                          className="flex items-center bg-transparent text-white text-sm rounded-full"
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleAddEmail();
                          }
                        }}
                        placeholder={emails.length === 0 ? "Add email..." : ""}
                        className="  text-sm outline-none flex-1 min-w-[120px] py-1 px-3"
                      />
                    </div>
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
               hideCloseButton={true}>
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
                <BadgeCheck width={35} height={35} color="#FF394A"/>
                </div>
                <p className=" text-md ">
                  Invitation sent successfully to{" "}
                  <span className="font-semibold gap-2 text-md">{emails.join("; ")}</span>. They
                  will receive an email to join your team.
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
                <TableRow key={index} className="hover:bg-[#2c2c2c]">
                  <TableCell>{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>{member.status}</TableCell>
                  <TableCell>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="bg-zinc-800 text-white rounded-md shadow-lg p-2"
                          sideOffset={5}
                        >
                          <DropdownMenu.Item
                            className="p-2 hover:bg-zinc-700 cursor-pointer rounded"
                            onClick={() => handleResendInvitation(member.email)}
                          >
                            Resend Invitation
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="p-2 hover:bg-zinc-700 cursor-pointer rounded text-red-400"
                            onClick={() => handleRemoveMember(member.email)}
                          >
                            Remove Member
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent className="bg-zinc-900 border border-zinc-400 max-w-md w-full px-4">
                <DialogHeader className="flex flex-col ">
                  <DialogTitle className="text-white text-lg pb-3">
                    Delete Image
                  </DialogTitle>
                </DialogHeader>
                <Card
                  className="border border-red-500 w-[95%] sm:w-[85%] md:w-full h-auto max-h-[190px]
  rounded-md p-4 sm:p-6 gap-4 bg-zinc-800 text-white mx-auto
  flex flex-col items-center justify-center text-center"
                >
                  <BadgeAlert className="w-9 h-9" color="rgb(239 68 68)" />
                  <DialogDescription className="text-red-500 text-md">
                    Are you sure you want to delete this image?
                  </DialogDescription>
                  <Button
                    onClick={confirmDelete}
                    className=" bg-white hover:bg-zinc-400 text-black w-full max-w-[73px] "
                  >
                    Delete
                  </Button>
                </Card>
              </DialogContent>
            </Dialog> */}
      </>
    );
}