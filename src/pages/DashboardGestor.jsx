import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { gerarEBaixarPdfContrato } from "../services/gerarPdfContrato";
import {
  enviarWhatsAppAssinatura,
  dispararEmailContrato,
  enviarWhatsAppEEmailSimultaneo,
} from "../services/notificacoes";

const BRAND = {
  navy: "#1a1a1a",
  navyDeep: "#0a0a0a",
  ink: "#2D3748",
  paper: "#FFFFFF",
  mist: "#F8F9FA",
  line: "#E2E8F0",
  vinho: "#800020",
  verde: "#008000",
  amarelo: "#B7791F",
  vermelho: "#C53030",
  cinza: "#718096",
};

const TIPOS_CONTRATO_INICIAIS = [
  {
    id: "bercario",
    nome: "Educação Infantil (Berçário)",
    valorAnuidade: 6360,
    valorParcela: 530,
    numParcelas: 12,
  },
  {
    id: "infantil",
    nome: "Educação Infantil (G02 ao G05)",
    valorAnuidade: 5400,
    valorParcela: 450,
    numParcelas: 12,
  },
  {
    id: "fund1",
    nome: "Ensino Fundamental I (1º ao 5º ano)",
    valorAnuidade: 5760,
    valorParcela: 480,
    numParcelas: 12,
  },
  {
    id: "fund2",
    nome: "Ensino Fundamental II (6º ao 9º ano)",
    valorAnuidade: 6240,
    valorParcela: 520,
    numParcelas: 12,
  },
];

const CONTRATANTE_CAMPOS = [
  { key: "nome", label: "Nome completo", type: "text", required: true, full: true },
  { key: "nacionalidade", label: "Nacionalidade", type: "text" },
  { key: "dataNascimento", label: "Data de nascimento", type: "date" },
  { key: "identidade", label: "Identidade (RG)", type: "text" },
  { key: "expedidaEm", label: "Expedida em", type: "text" },
  { key: "cpf", label: "CPF", type: "text", required: true },
  { key: "email", label: "E-mail", type: "email", required: true },
  { key: "telefone", label: "Telefone (WhatsApp com DDD)", type: "text", required: true },
  { key: "endereco", label: "Endereço", type: "text", full: true },
  { key: "bairro", label: "Bairro", type: "text" },
  { key: "cidade", label: "Cidade", type: "text" },
  { key: "uf", label: "UF", type: "text" },
];

const ALUNO_CAMPOS = [
  { key: "nome", label: "Nome completo do aluno", type: "text", required: true, full: true },
  { key: "dataNascimento", label: "Data de nascimento", type: "date" },
];

const STATUS_INFO = {
  rascunho: { label: "Rascunho", bg: "#EDF2F7", fg: BRAND.cinza },
  pendente: { label: "Aguardando assinatura", bg: "#FFF6E5", fg: BRAND.amarelo },
  assinado: { label: "Assinado", bg: "#E6FFFA", fg: BRAND.verde },
  vencido: { label: "Vencido", bg: "#FFF5F5", fg: BRAND.vermelho },
  cancelado: { label: "Cancelado", bg: "#EDF2F7", fg: BRAND.cinza },
};

function contratanteVazio() {
  return Object.fromEntries(CONTRATANTE_CAMPOS.map((c) => [c.key, ""]));
}
function alunoVazio() {
  return Object.fromEntries(ALUNO_CAMPOS.map((c) => [c.key, ""]));
}

function gerarId() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
}

function formatarData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusExibicao(contrato) {
  if (contrato.status === "pendente" && new Date(contrato.prazoAssinaturaData) < new Date()) {
    return "vencido";
  }
  return contrato.status;
}

function mapearDoBanco(row) {
  return {
    id: row.id,
    tipoId: row.tipo_id,
    valorAnuidade: Number(row.valor_anuidade),
    valorParcela: Number(row.valor_parcela),
    numParcelas: Number(row.num_parcelas),
    aluno: row.aluno,
    contratante1: row.contratante1,
    contratante2: row.contratante2,
    status: row.status,
    criadoEm: row.criado_em,
    prazoDiasOriginal: row.prazo_dias_original,
    prazoAssinaturaData: row.prazo_assinatura_data,
    linkToken: row.link_token,
    pdfRascunhoUrl: row.pdf_rascunho_url,
    pdfAssinadoUrl: row.pdf_assinado_url,
    assinatura: row.assinatura,
    representanteEscola: row.representante_escola,
  };
}

