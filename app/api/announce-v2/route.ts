import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Long-running, server-only, never cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Page through every user — listUsers caps at ~50 per page.
  const allUsers: { email: string; fullName: string | undefined }[] = [];
  const perPage = 200;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const u of data.users) {
      if (u.email) {
        allUsers.push({
          email: u.email,
          fullName: u.user_metadata?.full_name as string | undefined,
        });
      }
    }

    if (data.users.length < perPage) break;
    page++;
  }

  let sent = 0;
  let failed = 0;

  for (const user of allUsers) {
    try {
      await resend.emails.send({
        from: 'PickListFTC <noreply@picklistftc.com>',
        to: user.email,
        bcc: 'contact@ftrobotics.com',
        subject: 'PickListFTC v2 is here — Team Workspaces, Draft Board & more',
        html: v2AnnouncementHtml(user.fullName),
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send to ${user.email}:`, err);
      failed++;
    }

    // Rate limit: 1 second between sends to stay under Resend's per-second cap.
    await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({ sent, failed, total: allUsers.length });
}

function v2AnnouncementHtml(name: string | undefined) {
  const firstName = name?.split(' ')[0] || 'there';
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
      <h1 style="font-size: 28px; font-weight: 700; margin-bottom: 4px;">PickListFTC v2</h1>
      <p style="font-size: 14px; color: #888; margin-bottom: 24px;">The team scouting update is live.</p>

      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hey ${firstName}, we just shipped the biggest update to PickListFTC since launch. Here's what's new:</p>

      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Team Workspaces ($20/year)</h2>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Your whole drive team scouting in one place. Shared notes, collaborative pick lists, and a suggestion system so everyone contributes and the captain decides. Create a workspace, share the invite link, and your team is connected. One payment, 12 months of access.</p>

      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Draft Board</h2>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Track alliance selection in real time. Record each pick as it happens, see who's still available, and know your next best option at a glance. Syncs live across your team.</p>

      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Scouting Assignments</h2>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">A kanban board for dividing scouting work across your team. Assign teams to members, track who's been scouted, and make sure every potential pick has eyes on it.</p>

      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Pick List Consensus</h2>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Each team member submits their own rankings. The consensus builder merges them, highlights where your team agrees and disagrees, and helps the captain build a final list everyone believes in.</p>

      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Alliance Simulator</h2>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Mock-draft alliances and compare projected outcomes. Run "what-if" scenarios to prepare for every possibility at the selection table.</p>

      <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">And more</h2>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Live score notifications, scoring trend heatmaps, penalty analytics, light mode, and dozens of quality improvements across every page.</p>

      <a href="https://picklistftc.com" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Open PickListFTC</a>

      <p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">Watch the full walkthrough:</p>
      <a href="https://www.youtube.com/watch?v=vRKyebwqQNI&t=80s" style="color: #2563eb; text-decoration: none; font-size: 15px;">Tutorial video →</a>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;">

      <p style="font-size: 15px; line-height: 1.6;">Follow us:</p>
      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 20px;">
        <a href="https://www.instagram.com/firsttryrobotics" style="color: #2563eb; text-decoration: none;">@firsttryrobotics on Instagram →</a><br>
        <a href="https://ftrobotics.com" style="color: #2563eb; text-decoration: none;">ftrobotics.com →</a>
      </p>

      <p style="font-size: 13px; color: #999;">Built by First Try #21364<br>Need help? Reach out at <a href="mailto:contact@ftrobotics.com" style="color: #999;">contact@ftrobotics.com</a></p>
    </div>
  `;
}
