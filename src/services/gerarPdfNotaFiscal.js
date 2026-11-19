import { jsPDF } from "jspdf";

// ============================================================
// DADOS FIXOS DO EMISSOR (mudam raramente: edite só aqui)
// ============================================================
const EMISSOR = {
  nome: "EDUCANDÁRIO CONSTRUTORES DO SABER",
  cnpj: "39.691.139/0001-64",
  endereco: "Rua Orfileno Léda, S/N - Centro",
  cidadeUf: "Tuntum/MA",
  cep: "",        // ex.: "65763-000"
  telefone: "",   // ex.: "(99) 99999-9999"
  email: "",      // ex.: "contato@escola.com.br"
};

const COR_MARCA = [0, 128, 0];

// ============================================================
// FORMATADORES
// ============================================================
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("pt-BR");
}

// ============================================================
// VALOR POR EXTENSO (padrão em recibos)
// ============================================================
const UN = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze",
  "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEN = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
  "setecentos", "oitocentos", "novecentos"];

function ate999(n) {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes = [];
  if (c) partes.push(CEN[c]);
  if (r) {
    if (r < 20) partes.push(UN[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(DEZ[d] + (u ? " e " + UN[u] : ""));
    }
  }
  return partes.join(" e ");
}

function inteiroPorExtenso(n) {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1e6);
  const milhares = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (milhoes) partes.push(ate999(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
  if (milhares) partes.push(milhares === 1 ? "mil" : ate999(milhares) + " mil");
  if (resto) partes.push(ate999(resto));
  return partes.join(" e ");
}

export function valorPorExtenso(valor) {
  const totalCentavos = Math.round(Number(valor || 0) * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;
  const partes = [];
  if (reais) partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (!partes.length) return "zero real";
  return partes.join(" e ");
}

// ============================================================
// GERADOR DO PDF
//
// notaFiscal esperado:
// {
//   id: "uuid...",
//   numero: 123,                 // opcional (número sequencial)
//   criadoEm: "2026-11-16",
//   cliente: { nome, cpf, endereco, telefone, email, aluno, turma },  // aluno/turma opcionais
//   itens: [{ quantidade, descricao, valorUnitario }],
//   desconto: 0,                 // opcional (em R$)
//   formaPagamento: "PIX",       // opcional
//   observacoes: "",             // opcional
//   valorTotal: 0                // opcional (se não vier, é calculado)
// }
// ============================================================
export async function gerarEBaixarPdfNotaFiscal(notaFiscal, fazerDownload = true) {
  const doc = new jsPDF("p", "pt", "a4");
  const margem = 40;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const larguraUtil = larguraPagina - margem * 2;
  const direita = larguraPagina - margem;
  let y = margem;

  const cliente = notaFiscal.cliente || {};
  const itens = notaFiscal.itens || [];

  // Colunas da tabela
  const colQtd = margem + 10;
  const colDesc = margem + 50;
  const larguraDesc = 250;
  const colUnitDir = margem + 400; // alinhado à direita
  const colTotalDir = direita - 8; // alinhado à direita

  // ---------- Cálculos ----------
  const subtotal = itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.valorUnitario || 0), 0);
  const desconto = Number(notaFiscal.desconto || 0);
  const total = notaFiscal.valorTotal != null ? Number(notaFiscal.valorTotal) : subtotal - desconto;

  const novaPaginaSeNecessario = (alturaNecessaria) => {
    if (y + alturaNecessaria > alturaPagina - 60) {
      doc.addPage();
      y = margem;
      return true;
    }
    return false;
  };

  const cabecalhoTabela = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(...COR_MARCA);
    doc.setTextColor(255, 255, 255);
    doc.rect(margem, y, larguraUtil, 20, "F");
    doc.text("QTD", colQtd, y + 14);
    doc.text("DESCRIÇÃO", colDesc, y + 14);
    doc.text("V. UNITÁRIO", colUnitDir, y + 14, { align: "right" });
    doc.text("TOTAL", colTotalDir, y + 14, { align: "right" });
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
  };

  // ---------- CABEÇALHO DO EMISSOR ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COR_MARCA);
  doc.text(EMISSOR.nome, margem, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  y += 28;
  doc.text(`CNPJ: ${EMISSOR.cnpj}`, margem, y);
  y += 12;
  const enderecoCompleto = [EMISSOR.endereco, EMISSOR.cidadeUf, EMISSOR.cep && `CEP ${EMISSOR.cep}`]
    .filter(Boolean)
    .join(" - ");
  doc.text(enderecoCompleto, margem, y);
  const contato = [EMISSOR.telefone && `Tel: ${EMISSOR.telefone}`, EMISSOR.email].filter(Boolean).join("  |  ");
  if (contato) {
    y += 12;
    doc.text(contato, margem, y);
  }

  y += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(margem, y, direita, y);

  // ---------- TÍTULO ----------
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("RECIBO DE VENDA", larguraPagina / 2, y, { align: "center" });
  y += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);

  // Número e data
  y += 22;
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const numero = notaFiscal.numero
    ? String(notaFiscal.numero).padStart(6, "0")
    : String(notaFiscal.id || "").slice(0, 8).toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.text(`Nº ${numero}`, margem, y);
  doc.text(`Data de emissão: ${formatarData(notaFiscal.criadoEm)}`, direita, y, { align: "right" });

  // ---------- DADOS DO CLIENTE ----------
  y += 15;
  const temAluno = cliente.aluno || cliente.turma;
  const alturaCliente = temAluno ? 88 : 72;
  doc.setFillColor(245, 245, 245);
  doc.rect(margem, y, larguraUtil, alturaCliente, "F");

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DADOS DO CLIENTE", margem + 10, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 16;
  doc.text(`Nome/Razão Social: ${cliente.nome || "—"}`, margem + 10, y);
  doc.text(`CPF/CNPJ: ${cliente.cpf || "—"}`, margem + 340, y);

  y += 15;
  const linhaEndereco = doc.splitTextToSize(`Endereço: ${cliente.endereco || "Não informado"}`, 320);
  doc.text(linhaEndereco[0], margem + 10, y);
  const contatoCliente = [cliente.telefone && `Tel: ${cliente.telefone}`, cliente.email].filter(Boolean).join(" | ");
  if (contatoCliente) doc.text(contatoCliente, margem + 340, y);

  if (temAluno) {
    y += 15;
    doc.text(`Aluno: ${cliente.aluno || "—"}`, margem + 10, y);
    doc.text(`Turma: ${cliente.turma || "—"}`, margem + 340, y);
  }

  // ---------- TABELA DE ITENS ----------
  y += 30;
  cabecalhoTabela();

  itens.forEach((item, index) => {
    const linhasDesc = doc.splitTextToSize(String(item.descricao || ""), larguraDesc);
    const alturaLinha = Math.max(20, linhasDesc.length * 12 + 8);

    if (novaPaginaSeNecessario(alturaLinha + 20)) cabecalhoTabela();

    if (index % 2 !== 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margem, y, larguraUtil, alturaLinha, "F");
    }

    const qtd = Number(item.quantidade || 0);
    const unit = Number(item.valorUnitario || 0);

    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(String(qtd), colQtd, y + 14);
    doc.text(linhasDesc, colDesc, y + 14);
    doc.text(formatarMoeda(unit), colUnitDir, y + 14, { align: "right" });
    doc.text(formatarMoeda(qtd * unit), colTotalDir, y + 14, { align: "right" });
    y += alturaLinha;
  });

  doc.setDrawColor(200, 200, 200);
  doc.line(margem, y, direita, y);

  // ---------- TOTAIS ----------
  novaPaginaSeNecessario(140);
  y += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  if (desconto > 0) {
    doc.text("Subtotal:", colUnitDir, y, { align: "right" });
    doc.text(formatarMoeda(subtotal), colTotalDir, y, { align: "right" });
    y += 16;
    doc.text("Desconto:", colUnitDir, y, { align: "right" });
    doc.text(`- ${formatarMoeda(desconto)}`, colTotalDir, y, { align: "right" });
    y += 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("VALOR TOTAL:", colUnitDir, y, { align: "right" });
  doc.setTextColor(...COR_MARCA);
  doc.text(formatarMoeda(total), colTotalDir, y, { align: "right" });

  // ---------- FORMA DE PAGAMENTO ----------
  y += 28;
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  if (notaFiscal.formaPagamento) {
    doc.setFont("helvetica", "bold");
    doc.text("Forma de pagamento: ", margem, y);
    const larguraRotulo = doc.getTextWidth("Forma de pagamento: ");
    doc.setFont("helvetica", "normal");
    doc.text(String(notaFiscal.formaPagamento), margem + larguraRotulo, y);
    y += 16;
  }

  // ---------- DECLARAÇÃO POR EXTENSO ----------
  const texto =
    `Recebemos de ${cliente.nome || "—"}${cliente.cpf ? `, CPF/CNPJ ${cliente.cpf}` : ""}, ` +
    `a importância de ${formatarMoeda(total)} (${valorPorExtenso(total)}), ` +
    `referente aos produtos/serviços acima discriminados, dando plena quitação.`;
  const linhasTexto = doc.splitTextToSize(texto, larguraUtil);
  novaPaginaSeNecessario(linhasTexto.length * 12 + 140);
  doc.setFont("helvetica", "normal");
  doc.text(linhasTexto, margem, y);
  y += linhasTexto.length * 12 + 6;

  // ---------- OBSERVAÇÕES ----------
  if (notaFiscal.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", margem, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    const obs = doc.splitTextToSize(String(notaFiscal.observacoes), larguraUtil);
    doc.text(obs, margem, y);
    y += obs.length * 12 + 6;
  }

  // ---------- ASSINATURA ----------
  y += 50;
  doc.setDrawColor(100, 100, 100);
  doc.line(margem + 100, y, direita - 100, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text(EMISSOR.nome, larguraPagina / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ ${EMISSOR.cnpj}`, larguraPagina / 2, y + 12, { align: "center" });
  doc.text(`${EMISSOR.cidadeUf}, ${formatarData(notaFiscal.criadoEm)}`, larguraPagina / 2, y + 24, { align: "center" });

  // ---------- RODAPÉ EM TODAS AS PÁGINAS ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Este documento é um recibo.",
      margem,
      alturaPagina - 25
    );
    doc.text(`Página ${p} de ${totalPaginas}`, direita, alturaPagina - 25, { align: "right" });
  }

  // ---------- SALVAR ----------
  const nomeSeguro = String(cliente.nome || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_");
  const nomeArquivo = `Recibo_${numero}_${nomeSeguro}.pdf`;
  if (fazerDownload) doc.save(nomeArquivo);

  return nomeArquivo;
}