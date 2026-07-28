import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { createClient } = await import("genlayer-js");
    const { studionet } = await import("genlayer-js/chains");

    const CONTRACT_ADDRESS =
      process.env.NEXT_PUBLIC_VERIAGENT_CONTRACT_ADDRESS ||
      "0xb91f66881b27EA184c92468579dCFcB0F39bDFE4";

    const client = createClient({ chain: studionet });

    const stats = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: "get_stats",
      args: [],
    });

    const agents = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: "list_agents",
      args: [],
    });

    const agentList = agents as any[];

    return NextResponse.json({
      ok: true,
      contract: {
        address: CONTRACT_ADDRESS,
        network: "GenLayer Studio (chain 61999)",
        stats,
        agentCount: agentList?.length ?? 0,
        agentNames: agentList?.map((a: any) => a.name) ?? [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message?.slice(0, 300) || "Contract read failed",
    });
  }
}
