'use client'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { projectProps } from "./SubmissionStep1";
import axios from "axios";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"; // For the dropdown
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function MembersComponent({ project_id }: projectProps){
    const [members,setMembers]=useState<any[]>([])
    const [openModal, setOpenModal] = useState(false); // State for modal
    const [emails, setEmails] = useState<string[]>([]); // State for email inputs
    const [newEmail, setNewEmail] = useState(""); // State for new email input


    
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
          await axios.post(`/api/project/${project_id}/invite`, { emails });
          setEmails([]); // Clear emails after sending
          setOpenModal(false); // Close modal
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
        {/* Campo de búsqueda */}
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:bg-zinc-950"
            size={20}
          />
          <Input
            placeholder="Search team member by email or name "
            className=" w-full pl-10 dark:bg-zinc-950"
          />
        </div>

        {/* Botón de invitación */}
     {/* Botón de invitación */}
     <div className="flex justify-end mt-4">
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogTrigger asChild>
            <Button variant="outline" type="button">
              Invite Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 text-white rounded-lg p-6 w-full max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Invite Member</DialogTitle>
              <DialogDescription className="text-sm text-zinc-400 mt-2">
                Enter the email addresses of the persons you want to invite to your team.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <div className="flex flex-wrap gap-2 p-3 border border-red-500 rounded bg-zinc-800">
                {emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center bg-zinc-700 text-white px-2 py-1 rounded"
                  >
                    <span>{email}</span>
                    <button
                      className="ml-2 text-white hover:text-red-400"
                      onClick={() => handleRemoveEmail(email)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <input
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
                  className="bg-transparent outline-none text-white flex-1 min-w-[150px]"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSendInvitations} disabled={emails.length === 0}>
                Send Invitation
              </Button>
            </div>

            <DialogClose asChild>
              <button className="absolute top-4 right-4 text-zinc-400 hover:text-white">
                ✕
              </button>
            </DialogClose>
          </DialogContent>
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


      </>
    );
}