export function DashboardGestor() {
  const navigate = useNavigate();

  const [tiposContrato, setTiposContrato] = useState(TIPOS_CONTRATO_INICIAIS);
  const [contratos, setContratos] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const [paginaAtiva, setPaginaAtiva] = useState("visaoGeral");

  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [contratoEditandoId, setContratoEditandoId] = useState(null);
  const [etapaWizard, setEtapaWizard] = useState(1);
  const [tipoSelecionado, setTipoSelecionado] = useState(null);
  const [aluno, setAluno] = useState(alunoVazio());
  const [contratante1, setContratante1] = useState(contratanteVazio());
  const [temContratante2, setTemContratante2] = useState(false);
  const [contratante2, setContratante2] = useState(contratanteVazio());
  const [prazoDias, setPrazoDias] = useState(7);
  const [representanteEscola, setRepresentanteEscola] = useState("Educandário Construtores do Saber");

  const [contratoDetalheId, setContratoDetalheId] = useState(null);
  const [contratoExcluirId, setContratoExcluirId] = useState(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState(null);

  const handleLogout = () => navigate("/gestor");

  

// ---------- Checar Segurança e Carregar dados reais do Supabase ----------
  useEffect(() => {
    async function verificarAcessoECarregarDados() {
      // 1. Checa se tem alguém logado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/gestor"); // Chuta pra tela de login do gestor
        return; 
      }

      // 2. Verifica se a pessoa logada é realmente da Gestão
      const { data: perfil } = await supabase
        .from("perfis")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!perfil || perfil.role !== "gestor") {
        navigate("/"); // Chuta pra tela do responsável
        return; 
      }

      // 3. Se passou pelas catracas de segurança acima, carrega as tabelas e modelos!
      const { data: tiposDB } = await supabase.from("tipos_contrato").select("*");
      if (tiposDB && tiposDB.length > 0) {
        setTiposContrato(
          tiposDB.map((t) => ({
            id: t.id,
            nome: t.nome,
            valorAnuidade: Number(t.valor_anuidade),
            valorParcela: Number(t.valor_parcela),
            numParcelas: Number(t.num_parcelas),
          }))
        );
      }

      const { data: contratosDB } = await supabase
        .from("contratos")
        .select("*")
        .order("criado_em", { ascending: false });

      if (contratosDB) {
        setContratos(contratosDB.map(mapearDoBanco));
      }
    }

    verificarAcessoECarregarDados();
  }, [navigate]);

  const stats = useMemo(() => {
    const hoje = new Date();
    const em7dias = new Date();
    em7dias.setDate(hoje.getDate() + 7);
    let pendentes = 0,
      assinados = 0,
      vencendoEm7 = 0;
    contratos.forEach((c) => {
      const status = statusExibicao(c);
      if (status === "pendente") {
        pendentes++;
        if (new Date(c.prazoAssinaturaData) <= em7dias) vencendoEm7++;
      }
      if (status === "assinado") assinados++;
    });
    return { total: contratos.length, pendentes, assinados, vencendoEm7 };
  }, [contratos]);

  const contratosFiltrados = useMemo(() => {
    return contratos
      .filter((c) => (filtroTipo === "todos" ? true : c.tipoId === filtroTipo))
      .filter((c) => (filtroStatus === "todos" ? true : statusExibicao(c) === filtroStatus))
      .filter((c) => c.aluno.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  }, [contratos, filtroTipo, filtroStatus, busca]);

  function abrirNovoContrato() {
    setContratoEditandoId(null);
    setTipoSelecionado(null);
    setAluno(alunoVazio());
    setContratante1(contratanteVazio());
    setContratante2(contratanteVazio());
    setTemContratante2(false);
    setPrazoDias(7);
    setRepresentanteEscola("Educandário Construtores do Saber");
    setEtapaWizard(1);
    setModalAberto(true);
  }

  function abrirEdicaoContrato(contrato) {
    setContratoEditandoId(contrato.id);
    setTipoSelecionado(tiposContrato.find((t) => t.id === contrato.tipoId) || null);
    setAluno(contrato.aluno);
    setContratante1(contrato.contratante1);
    setContratante2(contrato.contratante2 || contratanteVazio());
    setTemContratante2(!!contrato.contratante2);
    setPrazoDias(contrato.prazoDiasOriginal || 7);
    setRepresentanteEscola(contrato.representanteEscola || "Educandário Construtores do Saber");
    setEtapaWizard(2);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
  }

  const formularioValido =
    tipoSelecionado &&
    aluno.nome.trim() &&
    contratante1.nome.trim() &&
    contratante1.cpf.trim() &&
    contratante1.email.trim() &&
    representanteEscola.trim();

  async function handleSalvarContrato() {
    if (!formularioValido || salvando) return;
    setSalvando(true);

    const agora = new Date();
    const prazoData = new Date(agora);
    prazoData.setDate(prazoData.getDate() + Number(prazoDias || 7));

    try {
      if (contratoEditandoId) {
        const contratoExistente = contratos.find((c) => c.id === contratoEditandoId);
        const contratoAtualizado = {
          ...contratoExistente,
          id: contratoEditandoId,
          tipoId: tipoSelecionado.id,
          valorAnuidade: tipoSelecionado.valorAnuidade,
          valorParcela: tipoSelecionado.valorParcela,
          numParcelas: tipoSelecionado.numParcelas,
          aluno,
          contratante1,
          contratante2: temContratante2 ? contratante2 : null,
          prazoDiasOriginal: Number(prazoDias || 7),
          prazoAssinaturaData: prazoData.toISOString(),
          representanteEscola,
        };

        const pdfUrl = await gerarEBaixarPdfContrato(contratoAtualizado, tipoSelecionado.nome, true);

        await supabase
          .from("contratos")
          .update({
            tipo_id: tipoSelecionado.id,
            valor_anuidade: tipoSelecionado.valorAnuidade,
            valor_parcela: tipoSelecionado.valorParcela,
            num_parcelas: tipoSelecionado.numParcelas,
            aluno,
            contratante1,
            contratante2: temContratante2 ? contratante2 : null,
            prazo_dias_original: contratoAtualizado.prazoDiasOriginal,
            prazo_assinatura_data: contratoAtualizado.prazoAssinaturaData,
            pdf_rascunho_url: pdfUrl,
            representante_escola: representanteEscola,
          })
          .eq("id", contratoEditandoId);

        setContratos((prev) =>
          prev.map((c) =>
            c.id === contratoEditandoId
              ? { ...c, ...contratoAtualizado, pdfRascunhoUrl: pdfUrl || c.pdfRascunhoUrl }
              : c
          )
        );
      } else {
        const novoId = gerarId();
        const novoContrato = {
          id: novoId,
          tipoId: tipoSelecionado.id,
          valorAnuidade: tipoSelecionado.valorAnuidade,
          valorParcela: tipoSelecionado.valorParcela,
          numParcelas: tipoSelecionado.numParcelas,
          aluno,
          contratante1,
          contratante2: temContratante2 ? contratante2 : null,
          status: "pendente",
          criadoEm: agora.toISOString(),
          prazoDiasOriginal: Number(prazoDias || 7),
          prazoAssinaturaData: prazoData.toISOString(),
          linkToken: gerarId(),
          pdfRascunhoUrl: null,
          assinatura: null,
          representanteEscola,
        };

        const pdfUrl = await gerarEBaixarPdfContrato(novoContrato, tipoSelecionado.nome, true);
        novoContrato.pdfRascunhoUrl = pdfUrl;

        const { error } = await supabase.from("contratos").insert([
          {
            id: novoContrato.id,
            tipo_id: novoContrato.tipoId,
            valor_anuidade: novoContrato.valorAnuidade,
            valor_parcela: novoContrato.valorParcela,
            num_parcelas: novoContrato.numParcelas,
            status: novoContrato.status,
            aluno: novoContrato.aluno,
            contratante1: novoContrato.contratante1,
            contratante2: novoContrato.contratante2,
            prazo_dias_original: novoContrato.prazoDiasOriginal,
            prazo_assinatura_data: novoContrato.prazoAssinaturaData,
            link_token: novoContrato.linkToken,
            pdf_rascunho_url: novoContrato.pdfRascunhoUrl,
            representante_escola: novoContrato.representanteEscola,
          },
        ]);

        if (error) {
          console.error("Erro ao gravar no Supabase:", error);
          alert("Erro ao salvar no banco: " + error.message);
        } else {
          setContratos((prev) => [novoContrato, ...prev]);
        }
      }

      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluirConfirmado() {
    const idParaExcluir = contratoExcluirId;
    await supabase.from("contratos").delete().eq("id", idParaExcluir);
    setContratos((prev) => prev.filter((c) => c.id !== idParaExcluir));
    setContratoExcluirId(null);
  }

  function copiarLink(contrato) {
    const url = `${window.location.origin}/assinar/${contrato.linkToken}`;
    navigator.clipboard.writeText(url);
    setLinkCopiadoId(contrato.id);
    setTimeout(() => setLinkCopiadoId(null), 2000);
  }

  function reenviarEmail(contrato) {
    dispararEmailContrato({
      contrato,
      nomeTipo: tipoNome(contrato.tipoId),
    });
  }

  function enviarWhatsApp(contrato) {
    enviarWhatsAppAssinatura(contrato, tipoNome(contrato.tipoId));
  }

  async function baixarSegundaVia(contrato) {
    const nomeDoTipo = tipoNome(contrato.tipoId);
    await gerarEBaixarPdfContrato(contrato, nomeDoTipo, true);
  }

  async function handleSalvarTipo(id, campo, valor) {
    setTiposContrato((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const atualizado = { ...t, [campo]: valor };
        atualizado.valorParcela = Number((atualizado.valorAnuidade / atualizado.numParcelas).toFixed(2));

        supabase
          .from("tipos_contrato")
          .update({
            valor_anuidade: atualizado.valorAnuidade,
            num_parcelas: atualizado.numParcelas,
            valor_parcela: atualizado.valorParcela,
          })
          .eq("id", id)
          .then();

        return atualizado;
      })
    );
  }

  const contratoDetalhe = contratos.find((c) => c.id === contratoDetalheId);
  const tipoNome = (tipoId) => tiposContrato.find((t) => t.id === tipoId)?.nome || "—";

  return (
    <div style={styles.container}>
      <style>{fontImport}</style>

      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.brandMark}>
            <span style={{ ...styles.dot, background: BRAND.vinho }} />
            <span style={{ ...styles.dot, background: BRAND.paper }} />
          </div>
          <h2 style={styles.sidebarTitle}>Gestão Escolar</h2>
        </div>

        <nav style={styles.nav}>
          <button
            style={{ ...styles.navItem, ...(paginaAtiva === "visaoGeral" ? styles.navItemActive : {}) }}
            onClick={() => setPaginaAtiva("visaoGeral")}
          >
            Visão Geral
          </button>
          <button
            style={{ ...styles.navItem, ...(paginaAtiva === "contratos" ? styles.navItemActive : {}) }}
            onClick={() => setPaginaAtiva("contratos")}
          >
            Contratos
          </button>
          <button
            style={{ ...styles.navItem, ...(paginaAtiva === "modelos" ? styles.navItemActive : {}) }}
            onClick={() => setPaginaAtiva("modelos")}
          >
            Modelos de Contrato
          </button>
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.schoolInfo}>
            CNPJ: 39.691.139/0001-64
            <br />
            INEP: 21287899
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Sair da conta
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        {/* ---------------- VISÃO GERAL ---------------- */}
        {paginaAtiva === "visaoGeral" && (
          <>
            <header style={styles.header}>
              <div>
                <h1 style={styles.pageTitle}>Visão Geral</h1>
                <p style={styles.pageSubtitle}>Acompanhe o status das assinaturas e emita novos contratos.</p>
              </div>
              <button onClick={abrirNovoContrato} style={styles.primaryBtn}>
                + Novo Contrato
              </button>
            </header>

            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.total}</span>
                <span style={styles.statLabel}>Contratos emitidos</span>
              </div>
              <div style={styles.statCard}>
                <span style={{ ...styles.statValue, color: BRAND.amarelo }}>{stats.pendentes}</span>
                <span style={styles.statLabel}>Aguardando assinatura</span>
              </div>
              <div style={styles.statCard}>
                <span style={{ ...styles.statValue, color: BRAND.verde }}>{stats.assinados}</span>
                <span style={styles.statLabel}>Assinados</span>
              </div>
              <div style={styles.statCard}>
                <span style={{ ...styles.statValue, color: BRAND.vermelho }}>{stats.vencendoEm7}</span>
                <span style={styles.statLabel}>Vencendo em 7 dias</span>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Contratos recentes</h3>
              <TabelaContratos
                contratos={contratos.slice(0, 5)}
                tipoNome={tipoNome}
                onVer={setContratoDetalheId}
                onEditar={abrirEdicaoContrato}
                onExcluir={setContratoExcluirId}
                onCopiarLink={copiarLink}
                onWhatsApp={enviarWhatsApp}
                onReenviar={reenviarEmail}
                onBaixar={baixarSegundaVia}
                linkCopiadoId={linkCopiadoId}
                vazio="Nenhum contrato emitido ainda."
              />
            </div>
          </>
        )}

        {/* ---------------- CONTRATOS ---------------- */}
        {paginaAtiva === "contratos" && (
          <>
            <header style={styles.header}>
              <div>
                <h1 style={styles.pageTitle}>Contratos</h1>
                <p style={styles.pageSubtitle}>Filtre por tipo e status, envie por WhatsApp/E-mail ou emita a 2ª via.</p>
              </div>
              <button onClick={abrirNovoContrato} style={styles.primaryBtn}>
                + Novo Contrato
              </button>
            </header>

            <div style={styles.filtrosRow}>
              <input
                type="text"
                placeholder="Buscar por nome do aluno..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={styles.inputBusca}
              />
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={styles.select}>
                <option value="todos">Todos os tipos</option>
                {tiposContrato.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={styles.select}>
                <option value="todos">Todos os status</option>
                {Object.entries(STATUS_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.card}>
              <TabelaContratos
                contratos={contratosFiltrados}
                tipoNome={tipoNome}
                onVer={setContratoDetalheId}
                onEditar={abrirEdicaoContrato}
                onExcluir={setContratoExcluirId}
                onCopiarLink={copiarLink}
                onWhatsApp={enviarWhatsApp}
                onReenviar={reenviarEmail}
                onBaixar={baixarSegundaVia}
                linkCopiadoId={linkCopiadoId}
                vazio="Nenhum contrato encontrado com esses filtros."
              />
            </div>
          </>
        )}

        {/* ---------------- MODELOS DE CONTRATO ---------------- */}
        {paginaAtiva === "modelos" && (
          <>
            <header style={styles.header}>
              <div>
                <h1 style={styles.pageTitle}>Modelos de Contrato</h1>
                <p style={styles.pageSubtitle}>
                  As cláusulas são padrão para os 4 modelos — ajuste aqui apenas os valores de anuidade.
                </p>
              </div>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {tiposContrato.map((t) => (
                <div key={t.id} style={styles.card}>
                  <h3 style={styles.cardTitle}>{t.nome}</h3>
                  <div style={styles.modeloGrid}>
                    <div>
                      <label style={styles.label}>Valor da anuidade (R$)</label>
                      <input
                        type="number"
                        value={t.valorAnuidade}
                        onChange={(e) => handleSalvarTipo(t.id, "valorAnuidade", Number(e.target.value))}
                        style={styles.inputModal}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Nº de parcelas</label>
                      <input
                        type="number"
                        value={t.numParcelas}
                        onChange={(e) => handleSalvarTipo(t.id, "numParcelas", Number(e.target.value))}
                        style={styles.inputModal}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Valor da parcela (R$)</label>
                      <input type="number" value={t.valorParcela} readOnly style={{ ...styles.inputModal, background: BRAND.mist }} />
                    </div>
                  </div>
                  <p style={styles.hint}>
                    Parcela sugerida: {formatarMoeda(t.valorAnuidade / t.numParcelas)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ---------------- MODAL: NOVO CONTRATO / EDIÇÃO ---------------- */}
      {modalAberto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentGrande}>
            <div style={styles.modalHeader}>
              <h3 style={styles.cardTitle}>{contratoEditandoId ? "Editar contrato" : "Novo contrato"}</h3>
              <button onClick={fecharModal} style={styles.closeBtn}>✕</button>
            </div>

            {etapaWizard === 1 && (
              <div>
                <p style={styles.hint}>Selecione o tipo de contrato:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0" }}>
                  {tiposContrato.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTipoSelecionado(t)}
                      style={{
                        ...styles.tipoCard,
                        ...(tipoSelecionado?.id === t.id ? styles.tipoCardAtivo : {}),
                      }}
                    >
                      <strong>{t.nome}</strong>
                      <span style={styles.linkUrl}>
                        {formatarMoeda(t.valorAnuidade)} em {t.numParcelas}x de {formatarMoeda(t.valorParcela)}
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button onClick={fecharModal} style={styles.secondaryBtn}>Cancelar</button>
                  <button
                    onClick={() => tipoSelecionado && setEtapaWizard(2)}
                    style={{ ...styles.primaryBtn, opacity: tipoSelecionado ? 1 : 0.5 }}
                    disabled={!tipoSelecionado}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {etapaWizard === 2 && (
              <div>
                <SecaoFormulario titulo="Dados do aluno" campos={ALUNO_CAMPOS} valores={aluno} onChange={setAluno} />

                <SecaoFormulario
                  titulo="Contratante 1 (responsável financeiro)"
                  campos={CONTRATANTE_CAMPOS}
                  valores={contratante1}
                  onChange={setContratante1}
                />

                {!temContratante2 && (
                  <button onClick={() => setTemContratante2(true)} style={{ ...styles.secondaryBtn, marginBottom: "20px" }}>
                    + Adicionar 2º contratante
                  </button>
                )}

                {temContratante2 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={styles.subTitulo}>Contratante 2</h4>
                      <button onClick={() => setTemContratante2(false)} style={styles.linkBtn}>Remover</button>
                    </div>
                    <SecaoFormulario campos={CONTRATANTE_CAMPOS} valores={contratante2} onChange={setContratante2} />
                  </div>
                )}

                <div style={styles.formGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>Prazo para assinatura (dias a partir de hoje)</label>
                    <input
                      type="number"
                      value={prazoDias}
                      onChange={(e) => setPrazoDias(e.target.value)}
                      style={styles.inputModal}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Nome do Representante (Assinatura pela Escola)</label>
                    <input
                      type="text"
                      value={representanteEscola}
                      onChange={(e) => setRepresentanteEscola(e.target.value)}
                      placeholder="Educandário..."
                      style={styles.inputModal}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", marginTop: "24px" }}>
                  {!contratoEditandoId ? (
                    <button onClick={() => setEtapaWizard(1)} style={styles.secondaryBtn}>Voltar</button>
                  ) : (
                    <span />
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={fecharModal} style={styles.secondaryBtn}>Cancelar</button>
                    <button
                      onClick={handleSalvarContrato}
                      style={{ ...styles.primaryBtn, opacity: formularioValido && !salvando ? 1 : 0.5 }}
                      disabled={!formularioValido || salvando}
                    >
                      {salvando
                        ? "Gerando PDF..."
                        : contratoEditandoId
                        ? "Salvar e Baixar PDF"
                        : "Gerar Contrato (PDF)"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- PAINEL DE DETALHES ---------------- */}
      {contratoDetalhe && (
        <div style={styles.modalOverlay} onClick={() => setContratoDetalheId(null)}>
          <div style={styles.modalContentGrande} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.cardTitle}>{contratoDetalhe.aluno.nome}</h3>
              <button onClick={() => setContratoDetalheId(null)} style={styles.closeBtn}>✕</button>
            </div>

            <Badge status={statusExibicao(contratoDetalhe)} />

            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", color: BRAND.ink }}>
              <p><strong>Tipo de contrato:</strong> {tipoNome(contratoDetalhe.tipoId)}</p>
              <p><strong>Anuidade:</strong> {formatarMoeda(contratoDetalhe.valorAnuidade)} em {contratoDetalhe.numParcelas}x de {formatarMoeda(contratoDetalhe.valorParcela)}</p>
              <p><strong>Contratante 1:</strong> {contratoDetalhe.contratante1.nome} — {contratoDetalhe.contratante1.email} — Tel: {contratoDetalhe.contratante1.telefone || "—"}</p>
              <p><strong>Assinado por (Escola):</strong> {contratoDetalhe.representanteEscola || "Direção"}</p>
              <p><strong>Criado em:</strong> {formatarData(contratoDetalhe.criadoEm)}</p>
              <p><strong>Prazo para assinatura:</strong> {formatarData(contratoDetalhe.prazoAssinaturaData)}</p>

              {contratoDetalhe.assinatura ? (
                <p style={{ marginTop: "8px", padding: "12px", background: "#E6FFFA", borderRadius: "8px" }}>
                  ✅ Assinado eletronicamente por <strong>{contratoDetalhe.assinatura.assinadoPor}</strong> em{" "}
                  {formatarData(contratoDetalhe.assinatura.dataHora)} pelo IP{" "}
                  <code>{contratoDetalhe.assinatura.ip}</code> (Hash: <code>{contratoDetalhe.assinatura.hash}</code>)
                </p>
              ) : (
                <p style={{ marginTop: "8px", padding: "12px", background: "#FFF6E5", borderRadius: "8px" }}>
                  ⏳ Aguardando assinatura. Envie a mensagem padrão com o link pelo botão abaixo.
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "24px", flexWrap: "wrap" }}>
              {!contratoDetalhe.assinatura && (
                <>
                  <button
                    onClick={() => enviarWhatsApp(contratoDetalhe)}
                    style={{ ...styles.secondaryBtn, color: BRAND.verde, borderColor: BRAND.verde }}
                  >
                    WhatsApp
                  </button>
                  <button onClick={() => reenviarEmail(contratoDetalhe)} style={styles.secondaryBtn}>
                    E-mail
                  </button>
                  <button onClick={() => copiarLink(contratoDetalhe)} style={styles.secondaryBtn}>
                    {linkCopiadoId === contratoDetalhe.id ? "Link copiado!" : "Copiar link"}
                  </button>
                  <button onClick={() => abrirEdicaoContrato(contratoDetalhe)} style={styles.secondaryBtn}>
                    Editar
                  </button>
                </>
              )}
              <button onClick={() => baixarSegundaVia(contratoDetalhe)} style={styles.secondaryBtn}>
                Baixar 2ª via (PDF)
              </button>
              {!contratoDetalhe.assinatura && (
                <button
                  onClick={() => {
                    setContratoDetalheId(null);
                    setContratoExcluirId(contratoDetalhe.id);
                  }}
                  style={styles.dangerBtn}
                >
                  Excluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CONFIRMAÇÃO DE EXCLUSÃO ---------------- */}
      {contratoExcluirId && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.cardTitle}>Excluir contrato?</h3>
            <p style={{ color: "#6B7280", fontSize: "14px" }}>
              Essa ação não pode ser desfeita. Contratos já assinados não podem ser excluídos.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setContratoExcluirId(null)} style={styles.secondaryBtn}>Cancelar</button>
              <button onClick={handleExcluirConfirmado} style={styles.dangerBtn}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- subcomponentes ----------

function SecaoFormulario({ titulo, campos, valores, onChange }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      {titulo && <h4 style={styles.subTitulo}>{titulo}</h4>}
      <div style={styles.formGrid}>
        {campos.map((c) => (
          <div key={c.key} style={{ gridColumn: c.full ? "1 / -1" : "auto" }}>
            <label style={styles.label}>
              {c.label}
              {c.required && " *"}
            </label>
            <input
              type={c.type}
              value={valores[c.key] || ""}
              onChange={(e) => onChange({ ...valores, [c.key]: e.target.value })}
              style={styles.inputModal}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.rascunho;
  return (
    <span style={{ ...styles.badge, background: info.bg, color: info.fg }}>{info.label}</span>
  );
}

function TabelaContratos({
  contratos,
  tipoNome,
  onVer,
  onEditar,
  onExcluir,
  onCopiarLink,
  onWhatsApp,
  onReenviar,
  onBaixar,
  linkCopiadoId,
  vazio,
}) {
  if (contratos.length === 0) {
    return <p style={{ color: "#6B7280" }}>{vazio}</p>;
  }
  return (
    <div style={styles.tableContainer}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Aluno</th>
            <th style={styles.th}>Tipo</th>
            <th style={styles.th}>Contratante</th>
            <th style={styles.th}>Criado em</th>
            <th style={styles.th}>Prazo</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((c) => {
            const status = statusExibicao(c);
            return (
              <tr key={c.id} style={styles.tr}>
                <td style={styles.td}>
                  <button onClick={() => onVer(c.id)} style={styles.linkBtn}>{c.aluno.nome}</button>
                </td>
                <td style={styles.td}>{tipoNome(c.tipoId)}</td>
                <td style={styles.td}>{c.contratante1.nome}</td>
                <td style={styles.td}>{formatarData(c.criadoEm)}</td>
                <td style={styles.td}>{formatarData(c.prazoAssinaturaData)}</td>
                <td style={styles.td}><Badge status={status} /></td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {status !== "assinado" && (
                      <>
                        <button
                          onClick={() => onWhatsApp(c)}
                          style={{ ...styles.actionBtn, color: BRAND.verde, borderColor: BRAND.verde }}
                        >
                          WhatsApp
                        </button>
                        <button onClick={() => onReenviar(c)} style={styles.actionBtn}>
                          E-mail
                        </button>
                        <button onClick={() => onCopiarLink(c)} style={styles.actionBtn}>
                          {linkCopiadoId === c.id ? "Copiado!" : "Link"}
                        </button>
                        <button onClick={() => onEditar(c)} style={styles.actionBtn}>
                          Editar
                        </button>
                      </>
                    )}
                    <button onClick={() => onBaixar(c)} style={styles.actionBtn}>PDF</button>
                    {status !== "assinado" && (
                      <button onClick={() => onExcluir(c.id)} style={{ ...styles.actionBtn, color: BRAND.vermelho }}>
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`;

const styles = {
  container: { display: "flex", height: "100vh", width: "100%", fontFamily: "'Manrope', system-ui, sans-serif", background: BRAND.mist, overflow: "hidden" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" },
  modalContent: { backgroundColor: BRAND.paper, padding: "32px", borderRadius: "12px", width: "400px", maxWidth: "90%" },
  modalContentGrande: { backgroundColor: BRAND.paper, padding: "32px", borderRadius: "12px", width: "640px", maxWidth: "95%", maxHeight: "85vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  closeBtn: { background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#6B7280" },
  inputModal: { padding: "10px 12px", borderRadius: "8px", border: `1px solid ${BRAND.line}`, width: "100%", boxSizing: "border-box", fontSize: "14px", fontFamily: "inherit" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  field: { marginBottom: "12px" },
  label: { display: "block", fontSize: "12.5px", fontWeight: 600, color: BRAND.ink, marginBottom: "4px" },
  subTitulo: { fontSize: "14px", fontWeight: 700, color: BRAND.navy, margin: "0 0 10px" },
  hint: { fontSize: "13px", color: "#6B7280" },
  sidebar: { width: "280px", background: BRAND.verde, color: BRAND.paper, display: "flex", flexDirection: "column", justifyContent: "space-between" },
  sidebarHeader: { padding: "32px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  brandMark: { display: "flex", gap: "6px", marginBottom: "16px" },
  dot: { width: "10px", height: "10px", borderRadius: "50%", display: "inline-block" },
  sidebarTitle: { margin: 0, fontSize: "20px", fontWeight: 800 },
  nav: { flex: 1, padding: "24px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  navItem: { background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", textAlign: "left", padding: "12px 16px", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: "pointer" },
  navItemActive: { background: "rgba(255,255,255,0.1)", color: BRAND.paper },
  sidebarFooter: { padding: "24px", borderTop: "1px solid rgba(255,255,255,0.08)" },
  schoolInfo: { fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "16px", lineHeight: "1.5" },
  logoutBtn: { width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: BRAND.paper, padding: "12px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  main: { flex: 1, overflowY: "auto", padding: "40px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" },
  pageTitle: { margin: "0 0 8px 0", fontSize: "28px", fontWeight: 800, color: BRAND.navy },
  pageSubtitle: { margin: 0, fontSize: "15px", color: "#6B7280" },
  primaryBtn: { background: BRAND.verde, color: BRAND.paper, border: "none", padding: "12px 20px", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { background: BRAND.paper, border: `1px solid ${BRAND.line}`, color: BRAND.ink, padding: "10px 16px", borderRadius: "6px", fontSize: "13.5px", fontWeight: 600, cursor: "pointer" },
  dangerBtn: { background: "#FFF5F5", border: `1px solid #FEB2B2`, color: BRAND.vermelho, padding: "10px 16px", borderRadius: "6px", fontSize: "13.5px", fontWeight: 700, cursor: "pointer" },
  linkBtn: { background: "transparent", border: "none", color: BRAND.verde, fontWeight: 700, fontSize: "14px", cursor: "pointer", padding: 0, textAlign: "left" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "28px" },
  statCard: { background: BRAND.paper, borderRadius: "12px", padding: "20px", border: `1px solid ${BRAND.line}`, display: "flex", flexDirection: "column", gap: "6px" },
  statValue: { fontSize: "28px", fontWeight: 800, color: BRAND.navy },
  statLabel: { fontSize: "13px", color: "#6B7280", fontWeight: 600 },
  card: { background: BRAND.paper, borderRadius: "12px", padding: "24px", border: `1px solid ${BRAND.line}`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", marginBottom: "16px" },
  cardTitle: { margin: "0 0 16px 0", fontSize: "18px", fontWeight: 700, color: BRAND.navy },
  filtrosRow: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  inputBusca: { flex: "1 1 220px", padding: "10px 14px", borderRadius: "8px", border: `1px solid ${BRAND.line}`, fontSize: "14px" },
  select: { padding: "10px 14px", borderRadius: "8px", border: `1px solid ${BRAND.line}`, fontSize: "14px", background: BRAND.paper },
  tableContainer: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  th: { padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#6B7280", borderBottom: `1px solid ${BRAND.line}`, textTransform: "uppercase" },
  tr: { borderBottom: `1px solid ${BRAND.line}` },
  td: { padding: "14px 16px", fontSize: "14px", color: BRAND.ink, fontWeight: 500 },
  actionBtn: { background: "transparent", border: `1px solid ${BRAND.line}`, color: BRAND.ink, padding: "6px 10px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
  badge: { padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, display: "inline-block" },
  tipoCard: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", padding: "14px 16px", borderRadius: "10px", border: `1.5px solid ${BRAND.line}`, background: BRAND.paper, cursor: "pointer", textAlign: "left" },
  tipoCardAtivo: { borderColor: BRAND.verde, background: "#F0FFF4" },
  modeloGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "8px" },
  linkUrl: { fontSize: "13px", color: "#6B7280" },
};