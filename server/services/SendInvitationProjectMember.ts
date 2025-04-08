import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

export async function sendInvitation(email: string, projectName: string, inviterName: string, inviteLink: string) {
  const from = {
    email: process.env.EMAIL_FROM as string,
    name: "Avalanche Builder's Hub"
  };

  const msg = {
    to: email,
    from: from,
    subject: `You're invited to collaborate on "${projectName}"`,
    text: `${inviterName} has invited you to join the project "${projectName}" on Avalanche Builder's Hub. Click the link below to accept the invitation:\n\n${inviteLink}`,
    html: `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px;">You're Invited to Collaborate</h2>

      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #F87171; margin-bottom: 10px;">
          <strong>${inviterName}</strong> has invited you to join the project:
        </p>
        <p style="font-size: 20px; font-weight: bold; color: #EF4444; margin: 8px 0;">"${projectName}"</p>
        <a href="${inviteLink}" target="_blank" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Accept Invitation
        </a>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">If you did not expect this invitation, you can safely ignore this email.</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-white.png" alt="Company Logo" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">Avalanche Builder's Hub © 2025</p>
      </div>
    </div>
    `,
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    throw new Error('Error sending project invitation email');
  }
}
