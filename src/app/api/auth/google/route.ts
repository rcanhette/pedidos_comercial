import { NextRequest } from "next/server";
import { beginOAuthLogin } from "@/server/oauth";

export async function GET(request: NextRequest) {
  return beginOAuthLogin(request, "google");
}
