// Registo central de tudo o que sai em nome da clinica.
// Nunca lanca excecao: uma falha a registar nao pode impedir um envio.

export async function registarComunicacao(supabase: any, dados: any) {
  try {
    if (!dados || !dados.clinic_id || !dados.tipo) return;
    await supabase.from("comunicacoes").insert({
      clinic_id: dados.clinic_id,
      paciente_id: dados.paciente_id || null,
      sessao_id: dados.sessao_id || null,
      canal: dados.canal || "email",
      tipo: dados.tipo,
      assunto: dados.assunto || null,
      destinatario: dados.destinatario || null,
      estado: dados.estado || "enviado",
      erro: dados.erro || null,
      provider: dados.provider || "resend",
      provider_id: dados.provider_id || null,
      origem: dados.origem || null,
      disparado_por: dados.disparado_por || null,
      metadata: dados.metadata || {},
    });
  } catch (e) {
    console.error("[comunicacoes] falha ao registar:", e);
  }
}
