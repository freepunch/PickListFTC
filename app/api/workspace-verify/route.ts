import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateInviteCode } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server." },
      { status: 500 }
    );
  }
  const stripe = new Stripe(secret);

  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe session" }, { status: 400 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Payment not completed yet. Please retry." },
      { status: 402 }
    );
  }

  if (session.metadata?.userId !== user.id) {
    return NextResponse.json(
      { error: "Session does not belong to this user" },
      { status: 403 }
    );
  }

  // Idempotency: same Stripe session always yields the same workspace.
  {
    const { data: existing } = await supabase
      .from("workspaces")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (existing) return NextResponse.json({ workspace: existing });
  }

  // Block users already in a workspace.
  {
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingMember) {
      return NextResponse.json(
        {
          error:
            "You are already in a workspace. Leave it before creating a new one.",
        },
        { status: 409 }
      );
    }
  }

  const workspaceName = (session.metadata?.workspaceName ?? "Workspace").slice(0, 80);
  const teamRaw = session.metadata?.teamNumber ?? "";
  const teamNumber = teamRaw ? parseInt(teamRaw, 10) : null;

  let workspace: Record<string, unknown> | null = null;
  let lastError: string | null = null;
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        name: workspaceName,
        team_number: teamNumber && !isNaN(teamNumber) ? teamNumber : null,
        invite_code: code,
        owner_id: user.id,
        season: 2025,
        stripe_session_id: sessionId,
        paid: true,
      })
      .select()
      .single();
    if (!error && data) {
      workspace = data as Record<string, unknown>;
      break;
    }
    lastError = error?.message ?? "Unknown error";
    if (error?.code !== "23505") break;
  }

  if (!workspace) {
    return NextResponse.json(
      { error: lastError ?? "Failed to create workspace" },
      { status: 500 }
    );
  }

  const { error: memberErr } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id as string,
    user_id: user.id,
    role: "admin",
  });

  if (memberErr) {
    await supabase.from("workspaces").delete().eq("id", workspace.id as string);
    return NextResponse.json(
      { error: `Failed to create membership: ${memberErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ workspace });
}
