"use client";
import React, { useState } from "react";
import { AuthModal } from "./sections/auth-modal";
import CustomButton from "./custom-button";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import {
  useFetchUserDataQuery,
  useLogoutMutation,
} from "@/services/ambassador-dao/requests/auth";
import Image from "next/image";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { ListIcon, LogOut, User2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

export const AuthButton = () => {
  const [openAuthModal, setOpenAuthModal] = useState(false);
  const { data: user, isLoading } = useFetchUserDataQuery();

  const { mutateAsync: logout } = useLogoutMutation();
  const router = useRouter();

  return (
    <>
      {!isLoading && (
        <>
          {user ? (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Image
                    src={user.profile_image ?? DefaultAvatar}
                    alt='profile_image'
                    width={30}
                    height={30}
                    className='rounded-full cursor-pointer w-8 h-8'
                  />
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <div className='w-42  bg-[#fafafa] dark:bg-[#09090B] rounded-md flex flex-col space-y-1'>
                    {user.role === "SPONSOR" ? (
                      <>
                        <div
                          onClick={() => router.push("/ambassador-dao/sponsor")}
                          className='px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-opacity-50 dark:bg-[#000]'
                        >
                          <ListIcon color='var(--white-text-color)' size={16} />
                          Listings
                        </div>
                        <hr />
                      </>
                    ) : (
                      <>
                        <div
                          onClick={() => router.push("/ambassador-dao/profile")}
                          className='px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-opacity-50 dark:bg-[#000]'
                        >
                          <User2Icon
                            color='var(--white-text-color)'
                            size={16}
                          />
                          Profile
                        </div>
                        <hr />
                      </>
                    )}
                    <div
                      onClick={() => logout()}
                      className='px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-opacity-50 dark:bg-[#000]'
                    >
                      <LogOut color='#FB2C36' size={16} />
                      Logout
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          ) : (
            <CustomButton
              variant='danger'
              className='px-4 !h-8'
              onClick={() => setOpenAuthModal(true)}
            >
              Login
            </CustomButton>
          )}
        </>
      )}

      <AuthModal
        isOpen={openAuthModal}
        onClose={() => setOpenAuthModal(false)}
      />
    </>
  );
};
