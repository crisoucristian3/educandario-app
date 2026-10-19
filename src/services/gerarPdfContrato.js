import { jsPDF } from "jspdf";
import { supabase } from "./supabase";

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

/**
 * Monta o texto completo do contrato substituindo os dados do aluno,
 * dos contratantes e os valores financeiros da Cláusula 8ª.
 */
export function montarTextoContrato(contrato, nomeTipo) {
  const c1 = contrato.contratante1 || {};
  const c2 = contrato.contratante2 || null;
  const al = contrato.aluno || {};

  let blocoContratante2 = "";
  if (c2 && c2.nome) {
    blocoContratante2 = `
2º CONTRATANTE: ${c2.nome || "—"}
Nacionalidade: ${c2.nacionalidade || "Brasileiro(a)"} | Data Nasc.: ${formatarData(c2.dataNascimento)}
Identidade (RG): ${c2.identidade || "—"} | Expedida em: ${c2.expedidaEm || "—"} | CPF: ${c2.cpf || "—"}
E-mail: ${c2.email || "—"} | Telefone: ${c2.telefone || "—"}
Endereço: ${c2.endereco || "—"} | Bairro: ${c2.bairro || "—"} | Cidade: ${c2.cidade || "Tuntum"} | UF: ${c2.uf || "MA"}
`;
  }

  return `EDUCANDÁRIO CONSTRUTORES DO SABER
CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS 2026
${nomeTipo.toUpperCase()}

================================================================================
QUALIFICAÇÃO DAS PARTES
================================================================================
ALUNO(A): ${al.nome || "—"} | Data Nasc.: ${formatarData(al.dataNascimento)}

1º CONTRATANTE: ${c1.nome || "—"}
Nacionalidade: ${c1.nacionalidade || "Brasileiro(a)"} | Data Nasc.: ${formatarData(c1.dataNascimento)}
Identidade (RG): ${c1.identidade || "—"} | Expedida em: ${c1.expedidaEm || "—"} | CPF: ${c1.cpf || "—"}
E-mail: ${c1.email || "—"} | Telefone: ${c1.telefone || "—"}
Endereço: ${c1.endereco || "—"} | Bairro: ${c1.bairro || "—"} | Cidade: ${c1.cidade || "Tuntum"} | UF: ${c1.uf || "MA"}
${blocoContratante2}
CONTRATADA: EDUCANDÁRIO CONSTRUTORES DO SABER, Pessoa Jurídica de Direito Privado, CNPJ 39.691.139/0001-64, INEP 21287899, situada na Rua Orfileno Léda, S/N - Centro - Tuntum/MA, CEP 65763-000. As partes qualificadas acima firmam o presente instrumento particular de CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS, mediante as cláusulas e condições a seguir expressas:

CLÁUSULA PRIMEIRA - DEFINIÇÕES - VAGAS, MATRÍCULA E REMATRÍCULA
1.1. Para os fins deste contrato, Aluno refere-se ao estudante identificado; Ano Letivo ao período escolar de 2026; Anuidade ao valor pago pelos Contratantes à Contratada; Dados Pessoais conforme a LGPD (Lei nº 13.709/2018).
1.2. A matrícula e a rematrícula estão condicionadas à existência de vaga na etapa pretendida, observância do Edital de Matrículas vigente, apresentação da documentação exigida, quitação de débitos anteriores e assinatura deste contrato pelos responsáveis.

CLÁUSULA SEGUNDA - DO OBJETO
2.1. A Contratada compromete-se a ministrar ensino por meio de aulas e demais atividades escolares, seguindo planos de estudo, programas, currículo e calendário conforme legislação vigente (Lei Federal nº 9.394/96) para o ano letivo de 2026.
2.2. Este contrato não inclui serviços como recuperação, reforço, segunda chamada, dependência, exames especiais, cursos opcionais, segunda via de documentos, transporte escolar, uniforme, merenda e material didático individual (Sistema Conquista Solução Educacional e Projeto Líder em Mim).

CLÁUSULA TERCEIRA - DAS NORMAS INTERNAS E UNIFORME
3.1. O Aluno submete-se às normas internas do Regimento Escolar e Manual da Família. O uso do uniforme escolar é de caráter obrigatório nas dependências da instituição e em atividades externas promovidas pela escola.

CLÁUSULA QUARTA A SÉTIMA - PROTEÇÃO DE DADOS (LGPD) E USO DE IMAGEM E VOZ
4.1. Os dados pessoais coletados serão utilizados exclusivamente para fins educacionais, administrativos e de comunicação com os responsáveis legais, armazenados em conformidade com a Lei nº 13.709/2018.
4.2. Os Contratantes autorizam o envio de comunicações por agenda eletrônica, e-mail, SMS ou WhatsApp utilizando os contatos fornecidos neste contrato.
4.3. Os Contratantes autorizam a utilização gratuita da imagem, voz e nome do Aluno exclusivamente para fins institucionais e pedagógicos da escola, sendo vedado a alunos, pais ou terceiros captar ou divulgar imagem/voz de professores, funcionários e demais alunos sem consentimento expresso.

CLÁUSULA OITAVA - VALOR DA ANUIDADE, FORMA DE PAGAMENTO E INADIMPLÊNCIA
8.0. Pelos serviços educacionais referidos neste contrato, os Contratantes pagarão à Contratada uma anuidade no valor de ${formatarMoeda(contrato.valorAnuidade)}, a ser quitada em ${contrato.numParcelas} (${contrato.numParcelas === 12 ? "doze" : contrato.numParcelas}) parcelas mensais, iguais e sucessivas, no valor de ${formatarMoeda(contrato.valorParcela)} cada, conforme estabelecido na Lei Federal nº 9.870/99.
Parágrafo Primeiro: A matrícula será concluída após entrega dos documentos, assinatura deste contrato e pagamento da primeira parcela no ato da assinatura. As demais parcelas vencem até o dia 5 de cada mês.

CLÁUSULA NONA - SERVIÇOS ADICIONAIS E PENALIDADES POR ATRASO
9.1. Serviços cobrados à parte: a) Recuperação (limitado a 40% da parcela); b) Segunda Chamada (10% da parcela por componente, salvo atestado médico); c) Segunda Via de Documentos (5% da parcela).
9.2. Penalidades por atraso: Em caso de atraso no pagamento de qualquer parcela, incidirão multa moratória de 2% (dois por cento) e juros moratórios de 0,033% ao dia, além de honorários de 10% (cobrança extrajudicial) ou 20% (judicial) e possibilidade de protesto e inscrição em órgãos de proteção ao crédito após 30 dias de atraso.

CLÁUSULA DÉCIMA E DÉCIMA PRIMEIRA - RESCISÃO CONTRATUAL
10.1. O contrato poderá ser rescindido a qualquer tempo mediante comunicação formal e escrita à secretaria.
Parágrafo Primeiro: Rescisão antes do início do ano letivo implicará multa compensatória de 10% do valor total do contrato anual.
Parágrafo Segundo: Rescisão após o início do ano letivo implicará quitação dos meses prestados acrescida de multa compensatória de 20% sobre o valor das mensalidades vincendas até o fim do contrato.

CLÁUSULA DÉCIMA SEGUNDA A DÉCIMA NONA - OBRIGAÇÕES, SAÚDE, HORAS ADICIONAIS, INCLUSÃO, BULLYING E CANTINA
12.1. É obrigatória a aquisição do material didático (Conquista Solução Educacional e Projeto Líder em Mim), sendo vedado o uso de material xerocopiado (Lei nº 9.610/98).
13.1. Administração de medicamentos na escola ocorrerá apenas conforme regras restritas de segurança e receituário médico válido.
16.1. Horas adicionais após o horário regular terão cobrança de R$ 30,00 a cada 15 minutos excedentes a partir da terceira ocorrência.
17.1. A escola reafirma seu compromisso com a inclusão (Lei nº 13.146/2015), cabendo à família apresentar laudos atualizados e prover acompanhamentos clínicos recomendados.
18.1. A instituição adota medidas de prevenção e combate ao bullying e cyberbullying (Lei nº 13.185/2015 e Lei nº 14.811/2024).
19.1. É proibido o recebimento de encomendas externas de fast-food ou lanches por aplicativo durante o período escolar.

CLÁUSULA VIGÉSIMA A VIGÉSIMA NONA - COMUNICAÇÃO, ASSINATURA DIGITAL, PIX E DISPOSIÇÕES GERAIS
24.1. DA ASSINATURA DIGITAL: As partes concordam integralmente que as assinaturas do presente instrumento poderão ser realizadas através da ferramenta de assinatura digital, nos termos do artigo 10 da MP 2.200-2/2001. Este instrumento será considerado irrevogavelmente por todos que o assinam como prova documental e título executivo extrajudicial, para todos os fins e efeitos.
26.1. O pagamento poderá ser realizado via boleto bancário ou Pix (Pix Cobrança com QR Code ou Pix Automático).
28.1. Em conformidade com a Lei Federal nº 15.100/2025, é proibido o uso de aparelhos celulares pessoais pelos alunos durante aulas, recreios e intervalos, salvo para fins estritamente pedagógicos ou de saúde/acessibilidade.

CLÁUSULA TRIGÉSIMA - DO FORO
30.1. As partes elegem o foro da comarca de TUNTUM-MA para dirimir quaisquer dúvidas oriundas deste contrato.
E por estarem justos e contratados, firmam o presente instrumento para que produza os devidos efeitos legais.`;
}

