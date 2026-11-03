import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session.ts";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
