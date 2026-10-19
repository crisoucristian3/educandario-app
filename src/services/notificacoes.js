function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

function calcularDiasRestantes(prazoIso, prazoDiasOriginal) {
  if (!prazoIso) return prazoDiasOriginal || 7;
  const hoje = new Date();
  const fim = new Date(prazoIso);
  const diff = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/**
 * Monta o texto padrão oficial (usado tanto no WhatsApp quanto no E-mail)
 */
export function montarMensagemContrato(contrato, nomeTipo) {
  const nomeResponsavel = contrato.contratante1?.nome || "Responsável";
  const emailResponsavel = contrato.contratante1?.email || "";
  const nomeAluno = contrato.aluno?.nome || "Aluno(a)";
  const valorAnuidade = formatarMoeda(contrato.valorAnuidade);
  const valorParcela = formatarMoeda(contrato.valorParcela);
  const numParcelas = contrato.numParcelas || 12;
  const dataVencimento = formatarData(contrato.prazoAssinaturaData);
  const diasPrazo = calcularDiasRestantes(
    contrato.prazoAssinaturaData,
    contrato.prazoDiasOriginal
  );
  const linkAssinatura = `${window.location.origin}/assinar/${contrato.linkToken}`;

  return (
    `Olá, *${nomeResponsavel}*! Tudo bem?\n\n` +
    `Há um contrato de matrícula do *Educandário Construtores do Saber* disponível para sua assinatura digital.\n\n` +
    `📋 *RESUMO DO CONTRATO:*\n` +
    `• *Aluno(a):* ${nomeAluno}\n` +
    `• *Etapa/Turma:* ${nomeTipo}\n` +
    `• *Anuidade 2026:* ${valorAnuidade} (em ${numParcelas}x de ${valorParcela})\n` +
    `• *Responsável Financeiro:* ${nomeResponsavel} (CPF: ${contrato.contratante1?.cpf || "—"})\n\n` +
    `⏳ *PRAZO PARA ASSINATURA:*\n` +
    `Assine em até *${diasPrazo} dia(s)* (vencimento em *${dataVencimento}*).\n\n` +
    `⚖️ *VALIDADE JURÍDICA:*\n` +
    `Este documento possui assinatura eletrônica validada nos termos do *Art. 10 da Medida Provisória nº 2.200-2/2001* e da *Lei nº 14.063/2020* (Cláusula 24ª do contrato), tendo plena validade jurídica como prova documental e título executivo extrajudicial mediante registro de IP, data/hora e hash criptográfico.\n\n` +
    `👉 *CLIQUE NO LINK ABAIXO PARA LER E ASSINAR:*\n` +
    `${linkAssinatura}\n\n` +
    `_(Caso seja seu primeiro acesso na plataforma, clique na aba "Primeiro acesso" usando o e-mail ${emailResponsavel} para criar sua senha.)_\n\n` +
    `Atenciosamente,\n` +
    `*Secretaria — Educandário Construtores do Saber*\n` +
    `Rua Orfileno Léda, S/N - Centro - Tuntum/MA | CNPJ: 39.691.139/0001-64`
  );
}

/**
 * 1) Envia para o WhatsApp do responsável
 */
export function enviarWhatsAppAssinatura(contrato, nomeTipo) {
  const telefoneBruto = contrato.contratante1?.telefone || "";
  const apenasNumeros = telefoneBruto.replace(/\D/g, "");
  const telefoneFormatado =
    apenasNumeros.length >= 10 && !apenasNumeros.startsWith("55")
      ? `55${apenasNumeros}`
      : apenasNumeros;

  const mensagem = montarMensagemContrato(contrato, nomeTipo);

  const urlWhatsApp = telefoneFormatado
    ? `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(mensagem)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

  window.open(urlWhatsApp, "_blank");
}

/**
 * 2) Envia para o E-mail do responsável com a mesma mensagem
 */
export function dispararEmailContrato({
  contrato,
  nomeTipo,
  paraEmail,
  paraNome,
  nomeAluno,
  linkAcesso,
  pdfUrl,
  tipoEvento = "pendente",
}) {
  // Se recebeu o objeto contrato completo, usa a mesma mensagem oficial do WhatsApp (sem os asteriscos de negrito)
  if (contrato) {
    const emailDestino = contrato.contratante1?.email || "";
    const assunto = `Contrato para Assinatura Digital — ${contrato.aluno?.nome || "Aluno"} (Educandário Construtores do Saber)`;
    const corpoLimpo = montarMensagemContrato(contrato, nomeTipo || "Matrícula 2026").replace(/\*/g, "");

    const mailtoUrl = `mailto:${emailDestino}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpoLimpo)}`;
    window.location.href = mailtoUrl;
    return;
  }

  // Fallback para quando o responsável envia a cópia assinada para si mesmo
  const assunto =
    tipoEvento === "assinado"
      ? `Cópia do Contrato Assinado — ${nomeAluno} (Educandário Construtores do Saber)`
      : `Contrato Pendente de Assinatura — ${nomeAluno} (Educandário Construtores do Saber)`;

  const corpo =
    `Olá, ${paraNome}!\n\n` +
    `Confirmamos a assinatura eletrônica do contrato escolar do(a) aluno(a) ${nomeAluno}, validada nos termos do Art. 10 da MP nº 2.200-2/2001 e Lei nº 14.063/2020.\n\n` +
    `Acesse a plataforma para baixar sua 2ª via assinada a qualquer momento:\n${linkAcesso}\n` +
    (pdfUrl ? `\nLink direto do PDF assinado:\n${pdfUrl}\n` : "") +
    `\nAtenciosamente,\nSecretaria — Educandário Construtores do Saber\nTuntum/MA`;

  window.location.href = `mailto:${paraEmail}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

/**
 * 3) Dispara WhatsApp + E-mail ao mesmo tempo!
 */
export function enviarWhatsAppEEmailSimultaneo(contrato, nomeTipo) {
  // Abre o WhatsApp em nova guia
  enviarWhatsAppAssinatura(contrato, nomeTipo);

  // Após 500ms, aciona o disparo do e-mail com a exata mesma mensagem (evita bloqueio de pop-up do navegador)
  setTimeout(() => {
    dispararEmailContrato({ contrato, nomeTipo });
  }, 500);
}