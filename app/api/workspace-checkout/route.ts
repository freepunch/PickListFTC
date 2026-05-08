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

  let body: { workspaceName?: string; teamNumber?: number | string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const workspaceName = (body.workspaceName ?? "").toString().trim().slice(0, 80);
  const teamRaw = body.teamNumber;
  const teamNumber =
    teamRaw === null || teamRaw === undefined || teamRaw === ""
      ? null
      : parseInt(String(teamRaw), 10);

  if (!workspaceName) {
    return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
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

  const origin = request.headers.get("origin") ?? "https://picklistftc.com";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "PickListFTC Team Workspace",
            description: `DECODE 2025-2026 season workspace for "${workspaceName}"`,
          },
          unit_amount: 2000,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${origin}/workspace/setup?session_id={CHECKOUT_SESSION_ID}&name=${encodeURIComponent(
      workspaceName
    )}&team=${teamNumber && !isNaN(teamNumber) ? teamNumber : ""}`,
    cancel_url: `${origin}/workspace`,
    metadata: {
      userId: user.id,
      workspaceName,
      teamNumber: teamNumber && !isNaN(teamNumber) ? String(teamNumber) : "",
    },
  });

  return NextResponse.json({ url: session.url });
}
