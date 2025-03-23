'use client';

import { useState, useEffect, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import Link from 'next/link';
import { VerifyEmailProps } from '@/types/verifyEmailProps';

const verifySchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must be only numbers'),
});



export function VerifyEmail({ email, onBack, callbackUrl = '/' }: VerifyEmailProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sentTries, setSentTries] = useState(0);
  const [expired, setExpired] = useState(false);

  const formMethods = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (resendCooldown > 0) {
      const interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendCooldown]);

  const handleVerify = async (values: z.infer<typeof verifySchema>) => {
    setIsVerifying(true);
    setMessage(null);
    try {
      const result = await signIn('credentials', {
        email,
        otp: values.code,
        redirect: false,
        callbackUrl: callbackUrl,
      });
      if (result?.error) {
        switch (result?.error) {
          case 'INVALID':
            setSentTries((prev) => prev + 1);
            setMessage(
              sentTries + 1 > 3
                ? "You've entered the wrong code too many times. Please wait and try again later."
                : 'Oops! That code is incorrect. Try again.'
            );
            if (sentTries > 3) {
              setMessage(
                "You've entered the wrong code too many times. Please wait and try again later."
              );
            }
            break;
          case 'EXPIRED':
            setMessage('This code has expired. Click below to get a new one.');
            setExpired(true);
            break;
          case 'OTP SENT':
            break;
          default:
            setMessage('Error to sent OTP try again.');
            break;
        }
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      setMessage('Error to verify OTP try again');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setMessage(null);

    try {
      const result = await signIn('credentials', { email, redirect: false });
      if (result?.error?.includes('OTP SENT')) {
        setResendCooldown(30);
        setExpired(false);
        setSentTries(0);
      } else {
        setMessage('Error to sent OTP try again.');
      }
    } catch (error) {
      setMessage('ErrError to sent OTP try againo.');
    } finally {
      setIsResending(false);
    }
  };

  const isFilled = useMemo(() => {
    return formMethods.watch('code')?.length === 6;
  }, [formMethods.watch('code')]);

  return (
    <div className='flex gap-[10px] justify-center border-none'>
      <div className='w-[400px]  p-6 rounded-lg border-none '>
        <h1 className='text-2xl font-semibold text-center mb-4 border-none'>
          Verify Your Email
        </h1>
        <p className='text-sm text-gray-400 mb-6'>
          Enter the 6-digit sent to you at <br />
          <strong>{email}</strong>. It expires in 3 minutes.
        </p>

        <Form {...formMethods}>
          <form
            onSubmit={formMethods.handleSubmit(handleVerify)}
            className='space-y-4'
          >
            <div className='flex flex-col items-center space-y-2'>
              <InputOTP
                className='w-[350px] h-10 flex justify-between text-white'
                maxLength={6}
                onChange={(val) => formMethods.setValue('code', val)}
                placeholder='-'
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((value, i) => (
                    <InputOTPSlot
                      className='rounded-md text-center text-lg m-2 border Dark:text-white border-zinc-800'
                      key={i}
                      index={i}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {formMethods.formState.errors.code && (
                <p className='text-destructive text-sm'>
                  {formMethods.formState.errors.code.message}
                </p>
              )}
            </div>

            {message && <p className=' text-red-500 text-center'>{message}</p>}
            {expired && (
              <Button
                type='button'
                className='w-full px-4 py-2 gap-2 bg-zinc-50 Dark:text-zinc-800  hover:bg-primary/90'
                onClick={handleResend}
              >
                Get a New Code
              </Button>
            )}
            {!expired && sentTries <= 3 && (
              <Button
                type='submit'
                className='w-full px-4 py-2 gap-2 bg-zinc-50 Dark:text-zinc-800  hover:bg-primary/90'
                disabled={isVerifying || !isFilled}
              >
                {isVerifying ? 'Verifying...' : 'Verify & Continue'}
              </Button>
            )}
            {sentTries > 3 && (
              <Button
                type='submit'
                className='w-full px-4 py-2 gap-2 bg-zinc-50 Dark:text-zinc-800  hover:bg-primary/90'
                onClick={onBack}
              >
                Go back
              </Button>
            )}
          </form>
        </Form>
        {sentTries <= 3 && (
          <div className='text-sm mt-6 text-center border-none '>
            <p>
              Didn't receive a code?{' '}
              <Button
                variant='link'
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                className='p-0 h-auto text-muted-foreground hover:text-foreground'
              >
                Resend
              </Button>
            </p>
          </div>
        )}
        {sentTries > 3 && (
          <div className='mt-6 px-8 gap-2 text-sm justify-center text-center'>
            <p>
              If you think this is an error, please{' '}
              <Link
                href='#'
                target='_blank'
                className='underline Dark:text-white  Dark:hover:text-gray-300'
              >
                contact support
              </Link>
            </p>
          </div>
        )}
        {sentTries <= 3 && (
          <div className='mt-6 px-8 gap-2 text-sm justify-center text-center'>
            <p>
              You can request a new code in 00:
              {resendCooldown > 9 ? resendCooldown : '0' + resendCooldown}{' '}
              seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
