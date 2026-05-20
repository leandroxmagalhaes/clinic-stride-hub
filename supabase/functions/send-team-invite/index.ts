import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteRequest {
  email: string;
  full_name: string;
  role: 'admin' | 'professional' | 'secretary';
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  professional: 'Fisioterapeuta',
  secretary: 'Secretaria',
};

const escapeHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the user's JWT from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Autenticação necessária");
    }

    // Create user client to get current user info
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Utilizador não autenticado");
    }

    // Get current user's profile to find clinic_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("clinic_id, full_name")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.clinic_id) {
      throw new Error("Perfil ou clínica não encontrados");
    }

    // Get clinic name
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("name")
      .eq("id", profile.clinic_id)
      .single();

    if (clinicError || !clinic) {
      throw new Error("Clínica não encontrada");
    }

    const { email, full_name, role }: InviteRequest = await req.json();

    // Validate input
    if (!email || !full_name || !role) {
      throw new Error("Dados incompletos: email, full_name e role são obrigatórios");
    }

    // Check if there's already a pending invite for this email in this clinic
    const { data: existingInvite } = await supabaseAdmin
      .from("team_invites")
      .select("id, status")
      .eq("clinic_id", profile.clinic_id)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      throw new Error("Já existe um convite pendente para este email");
    }

    // Check if user already exists in this clinic
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("clinic_id", profile.clinic_id)
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      throw new Error("Este email já está registado nesta clínica");
    }

    // Create the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("team_invites")
      .insert({
        clinic_id: profile.clinic_id,
        email: email.toLowerCase(),
        full_name,
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      throw new Error("Erro ao criar convite: " + inviteError.message);
    }

    // Build the invite URL
    const baseUrl = req.headers.get("origin") || "https://clinic-stride-hub.lovable.app";
    const inviteUrl = `${baseUrl}/signup?invite=${invite.token}`;

    // Send email via Resend
    const resend = new Resend(resendApiKey);
    
    const roleLabel = ROLE_LABELS[role] || role;
    
    const { error: emailError } = await resend.emails.send({
      from: "PhysioNE <noreply@resend.dev>",
      to: [email],
      subject: `Convite para juntar-se à ${clinic.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">PhysioNE</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; margin-top: 0;">Olá ${escapeHtml(full_name)}!</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
              Você foi convidado por <strong>${escapeHtml(profile.full_name)}</strong> para juntar-se à equipe da 
              <strong>${escapeHtml(clinic.name)}</strong> como <strong>${escapeHtml(roleLabel)}</strong>.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" 
                 style="display: inline-block; background: #10B981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Aceitar Convite
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              Este convite expira em <strong>7 dias</strong>. Se não reconhece este convite, pode ignorar este email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 0;">
              Se o botão não funcionar, copie e cole este link no seu navegador:<br>
              <a href="${inviteUrl}" style="color: #10B981;">${inviteUrl}</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      // Delete the invite if email fails
      await supabaseAdmin
        .from("team_invites")
        .delete()
        .eq("id", invite.id);
      throw new Error("Erro ao enviar email: " + JSON.stringify(emailError));
    }

    console.log(`Invite sent successfully to ${email} for clinic ${clinic.name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado com sucesso",
        invite_id: invite.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-team-invite:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erro desconhecido" 
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
