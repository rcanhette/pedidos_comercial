import { NextRequest } from "next/server";
import { completeOAuthLogin } from "@/server/oauth";

export async function GET(request: NextRequest) {
  return completeOAuthLogin(request, "google");
}
