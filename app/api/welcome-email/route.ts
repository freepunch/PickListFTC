import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { email, name } = await request.json();

  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  const { error } = await resend.emails.send({
    from: 'PickListFTC <noreply@picklistftc.com>',
    to: email,
    subject: 'Welcome to PickListFTC',
    html: welcomeEmailHtml(name),
  });

  if (error) {
    console.error('[EMAIL] Welcome email failed:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function welcomeEmailHtml(name: string) {
  const firstName = name?.split(' ')[0] || 'there';
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Welcome to PickListFTC</h1>
      <p style="font-size: 16px; color: #555; margin-bottom: 24px;">Hey ${firstName}, thanks for signing up. You're ready to scout smarter.</p>

      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">PickListFTC gives you live OPR rankings, team scouting reports, a partner finder, and a drag-and-drop pick list builder — everything you need for alliance selection.</p>

      <p style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">Get started:</p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 24px;">
        <a href="https://www.youtube.com/watch?v=vRKyebwqQNI&t=80s" style="color: #3b82f6; text-decoration: none;">Watch the tutorial video →</a><br>
        <a href="https://picklistftc.com" style="color: #3b82f6; text-decoration: none;">Open PickListFTC →</a>
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">

      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Follow us and connect with the FTC scouting community:</p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 24px;">
        <a href="https://www.instagram.com/firsttryrobotics" style="color: #3b82f6; text-decoration: none;">@firsttryrobotics on Instagram →</a><br>
        <a href="https://ftrobotics.com" style="color: #3b82f6; text-decoration: none;">ftrobotics.com →</a>
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">

      <p style="font-size: 13px; color: #999;">Built by First Try #21364<br>Need help or have feedback? Reach out at <a href="mailto:contact@ftrobotics.com" style="color: #999;">contact@ftrobotics.com</a></p>
    </div>
  `;
}