/**
 * Gera o arquivo PDF, faz o download imediato na máquina do usuário
 * e também envia uma cópia para o Supabase Storage (bucket 'contratos').
 */
export async function gerarEBaixarPdfContrato(contrato, nomeTipo, fazerDownload = true) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margem = 40;
  const larguraTexto = larguraPagina - margem * 2;

  // Barra superior com as cores do Educandário (Vinho e Verde)
  doc.setFillColor(128, 0, 32); // Vinho
  doc.rect(0, 0, larguraPagina / 2, 8, "F");
  doc.setFillColor(0, 128, 0); // Verde
  doc.rect(larguraPagina / 2, 0, larguraPagina / 2, 8, "F");

  // Texto principal do contrato
  const textoCompleto = montarTextoContrato(contrato, nomeTipo);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);

  const linhas = doc.splitTextToSize(textoCompleto, larguraTexto);
  let y = 35;

  linhas.forEach((linha) => {
    if (y > alturaPagina - 60) {
      doc.addPage();
      y = 40;
    }
    const isTitulo =
      linha.startsWith("EDUCANDÁRIO") ||
      linha.startsWith("CONTRATO DE") ||
      linha.startsWith("CLÁUSULA") ||
      linha.startsWith("QUALIFICAÇÃO");
    doc.setFont("helvetica", isTitulo ? "bold" : "normal");
    doc.text(linha, margem, y);
    y += 13;
  });

  // Bloco de Assinatura e Carimbo de Auditoria no final do PDF
