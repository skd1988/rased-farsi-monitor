import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  to: string;
  fullName: string;
  role: string;
  tempPassword: string;
  requirePasswordChange: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, fullName, role, tempPassword }: InviteEmailRequest = await req.json();

    console.log(`📧 Email invitation would be sent to: ${to} (${fullName}) with role: ${role}`);
    
    // TODO: Implement Resend email sending
    // For now, just return success to prevent build errors
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Email sending not implemented yet. Configure RESEND_API_KEY to enable.",
        recipient: to
      }), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
