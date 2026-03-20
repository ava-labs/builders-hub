function wrapTemplate(title: string, content: string): string {
  return `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px; text-align: center;">${title}</h2>
      ${content}
      <div style="margin-top: 24px; text-align: center;">
        <a href="https://build.avax.network/validator-alerts" style="display: inline-block; background-color: #EF4444; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">View Dashboard</a>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <img src="https://build.avax.network/logo-black.png" alt="Avalanche" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">Avalanche Builder's Hub &copy; 2025</p>
      </div>
    </div>
  `;
}

export function uptimeAlertTemplate(params: {
  nodeId: string;
  label: string | null;
  uptime: number;
  threshold: number;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const subject = `Uptime Alert: ${params.nodeId} dropped to ${params.uptime.toFixed(1)}%`;
  const text = `Your validator ${name} uptime has dropped to ${params.uptime.toFixed(1)}%, below your threshold of ${params.threshold}%.`;
  const html = wrapTemplate(
    'Validator Uptime Alert',
    `
    <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <p style="font-size: 16px; color: #F87171; margin: 0 0 12px 0;">Uptime has dropped below your threshold</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Validator</td>
          <td style="padding: 8px 0; color: white; font-size: 14px; text-align: right; font-weight: bold;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Current Uptime</td>
          <td style="padding: 8px 0; color: #EF4444; font-size: 14px; text-align: right; font-weight: bold;">${params.uptime.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Your Threshold</td>
          <td style="padding: 8px 0; color: #D1D5DB; font-size: 14px; text-align: right;">${params.threshold}%</td>
        </tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #A1A1AA; text-align: center;">You will not receive another uptime alert for this validator within 24 hours.</p>
    `
  );
  return { subject, html, text };
}

export function versionAlertTemplate(params: {
  nodeId: string;
  label: string | null;
  currentVersion: string;
  latestVersion: string;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const subject = `Version Alert: ${params.nodeId} is outdated`;
  const text = `Your validator ${name} is running ${params.currentVersion}, but ${params.latestVersion} is available.`;
  const html = wrapTemplate(
    'Validator Version Alert',
    `
    <div style="background-color: #27272A; border: 1px solid #F59E0B; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <p style="font-size: 16px; color: #FBBF24; margin: 0 0 12px 0;">A newer version of AvalancheGo is available</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Validator</td>
          <td style="padding: 8px 0; color: white; font-size: 14px; text-align: right; font-weight: bold;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Running Version</td>
          <td style="padding: 8px 0; color: #F59E0B; font-size: 14px; text-align: right; font-weight: bold;">${params.currentVersion}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Latest Version</td>
          <td style="padding: 8px 0; color: #34D399; font-size: 14px; text-align: right; font-weight: bold;">${params.latestVersion}</td>
        </tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #A1A1AA; text-align: center;">You will not receive another version alert for this validator within 7 days.</p>
    `
  );
  return { subject, html, text };
}

export function expiryAlertTemplate(params: {
  nodeId: string;
  label: string | null;
  daysLeft: number;
  expiryDate: string;
}): { subject: string; html: string; text: string } {
  const name = params.label ? `${params.label} (${params.nodeId})` : params.nodeId;
  const subject = `Expiry Alert: ${params.nodeId} stake expires in ${params.daysLeft} days`;
  const text = `Your validator ${name} stake expires in ${params.daysLeft} days (${params.expiryDate}).`;
  const html = wrapTemplate(
    'Validator Stake Expiry Alert',
    `
    <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <p style="font-size: 16px; color: #F87171; margin: 0 0 12px 0;">Your validator stake is expiring soon</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Validator</td>
          <td style="padding: 8px 0; color: white; font-size: 14px; text-align: right; font-weight: bold;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Days Remaining</td>
          <td style="padding: 8px 0; color: #EF4444; font-size: 14px; text-align: right; font-weight: bold;">${params.daysLeft}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; font-size: 14px;">Expiry Date</td>
          <td style="padding: 8px 0; color: #D1D5DB; font-size: 14px; text-align: right;">${params.expiryDate}</td>
        </tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #A1A1AA; text-align: center;">You will not receive another expiry alert for this validator within 3 days.</p>
    `
  );
  return { subject, html, text };
}
