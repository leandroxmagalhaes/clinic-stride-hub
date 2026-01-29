import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper function to convert array of objects to CSV
function arrayToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Handle null/undefined
          if (value === null || value === undefined) return "";
          // Handle strings with commas, quotes, or newlines
          const stringValue = String(value);
          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    ),
  ];

  return csvRows.join("\n");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify user and get their clinic_id
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized: Invalid token");
    }

    // Get user's clinic_id from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.clinic_id) {
      throw new Error("User clinic not found");
    }

    const clinicId = profile.clinic_id;
    console.log(`Exporting data for clinic: ${clinicId}`);

    // Fetch patients
    const { data: patients, error: patientsError } = await supabase
      .from("pacientes")
      .select(
        "id, full_name, cpf, birth_date, gender, phone, email, address, emergency_contact, emergency_phone, health_insurance, notes, is_active, created_at"
      )
      .eq("clinic_id", clinicId)
      .order("full_name");

    if (patientsError) {
      console.error("Error fetching patients:", patientsError);
      throw new Error(`Error fetching patients: ${patientsError.message}`);
    }

    // Fetch sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessoes")
      .select(
        "id, paciente_id, profissional_id, servico_id, start_time, end_time, status, price, payment_method, payment_status, notes, created_at"
      )
      .eq("clinic_id", clinicId)
      .order("start_time", { ascending: false });

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
      throw new Error(`Error fetching sessions: ${sessionsError.message}`);
    }

    // Fetch credit transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from("transacoes_credito")
      .select(
        "id, patient_id, tipo, quantidade, valor_pago, metodo_pagamento, motivo, expira_em, session_id, created_at"
      )
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError);
      throw new Error(`Error fetching transactions: ${transactionsError.message}`);
    }

    console.log(
      `Found: ${patients?.length || 0} patients, ${sessions?.length || 0} sessions, ${transactions?.length || 0} transactions`
    );

    // Convert to CSV
    const patientsCSV = arrayToCSV(patients || []);
    const sessionsCSV = arrayToCSV(sessions || []);
    const transactionsCSV = arrayToCSV(transactions || []);

    // Create ZIP file
    const zip = new JSZip();
    zip.file("pacientes.csv", patientsCSV);
    zip.file("sessoes.csv", sessionsCSV);
    zip.file("transacoes_credito.csv", transactionsCSV);

    // Add a README file
    const now = new Date();
    const readme = `Backup da Clínica
==================
Data de exportação: ${now.toLocaleString("pt-PT")}

Ficheiros incluídos:
- pacientes.csv: ${patients?.length || 0} registos
- sessoes.csv: ${sessions?.length || 0} registos
- transacoes_credito.csv: ${transactions?.length || 0} registos

Este backup contém dados sensíveis. Mantenha-o em local seguro.
`;
    zip.file("README.txt", readme);

    // Generate ZIP
    const zipContent = await zip.generateAsync({ type: "base64" });

    // Generate filename with timestamp
    const timestamp = now.toISOString().slice(0, 16).replace(/[:-]/g, "").replace("T", "_");
    const filename = `backup_${timestamp}.zip`;

    console.log(`Export complete: ${filename}`);

    return new Response(
      JSON.stringify({
        zipBase64: zipContent,
        filename: filename,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