// Bloco de Assinatura e Carimbo de Auditoria no final do PDF
  // Aumentamos a margem de segurança de 180 para 260. Assim, se o quadro não couber inteiro, ele vai para a próxima página.
  if (y > alturaPagina - 260) {
    doc.addPage();
    y = 50;
  } else {
    y += 25;
  }

  doc.setDrawColor(180, 180, 180);
  doc.line(margem, y, larguraPagina - margem, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Tuntum - MA, ${formatarData(contrato.criadoEm)}`, margem, y);
  y += 25;

  // Puxa o nome preenchido no painel ou usa o padrão
  const representanteEscola = contrato.representanteEscola || "Direção — Educandário Construtores do Saber";
  const cnpjEscola = "39.691.139/0001-64";

  if (contrato.status === "assinado" && contrato.assinatura) {
    // QUADRO VERDE COM AS DUAS ASSINATURAS VALIDADAS
    doc.setFillColor(230, 255, 250);
    doc.setDrawColor(0, 128, 0);
    doc.roundedRect(margem, y, larguraTexto, 135, 6, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 100, 0);
    doc.text(
      "DOCUMENTO ASSINADO ELETRONICAMENTE PELAS PARTES (MP 2.200-2/2001 e Lei 14.063/2020)",
      margem + 12,
      y + 18
    );

    // 1. Assinatura da Escola (Contratada)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text("1. PELA CONTRATADA (INSTITUIÇÃO DE ENSINO):", margem + 12, y + 36);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Assinado eletronicamente na emissão por: ${representanteEscola} (CNPJ: ${cnpjEscola})`,
      margem + 12,
      y + 49
    );
    doc.text(`Data de Emissão/Chancela da Escola: ${formatarData(contrato.criadoEm)}`, margem + 12, y + 61);

    // Linha divisória interna
    doc.setDrawColor(180, 220, 200);
    doc.line(margem + 12, y + 69, larguraPagina - margem - 12, y + 69);

    // 2. Assinatura do Pai/Mãe (Contratante)
    doc.setFont("helvetica", "bold");
    doc.text("2. PELO(A) CONTRATANTE (RESPONSÁVEL FINANCEIRO):", margem + 12, y + 83);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Assinado por: ${contrato.assinatura.assinadoPor || contrato.contratante1?.nome} | CPF: ${contrato.contratante1?.cpf || "—"}`,
      margem + 12,
      y + 96
    );
    doc.text(`Data e Hora da Assinatura: ${formatarData(contrato.assinatura.dataHora)}`, margem + 12, y + 108);
    doc.text(
      `IP de Origem: ${contrato.assinatura.ip || "Registrado"} | Hash SHA-256: ${contrato.assinatura.hash || "VALIDADO"}`,
      margem + 12,
      y + 120
    );
  } else {
    // QUANDO AINDA ESTÁ PENDENTE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 100, 0);
    doc.text(`CONTRATADA: Assinado eletronicamente na emissão por ${representanteEscola}`, margem, y + 15);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`CNPJ: ${cnpjEscola} | Emitido em: ${formatarData(contrato.criadoEm)}`, margem, y + 28);

    doc.setTextColor(30, 30, 30);
    doc.text("____________________________________________________", margem, y + 58);
    doc.text(
      `CONTRATANTE 1: ${contrato.contratante1?.nome || "—"} (CPF: ${contrato.contratante1?.cpf || "—"})`,
      margem,
      y + 72
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(183, 121, 31);
    doc.text("Status: AGUARDANDO ASSINATURA DIGITAL DO RESPONSÁVEL", margem, y + 88);
  }

  const nomeArquivoLimpo = (contrato.aluno?.nome || "aluno")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();

  const nomeArquivo = `contrato_${nomeArquivoLimpo}_${contrato.id.slice(0, 6)}.pdf`;

  if (fazerDownload) {
    doc.save(nomeArquivo);
  }

  try {
    const pdfBlob = doc.output("blob");
    const caminhoStorage = `emitidos/${nomeArquivo}`;
    const { error: uploadError } = await supabase.storage
      .from("contratos")
      .upload(caminhoStorage, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadError) {
      const { data } = supabase.storage.from("contratos").getPublicUrl(caminhoStorage);
      return data?.publicUrl || null;
    }
  } catch (err) {
    console.warn("Aviso ao enviar PDF para o Storage:", err);
  }

  return null;
}