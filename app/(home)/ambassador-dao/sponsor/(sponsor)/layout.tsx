"use client";
import CustomButton from "@/components/ambassador-dao/custom-button";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { CreateListingModal } from "@/components/ambassador-dao/sections/create-listing-modal";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { cn } from "@/utils/cn";
import { History, Hourglass, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const AmbasssadorDaoSponsorsLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const { data: user, isLoading } = useFetchUserDataQuery();

  const [openCreateListingModal, setOpenCreateListingModal] = useState(false);
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/ambassador-dao");
    } else if (user && user.role !== "SPONSOR") {
      toast.error("You dont have permission to access this page.");
      router.push("/ambassador-dao");
    } else {
      // do nothing
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  return (
    <>
      {user && (
        <div className='flex flex-col md:flex-row min-h-screen bg-[var(--default-background-color)] rounded-md text-[var(--white-text-color)] m-4 md:m-6 border border-[var(--default-border-color)] p-3 md:p-6 lg:p-8'>
          {/* Sidebar */}
          <aside className='w-full md:w-56 lg:w-64 p-3 md:border-r border-[var(--default-border-color)]'>
            <div className='flex flex-row justify-center md:justify-normal md:flex-col md:space-y-4 overflow-x-auto whitespace-nowrap space-x-4 md:space-x-0'>
              <SidebarItem
                href='/ambassador-dao/sponsor/listings'
                icon={<LayoutGrid className='h-5 w-5' />}
                label='My Listing'
              />

              <SidebarItem
                href='#'
                icon={<History className='h-5 w-5' />}
                label='Get Help'
              />
              {user.status === "VERIFIED" && (
                <CustomButton
                  variant='danger'
                  className='px-3 hidden md:block'
                  onClick={() => setOpenCreateListingModal(true)}
                >
                  Create new listing
                </CustomButton>
              )}
            </div>
          </aside>

          {user.status === "VERIFIED" && (
            <div className='md:hidden flex my-2'>
              <CustomButton
                variant='danger'
                className='px-3'
                isFullWidth={false}
                onClick={() => setOpenCreateListingModal(true)}
              >
                Create new listing
              </CustomButton>
            </div>
          )}

          {/* Main content */}
          <main className='flex-1 p-4 sm:p-6'>{children}</main>
        </div>
      )}

      <CreateListingModal
        isOpen={openCreateListingModal}
        onClose={() => {
          setOpenCreateListingModal(false);
        }}
      />
    </>
  );
};

export default AmbasssadorDaoSponsorsLayout;

interface SidebarItemProps {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  label: string;
}

function SidebarItem({ href, icon, label }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.includes(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center space-x-2 py-2",
        isActive
          ? "font-semibold text-[#FB2C36]"
          : "font-medium text-[var(--secondary-text-color)] hover:!text-[var(--white-text-color)] hover:!font-semibold"
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, {
        className: cn(
          isActive ? " !text-[#FB2C36]" : " !text-[var(--secondary-text-color)]"
        ),
      })}
      <span className='text-base md:text-lg'>{label}</span>
    </Link>
  );
}
