export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "VeriAgent Protocol API",
    network: "GenLayer Studio Network (chain id 61999)",
  });
}
