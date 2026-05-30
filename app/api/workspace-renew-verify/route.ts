import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

  if (session.metadata?.type !== "renewal") {
    return NextResponse.json(
      { error: "Invalid session type" },
      { status: 400 }
    );
  }

  const workspaceId = session.metadata?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspace in session" }, { status: 400 });
  }

  // Verify user is admin of this workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json(
      { error: "You are not an admin of this workspace." },
      { status: 403 }
    );
  }

  // Compute new expiry: extend from current expires_at if still in the future, otherwise from now
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("expires_at")
    .eq("id", workspaceId)
    .maybeSingle();

  const currentExpiry =
    workspace?.expires_at ? new Date(workspace.expires_at) : null;
  const now = new Date();
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("workspaces")
    .update({ expires_at: newExpiry })
    .eq("id", workspaceId);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update expiration: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, expires_at: newExpiry });
}
