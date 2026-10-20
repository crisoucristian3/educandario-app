import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../services/supabase";
import { gerarEBaixarPdfContrato, montarTextoContrato } from "../services/gerarPdfContrato";
import { dispararEmailContrato } from "../services/notificacoes";

const BRAND = {
  navy: "#1a1a1a",
  navyDeep: "#0a0a0a",
  ink: "#2D3748",
  paper: "#FFFFFF",
  mist: "#F8F9FA",
  line: "#E2E8F0",
  vinho: "#800020",
  verde: "#008000",
};

const NOMES_TIPOS = {
  infantil: "Educação Infantil (G02 ao G05)",
  fund1: "Ensino Fundamental I (1º ao 5º ano)",
  fund2: "Ensino Fundamental II (6º ao 9º ano)",
};

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Dancing+Script:wght@600&display=swap');
`;

// Gera um Hash SHA-256 real do texto do contrato + dados da assinatura
async function gerarHashDocumento(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Captura o IP público real da internet do responsável
async function obterIpPublico() {
  try {
    const resp = await fetch("https://api.ipify.org?format=json");
    const json = await resp.json();
    return json.ip || "IP-Verificado";
  } catch {
    return "IP-Registrado-Local";
  }
}

function mapearContratoDoBanco(row) {
  const nomeTipo = NOMES_TIPOS[row.tipo_id] || "Prestação de Serviços Educacionais";
  const valorAnuidadeFmt = Number(row.valor_anuidade || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const valorParcelaFmt = Number(row.valor_parcela || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const objetoContrato = {
    id: row.id,
    tipoId: row.tipo_id,
    nomeTipo,
    titulo: `Contrato de Prestação de Serviços — ${nomeTipo}`,
    alunoNome: row.aluno?.nome || "Aluno",
    aluno: row.aluno,
    contratante1: row.contratante1,
    contratante2: row.contratante2,
    valorAnuidade: Number(row.valor_anuidade),
    valorParcela: Number(row.valor_parcela),
    numParcelas: Number(row.num_parcelas),
    status: row.status,
    criadoEm: row.criado_em,
    prazoAssinaturaData: row.prazo_assinatura_data,
    linkToken: row.link_token,
    pdfRascunhoUrl: row.pdf_rascunho_url,
    pdfAssinadoUrl: row.pdf_assinado_url,
    assinatura: row.assinatura,
    dataAssinatura: row.assinatura?.dataHora
      ? new Date(row.assinatura.dataHora).toLocaleString("pt-BR")
      : null,
    ip: row.assinatura?.ip || null,
    resumo: `Contrato de prestação de serviços educacionais para o ano letivo de 2026 (${nomeTipo}), com anuidade de ${valorAnuidadeFmt} em ${row.numParcelas} parcelas de ${valorParcelaFmt}.`,
  };

  objetoContrato.textoCompleto = montarTextoContrato(objetoContrato, nomeTipo);
  return objetoContrato;
}

export function DashboardResponsavel() {
  const navigate = useNavigate();
  const { token } = useParams(); // Se o pai veio pelo link do WhatsApp (/assinar/:token)

  // ---------- sessão ----------
  const [sessao, setSessao] = useState(null); // null = deslogado; senão { id, nome, email }
  const [modoAuth, setModoAuth] = useState("login"); // "login" | "cadastro"
  const [erroAuth, setErroAuth] = useState("");
  const [carregandoAuth, setCarregandoAuth] = useState(false);
  const [formAuth, setFormAuth] = useState({ nome: "", email: "", senha: "", confirmarSenha: "" });

  // ---------- documentos ----------
  const [documentos, setDocumentos] = useState([]);
  const [carregandoDocs, setCarregandoDocs] = useState(false);

  // ---------- modal de leitura e assinatura ----------
  const [documentoAssinandoId, setDocumentoAssinandoId] = useState(null);
  const [leuAteOFim, setLeuAteOFim] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [nomeAssinatura, setNomeAssinatura] = useState("");
  const [assinando, setAssinando] = useState(false);

  // Se o pai abriu pelo link do WhatsApp (/assinar/TOKEN), já preenche o e-mail e o nome dele na tela de login
  useEffect(() => {
    async function verificarTokenLink() {
      if (!token) return;
      const { data } = await supabase
        .from("contratos")
        .select("*")
        .eq("link_token", token)
        .maybeSingle();

      if (data && data.contratante1) {
        setFormAuth((prev) => ({
          ...prev,
          email: data.contratante1.email || prev.email,
          nome: data.contratante1.nome || prev.nome,
        }));
      }
    }
    verificarTokenLink();
  }, [token]);

  // Busca todos os contratos do responsável logado (pelo e-mail ou pelo token do link)
  async function carregarContratosDoResponsavel(emailUsuario) {
    setCarregandoDocs(true);
    try {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .order("criado_em", { ascending: false });

      if (!error && data) {
        const emailLimpo = emailUsuario.trim().toLowerCase();
        const meusContratos = data
          .filter((row) => {
            const email1 = (row.contratante1?.email || "").trim().toLowerCase();
            const email2 = (row.contratante2?.email || "").trim().toLowerCase();
            const bateToken = token && row.link_token === token;
            return email1 === emailLimpo || email2 === emailLimpo || bateToken;
          })
          .map(mapearContratoDoBanco);

        setDocumentos(meusContratos);
      }
    } finally {
      setCarregandoDocs(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSessao(null);
    setDocumentos([]);
  }

  // ---------- autenticação integrada ao Supabase ----------
  async function handleSubmitAuth(e) {
    e.preventDefault();
    setErroAuth("");

    const emailLimpo = formAuth.email.trim().toLowerCase();
    const senhaLimpa = formAuth.senha.trim();

    if (!emailLimpo || !senhaLimpa) {
      setErroAuth("Preencha e-mail e senha.");
      return;
    }

    if (modoAuth === "cadastro") {
      if (!formAuth.nome.trim()) {
        setErroAuth("Informe seu nome completo.");
        return;
      }
      if (senhaLimpa.length < 6) {
        setErroAuth("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (formAuth.senha !== formAuth.confirmarSenha) {
        setErroAuth("As senhas não coincidem.");
        return;
      }
    }

    setCarregandoAuth(true);
    try {
      let nomeUsuario = formAuth.nome.trim() || emailLimpo.split("@")[0];
      let userId = null;

      if (modoAuth === "cadastro") {
        const { data, error } = await supabase.auth.signUp({
          email: emailLimpo,
          password: senhaLimpa,
          options: { data: { nome: nomeUsuario, role: "responsavel" } },
        });

        if (error && !error.message.includes("already registered")) {
          setErroAuth(error.message);
          return;
        }

        userId = data?.user?.id || null;
        if (userId) {
          await supabase.from("perfis").upsert([
            { id: userId, nome: nomeUsuario, email: emailLimpo, role: "responsavel" },
          ]);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailLimpo,
          password: senhaLimpa,
        });

        // Se o e-mail de confirmação estiver ativado no Supabase ou for teste local,
        // buscamos o nome no contrato correspondente para não travar o pai
        if (error && error.message.includes("Invalid login credentials")) {
          setErroAuth("E-mail ou senha incorretos. Se for seu primeiro acesso, clique na aba 'Primeiro acesso'.");
          return;
        }

        userId = data?.user?.id || null;
        if (data?.user?.user_metadata?.nome) {
          nomeUsuario = data.user.user_metadata.nome;
        }
      }

      setSessao({ id: userId, nome: nomeUsuario, email: emailLimpo });
      await carregarContratosDoResponsavel(emailLimpo);
    } finally {
      setCarregandoAuth(false);
    }
  }

  // ---------- assinatura ----------
  function abrirDocumento(id) {
    setDocumentoAssinandoId(id);
    setLeuAteOFim(false);
    setAceite(false);
    setNomeAssinatura("");
  }

  function fecharDocumento() {
    setDocumentoAssinandoId(null);
  }

  function handleScrollResumo(e) {
    const el = e.target;
    const chegouAoFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
    if (chegouAoFim) setLeuAteOFim(true);
  }

// ---------- Confirma a assinatura, carimba IP/Hash, gera o PDF e atualiza o Gestor ----------
  async function handleConfirmarAssinatura() {
    if (!documentoAssinando || !aceite || !nomeAssinatura.trim() || assinando) return;
    setAssinando(true);

    try {
      const agoraIso = new Date().toISOString();
      const ipReal = await obterIpPublico();
      const userAgent = navigator.userAgent;

      const stringAuditoria = `${documentoAssinando.id}|${nomeAssinatura.trim()}|${ipReal}|${agoraIso}|${documentoAssinando.textoCompleto}`;
      const hashGerado = await gerarHashDocumento(stringAuditoria);

      const dadosAssinatura = {
        assinadoPor: nomeAssinatura.trim(),
        dataHora: agoraIso,
        ip: ipReal,
        hash: hashGerado.slice(0, 32),
        userAgent,
      };

      const contratoAtualizado = {
        ...documentoAssinando,
        status: "assinado",
        assinatura: dadosAssinatura,
        dataAssinatura: new Date(agoraIso).toLocaleString("pt-BR"),
        ip: ipReal,
      };

      // 1) Gera o PDF assinado e sobe para o Storage.
      // ATENÇÃO: Passamos FALSE no último parâmetro! Forçar o download automático no 
      // navegador do WhatsApp no celular trava e cancela a gravação no banco de dados.
      const pdfAssinadoUrl = await gerarEBaixarPdfContrato(
        contratoAtualizado,
        documentoAssinando.nomeTipo,
        false 
      );

      contratoAtualizado.pdfAssinadoUrl = pdfAssinadoUrl;

      // 2) Atualiza a tabela contratos no Supabase (Agora lendo o erro!)
      const { error: erroContrato } = await supabase
        .from("contratos")
        .update({
          status: "assinado",
          assinatura: dadosAssinatura,
          pdf_assinado_url: pdfAssinadoUrl,
        })
        .eq("id", documentoAssinando.id);

      // Se o banco recusar, a tela PARA aqui e lança o alerta pro pai
      if (erroContrato) throw new Error("Erro ao gravar contrato: " + erroContrato.message);

      // 3) Grava também na tabela de auditoria assinaturas
      const { error: erroAssinatura } = await supabase.from("assinaturas").insert([
        {
          contrato_id: documentoAssinando.id,
          assinado_por: dadosAssinatura.assinadoPor,
          ip_address: dadosAssinatura.ip,
          user_agent: dadosAssinatura.userAgent,
          documento_hash: dadosAssinatura.hash,
          data_assinatura: dadosAssinatura.dataHora,
        },
      ]);

      if (erroAssinatura) throw new Error("Erro na auditoria: " + erroAssinatura.message);

      // 4) SÓ ATUALIZA A TELA SE O BANCO DE DADOS DEIXOU SALVAR
      setDocumentos((prev) =>
        prev.map((d) => (d.id === documentoAssinandoId ? contratoAtualizado : d))
      );

      fecharDocumento();
      alert("✅ Contrato assinado com sucesso! Você já pode baixar a 2ª via na sua tela.");
      
    } catch (err) {
      console.error("Erro ao assinar contrato:", err);
      // Agora o pai (e você) verá o motivo exato se der erro
      alert("Ocorreu um erro de conexão com o banco de dados. Tente assinar novamente.\n\nDetalhe: " + err.message);
    } finally {
      setAssinando(false);
    }
  }

  async function baixarPDF(doc) {
    await gerarEBaixarPdfContrato(doc, doc.nomeTipo, true);
  }

  function enviarCopiaPorEmail(doc) {
    dispararEmailContrato({
      paraEmail: sessao.email,
      paraNome: doc.assinatura?.assinadoPor || sessao.nome,
      nomeAluno: doc.alunoNome,
      linkAcesso: window.location.origin,
      pdfUrl: doc.pdfAssinadoUrl,
      tipoEvento: "assinado",
    });
  }

  const docsPendentes = documentos.filter((d) => d.status === "pendente");
  const documentoAssinando = documentos.find((d) => d.id === documentoAssinandoId);

  // ================= TELA DE LOGIN / CADASTRO =================
  if (!sessao) {
    return (
      <div style={styles.authPage}>
        <style>{fontImport}</style>
        <div style={styles.authCard}>
          <div style={styles.authStripe} />
          <div style={styles.brandMarkCentro}>
            <span style={{ ...styles.dot, background: BRAND.vinho }} />
            <span style={{ ...styles.dot, background: BRAND.verde }} />
          </div>
          <h1 style={styles.authTitle}>Educandário Construtores do Saber</h1>
          <p style={styles.authSubtitle}>
            {modoAuth === "login"
              ? "Acesse para ver e assinar seus contratos."
              : "Primeiro acesso? Crie sua conta de responsável."}
          </p>

          <div style={styles.tabsAuth}>
            <button
              onClick={() => setModoAuth("login")}
              style={{ ...styles.tabAuth, ...(modoAuth === "login" ? styles.tabAuthAtiva : {}) }}
            >
              Já tenho conta
            </button>
            <button
              onClick={() => setModoAuth("cadastro")}
              style={{ ...styles.tabAuth, ...(modoAuth === "cadastro" ? styles.tabAuthAtiva : {}) }}
            >
              Primeiro acesso
            </button>
          </div>

          <form onSubmit={handleSubmitAuth} style={styles.formAuth}>
            {modoAuth === "cadastro" && (
              <div style={styles.field}>
                <label style={styles.label}>Nome completo</label>
                <input
                  type="text"
                  value={formAuth.nome}
                  onChange={(e) => setFormAuth({ ...formAuth, nome: e.target.value })}
                  style={styles.input}
                  placeholder="Como aparece no contrato"
                />
              </div>
            )}
            <div style={styles.field}>
              <label style={styles.label}>E-mail</label>
              <input
                type="email"
                value={formAuth.email}
                onChange={(e) => setFormAuth({ ...formAuth, email: e.target.value })}
                style={styles.input}
                placeholder="nome@exemplo.com"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Senha</label>
              <input
                type="password"
                value={formAuth.senha}
                onChange={(e) => setFormAuth({ ...formAuth, senha: e.target.value })}
                style={styles.input}
                placeholder="••••••••"
              />
            </div>
            {modoAuth === "cadastro" && (
              <div style={styles.field}>
                <label style={styles.label}>Confirmar senha</label>
                <input
                  type="password"
                  value={formAuth.confirmarSenha}
                  onChange={(e) => setFormAuth({ ...formAuth, confirmarSenha: e.target.value })}
                  style={styles.input}
                  placeholder="••••••••"
                />
              </div>
            )}

            {erroAuth && <p style={styles.erroAuth}>{erroAuth}</p>}

            <button type="submit" style={styles.submitBtn} disabled={carregandoAuth}>
              {carregandoAuth
                ? "Autenticando..."
                : modoAuth === "login"
                ? "Entrar"
                : "Criar conta e continuar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= DASHBOARD (logado) =================
  return (
    <div style={styles.container}>
      <style>{fontImport}</style>
      <div style={styles.colorBar}>
        <div style={{ flex: 1, background: BRAND.vinho }} />
        <div style={{ flex: 1, background: BRAND.verde }} />
      </div>

      <header style={styles.navbar}>
        <div style={styles.navContent}>
          <div style={styles.brandGroup}>
            <div style={styles.brandMark}>
              <span style={{ ...styles.dot, background: BRAND.vinho }} />
              <span style={{ ...styles.dot, background: BRAND.verde }} />
            </div>
            <h1 style={styles.navTitle}>Educandário Construtores do Saber</h1>
          </div>
          <div style={styles.userMenu}>
            <span style={styles.userName}>Olá, {sessao.nome}</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.contentWrapper}>
          <div style={styles.headerSection}>
            <h2 style={styles.pageTitle}>Área do Responsável</h2>
            <p style={styles.pageSubtitle}>Gerencie as matrículas e contratos dos seus dependentes.</p>
          </div>

          {docsPendentes.length > 0 && (
            <div style={styles.alertCard}>
              <div style={styles.alertIcon}>!</div>
              <div style={styles.alertText}>
                <h3 style={styles.alertTitle}>Assinatura pendente</h3>
                <p style={styles.alertDesc}>
                  Você possui {docsPendentes.length} documento(s) aguardando sua assinatura.
                </p>
              </div>
            </div>
          )}

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Meus documentos</h3>
            <div style={styles.documentList}>
              {carregandoDocs ? (
                <p style={{ color: "#6B7280" }}>Carregando seus contratos...</p>
              ) : documentos.length === 0 ? (
                <p style={{ color: "#6B7280" }}>
                  Nenhum contrato encontrado para o e-mail <strong>{sessao.email}</strong>.
                </p>
              ) : (
                documentos.map((doc) => (
                  <div key={doc.id} style={styles.documentItem}>
                    <div style={styles.docInfo}>
                      <div style={styles.docHeader}>
                        <strong style={styles.docTitle}>{doc.titulo}</strong>
                        {doc.status === "pendente" ? (
                          <span style={styles.badgeWarning}>Aguardando assinatura</span>
                        ) : (
                          <span style={styles.badgeSuccess}>Assinado e válido</span>
                        )}
                      </div>
                      <span style={styles.docStudent}>Aluno: {doc.alunoNome}</span>
                      {doc.dataAssinatura && (
                        <span style={styles.docDate}>
                          Assinado em {doc.dataAssinatura} — IP {doc.ip}
                        </span>
                      )}
                    </div>

                    {doc.status === "pendente" ? (
                      <button
                        onClick={() => abrirDocumento(doc.id)}
                        style={{ ...styles.secondaryBtn, color: BRAND.verde, borderColor: BRAND.verde }}
                      >
                        Ler e assinar
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button onClick={() => baixarPDF(doc)} style={styles.secondaryBtn}>
                          Baixar PDF (2ª via)
                        </button>
                        <button onClick={() => enviarCopiaPorEmail(doc)} style={styles.secondaryBtn}>
                          Enviar por e-mail
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerText}>Educandário Construtores do Saber • Rua Orfileno Léda, S/N - Centro - Tuntum/MA</p>
        <p style={styles.footerText}>CNPJ: 39.691.139/0001-64 • INEP: 21287899</p>
      </footer>

      {/* ---------------- MODAL: LER E ASSINAR ---------------- */}
      {documentoAssinando && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.cardTitle}>{documentoAssinando.titulo}</h3>
              <button onClick={fecharDocumento} style={styles.closeBtn}>✕</button>
            </div>

            <p style={{ fontSize: "13px", color: "#6B7280", marginTop: 0 }}>
              Role até o fim do contrato abaixo para liberar a assinatura. O texto completo, com todas as
              cláusulas, é o mesmo que será gerado no PDF final.
            </p>

            <div style={styles.caixaTexto} onScroll={handleScrollResumo}>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
                {documentoAssinando.textoCompleto}
              </pre>
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={aceite}
                disabled={!leuAteOFim}
                onChange={(e) => setAceite(e.target.checked)}
                style={styles.checkbox}
              />
              Li e concordo integralmente com os termos deste contrato.
            </label>

<div style={styles.field}>
              <label style={styles.label}>
                Digite seu nome completo como assinatura <span style={{ color: "#C53030" }}>*</span>
              </label>
              <input
                type="text"
                value={nomeAssinatura}
                onChange={(e) => setNomeAssinatura(e.target.value)}
                disabled={!aceite}
                style={{
                  ...styles.input,
                  borderColor: !nomeAssinatura.trim() ? "#C53030" : "#E2E8F0"
                }}
                placeholder={sessao.nome}
              />
              {!nomeAssinatura.trim() && (
                <p style={{ color: "#C53030", fontSize: "12px", marginTop: "4px", marginBottom: 0 }}>
                  Obrigatório digitar seu nome para liberar a assinatura.
                </p>
              )}
            </div>

            {nomeAssinatura.trim() && (
              <div style={styles.previewAssinatura}>{nomeAssinatura}</div>
            )}

            <p style={styles.hintAssinatura}>
              O que valida esta assinatura não é o desenho acima — é o registro do horário,
              do endereço IP e um hash criptográfico SHA-256 do documento no momento da confirmação.
            </p>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={fecharDocumento} style={styles.secondaryBtn}>Cancelar</button>
              <button
                onClick={handleConfirmarAssinatura}
                disabled={!aceite || !nomeAssinatura.trim() || assinando}
                style={{
                  ...styles.primaryBtn,
                  opacity: aceite && nomeAssinatura.trim() && !assinando ? 1 : 0.5,
                  cursor: aceite && nomeAssinatura.trim() && !assinando ? "pointer" : "not-allowed"
                }}
              >
                {assinando ? "Registrando e gerando PDF..." : "Confirmar assinatura"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  // ---------- tela de autenticação ----------
  authPage: { minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.mist, fontFamily: "'Manrope', system-ui, sans-serif", padding: "24px" },
  authCard: { position: "relative", background: BRAND.paper, borderRadius: "14px", padding: "40px 32px", width: "420px", maxWidth: "100%", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)", overflow: "hidden" },
  authStripe: { position: "absolute", top: 0, left: 0, right: 0, height: "5px", background: `linear-gradient(90deg, ${BRAND.vinho}, ${BRAND.verde})` },
  brandMarkCentro: { display: "flex", gap: "6px", justifyContent: "center", marginBottom: "12px" },
  authTitle: { textAlign: "center", fontSize: "20px", fontWeight: 800, color: BRAND.navy, margin: "0 0 6px" },
  authSubtitle: { textAlign: "center", fontSize: "14px", color: "#6B7280", margin: "0 0 24px" },
  tabsAuth: { display: "flex", background: BRAND.mist, borderRadius: "8px", padding: "4px", marginBottom: "20px" },
  tabAuth: { flex: 1, padding: "8px", border: "none", background: "transparent", borderRadius: "6px", fontSize: "13px", fontWeight: 700, color: "#6B7280", cursor: "pointer" },
  tabAuthAtiva: { background: BRAND.paper, color: BRAND.navy, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  formAuth: { display: "flex", flexDirection: "column", gap: "14px" },
  erroAuth: { color: BRAND.vinho, fontSize: "13px", margin: 0 },
  submitBtn: { background: BRAND.navy, color: BRAND.paper, border: "none", padding: "13px", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginTop: "4px" },

  // ---------- dashboard ----------
  container: { minHeight: "100vh", width: "100%", fontFamily: "'Manrope', system-ui, sans-serif", background: BRAND.mist, display: "flex", flexDirection: "column" },
  colorBar: { display: "flex", height: "5px", width: "100%" },
  navbar: { background: BRAND.paper, padding: "16px 24px", color: BRAND.navy, borderBottom: `1px solid ${BRAND.line}` },
  navContent: { maxWidth: "1000px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" },
  brandGroup: { display: "flex", alignItems: "center", gap: "12px" },
  brandMark: { display: "flex", gap: "6px" },
  dot: { width: "10px", height: "10px", borderRadius: "50%", display: "inline-block" },
  navTitle: { margin: 0, fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em" },
  userMenu: { display: "flex", alignItems: "center", gap: "24px" },
  userName: { fontSize: "14px", fontWeight: 600 },
  logoutBtn: { background: "transparent", border: `1px solid ${BRAND.line}`, color: BRAND.ink, padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  main: { flex: 1, padding: "32px 24px" },
  contentWrapper: { maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" },
  headerSection: { marginBottom: "8px" },
  pageTitle: { margin: "0 0 8px 0", fontSize: "26px", fontWeight: 800, color: BRAND.navy },
  pageSubtitle: { margin: 0, fontSize: "15px", color: "#6B7280" },
  alertCard: { background: BRAND.paper, border: `2px solid ${BRAND.vinho}`, borderRadius: "12px", padding: "24px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" },
  alertIcon: { width: "48px", height: "48px", background: BRAND.vinho, color: BRAND.paper, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 800, flexShrink: 0 },
  alertText: { flex: "1 1 300px" },
  alertTitle: { margin: "0 0 4px 0", fontSize: "18px", fontWeight: 700, color: BRAND.navy },
  alertDesc: { margin: 0, fontSize: "14px", color: "#4B5262", lineHeight: 1.5 },
  card: { background: BRAND.paper, borderRadius: "12px", padding: "24px", border: `1px solid ${BRAND.line}`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" },
  cardTitle: { margin: 0, fontSize: "18px", fontWeight: 700, color: BRAND.navy },
  documentList: { display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" },
  documentItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", border: `1px solid ${BRAND.line}`, borderRadius: "10px", background: BRAND.paper, flexWrap: "wrap", gap: "16px" },
  docInfo: { display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 300px" },
  docHeader: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  docTitle: { fontSize: "16px", color: BRAND.navy, fontWeight: 600 },
  docStudent: { fontSize: "14px", color: "#4B5262", fontWeight: 500 },
  docDate: { fontSize: "13px", color: "#6B7280" },
  badgeWarning: { background: "#FEF08A", color: "#713F12", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700 },
  badgeSuccess: { background: "#D1FAE5", color: "#065F46", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700 },
  secondaryBtn: { background: BRAND.paper, border: `1px solid ${BRAND.line}`, color: BRAND.ink, padding: "10px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" },
  primaryBtn: { background: BRAND.verde, color: BRAND.paper, border: "none", padding: "10px 18px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" },
  footer: { textAlign: "center", padding: "24px", borderTop: `1px solid ${BRAND.line}`, background: BRAND.paper },
  footerText: { margin: "4px 0", fontSize: "13px", color: "#6B7280" },

  // ---------- campos reutilizados ----------
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: 600, color: BRAND.ink },
  input: { width: "100%", padding: "11px 14px", borderRadius: "8px", border: `1.5px solid ${BRAND.line}`, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" },

  // ---------- modal de assinatura ----------
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" },
  modalContent: { backgroundColor: BRAND.paper, padding: "28px", borderRadius: "12px", width: "560px", maxWidth: "95%", maxHeight: "88vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "4px" },
  closeBtn: { background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#6B7280", flexShrink: 0 },
  caixaTexto: { border: `1px solid ${BRAND.line}`, borderRadius: "8px", padding: "16px", height: "220px", overflowY: "auto", fontSize: "13px", lineHeight: 1.6, color: BRAND.ink, background: BRAND.mist, margin: "12px 0" },
  checkboxRow: { display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13.5px", color: BRAND.ink, margin: "12px 0" },
  checkbox: { width: "16px", height: "16px", marginTop: "2px", accentColor: BRAND.verde },
  previewAssinatura: { fontFamily: "'Dancing Script', cursive", fontSize: "32px", color: BRAND.navy, borderBottom: `2px solid ${BRAND.line}`, padding: "8px 4px 12px", marginTop: "8px" },
  hintAssinatura: { fontSize: "12px", color: "#6B7280", marginTop: "10px", lineHeight: 1.5 },
};