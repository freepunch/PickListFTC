import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const authHeader = request.headers.get("x-admin-key");
  if (!process.env.ADMIN_SECRET_KEY || authHeader !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { users },
    error,
  } = await supabase.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;
    try {
      await resend.emails.send({
        from: "PickListFTC <noreply@picklistftc.com>",
        to: user.email,
        bcc: "contact@ftrobotics.com",
        subject: "Something big is coming to PickListFTC",
        html: v2TeaserHtml(user.user_metadata?.full_name),
      });
      sent++;
    } catch (err) {
      console.error(`Failed: ${user.email}`, err);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({ sent, failed, total: users.length });
}

function v2TeaserHtml(name: string) {
  const firstName = name?.split(" ")[0] || "there";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
      <p style="font-size: 13px; color: #2563eb; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">COMING SOON</p>
      <h1 style="font-size: 28px; font-weight: 700; margin-bottom: 20px;">PickListFTC v2</h1>

      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hey ${firstName}, something big is coming to PickListFTC.</p>

      <p style="font-size: 15px; line-height: 1.7; margin-bottom: 24px;">We've been building a team collaboration layer from the ground up. Your whole drive team — captain, coach, scouts — scouting together in one workspace with shared notes, a live draft board, and tools we've never seen in FTC scouting before.</p>

      <p style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Here's a preview of what's coming:</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px;">
            <strong>Team Workspaces</strong><br>
            <span style="color: #666;">Shared scouting, one invite link, your whole team connected.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px;">
            <strong>Live Draft Board</strong><br>
            <span style="color: #666;">Track every pick during alliance selection in real time.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px;">
            <strong>Pick List Consensus</strong><br>
            <span style="color: #666;">Everyone ranks, the system finds where your team agrees.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px;">
            <strong>Alliance Simulator</strong><br>
            <span style="color: #666;">Mock-draft alliances and compare projected outcomes.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px;">
            <strong>Scouting Assignments</strong><br>
            <span style="color: #666;">Divide the work. Track who's scouted what.</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-size: 15px;">
            <strong>Scoring Heatmaps, Penalty Analytics, Live Notifications</strong><br>
            <span style="color: #666;">And a lot more under the hood.</span>
          </td>
        </tr>
      </table>

      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">All the individual scouting tools you already use — leaderboard, partner finder, team reports, pick lists — stay free. Workspaces are a $20/season upgrade for teams that want to scout together.</p>

      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">We'll send you another email when v2 goes live. In the meantime, keep scouting.</p>

      <a href="https://picklistftc.com" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Open PickListFTC</a>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;">

      <p style="font-size: 15px; line-height: 1.8;">
        <a href="https://www.instagram.com/firsttryrobotics" style="color: #2563eb; text-decoration: none;">@firsttryrobotics →</a><br>
        <a href="https://ftrobotics.com" style="color: #2563eb; text-decoration: none;">ftrobotics.com →</a>
      </p>

      <p style="font-size: 13px; color: #999; margin-top: 24px;">Built by First Try #21364<br>Questions? <a href="mailto:contact@ftrobotics.com" style="color: #999;">contact@ftrobotics.com</a></p>
    </div>
  `;
}
