import "jsr:@supabase/functions-js/edge-functions"

type AfterShipCheckpoint = {
  checkpoint_time?: string;
  location?: string;
  message?: string;
  tag?: string;
  subtag?: string;
};

type AfterShipTracking = {
  tracking_number?: string;
  tag?: string;
  subtag?: string;
  courier_name?: string;
  checkpoints?: AfterShipCheckpoint[];
  expected_delivery?: string;
  last_updated_at?: string;
};

type AfterShipResponse = {
  meta?: { code?: number };
  data?: { tracking?: AfterShipTracking };
};

type TrackingResponse = {
  tracking_number: string;
  carrier?: string;
  status: string;
  checkpoints: Array<{
    timestamp: string;
    location?: string;
    description: string;
  }>;
  last_updated_at?: string;
  estimated_delivery?: string;
};

function normalizeStatus(tag?: string, subtag?: string): string {
  const base = String(tag ?? "").toLowerCase();
  const sub = String(subtag ?? "").toLowerCase();

  if (base.includes("delivered") || sub.includes("delivered")) return "delivered";
  if (base.includes("exception") || sub.includes("exception")) return "exception";
  if (base.includes("transit") || sub.includes("transit")) return "in_transit";
  if (base.includes("out_for_delivery") || base.includes("delivery") || sub.includes("out_for_delivery")) return "out_for_delivery";
  if (base.includes("pending") || base.includes("inforeceived") || sub.includes("pending")) return "pending";

  return "unknown";
}

function normalizeCheckpoint(item: AfterShipCheckpoint) {
  return {
    timestamp: item.checkpoint_time ?? "",
    location: item.location?.trim() || undefined,
    description: String(item.message ?? "").trim()
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  try {
    const apiKey = Deno.env.get("AFTERSHIP_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "tracking_unavailable" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { tracking_number?: string };
    const trackingNumber = String(body.tracking_number ?? "").trim();

    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ error: "tracking_number_required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const url = `https://api.aftership.com/tracking/2026-07/trackings/${encodeURIComponent(trackingNumber)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "aftership-api-key": apiKey
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ error: "upstream_error", details: text }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const payload = (await response.json()) as AfterShipResponse;
    const tracking = payload.data?.tracking;

    if (!tracking) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const result: TrackingResponse = {
      tracking_number: String(tracking.tracking_number ?? trackingNumber),
      carrier: tracking.courier_name?.trim(),
      status: normalizeStatus(tracking.tag, tracking.subtag),
      checkpoints: (tracking.checkpoints ?? []).map(normalizeCheckpoint),
      last_updated_at: tracking.last_updated_at,
      estimated_delivery: tracking.expected_delivery
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "unexpected_error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
});
