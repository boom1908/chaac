import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// CRITICAL FIX: Forces Next.js to bypass the cache and execute a live ping
export const dynamic = "force-dynamic"; 

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Pinging the CHAAC 'profiles' table to keep the matrix awake
  const { data, error } = await supabase.from("profiles").select("id").limit(1);

  if (error) {
    return NextResponse.json({ status: "Error", error: error.message });
  }

  return NextResponse.json({ status: "CHAAC Heartbeat successful. Database is awake!" });
}
