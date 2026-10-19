import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

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

const ColorBar = () => (
  <div style={{ display: "flex", height: "5px", width: "100%", position: "absolute", top: 0, left: 0 }}>
    <div style={{ flex: 1, backgroundColor: BRAND.vinho }}></div>
    <div style={{ flex: 1, backgroundColor: BRAND.verde }}></div>
  </div>
);

export function Login({ tipo = "responsavel" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const isGestor = tipo === "gestor";
  const title = isGestor ? "Acesso da Secretaria" : "Acesso do Responsável";
  const subtitle = isGestor
    ? "Gerencie matrículas e contratos do Educandário."
    : "Acesse para assinar os contratos de matrícula.";

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      // 1. Tenta fazer o login no Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (authError) {
        throw new Error("E-mail ou senha incorretos.");
      }

      // 2. Busca o perfil do usuário para ver se ele é gestor ou responsável
      const { data: perfilData, error: perfilError } = await supabase
        .from("perfis")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (perfilError || !perfilData) {
        throw new Error("Perfil não encontrado no sistema.");
      }

      // 3. Trava de segurança: impede responsável de entrar no painel do gestor e vice-versa
      if (isGestor && perfilData.role !== "gestor") {
        await supabase.auth.signOut();
        throw new Error("Acesso negado. Esta conta não tem privilégios de gestão.");
      }

      // 4. Se tudo deu certo, redireciona para o painel correto
      if (isGestor) {
        navigate("/dashboard-gestor");
      } else {
        navigate("/dashboard-responsavel");
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={styles.container}>
      <ColorBar />
      <style>{fontImport}</style>

      {/* Lado Esquerdo - Formulário */}
      <div style={styles.leftPanel}>
        <div style={styles.formContainer}>
          <div style={styles.brandMark}>
            <span style={{ ...styles.dot, background: BRAND.vinho }} />
            <span style={{ ...styles.dot, background: BRAND.verde }} />
          </div>

          <h1 style={styles.title}>{title}</h1>
          <p style={styles.subtitle}>{subtitle}</p>

          <form style={styles.form} onSubmit={handleLogin}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Insira o seu e-mail"
                style={styles.input}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Insira a sua senha"
                style={styles.input}
                required
              />
            </div>

            {erro && <p style={styles.erroText}>{erro}</p>}

            <button type="submit" style={styles.button} disabled={carregando}>
              {carregando ? "Autenticando..." : "Entrar"}
            </button>

            {!isGestor && (
              <button
                type="button"
                onClick={() => navigate("/")} 
                style={styles.secondaryButton}
              >
                Não tem uma conta? Volte e crie aqui
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Lado Direito - Banner Institucional */}
      <div style={styles.rightPanel}>
        <div style={styles.bannerContent}>
          <h2 style={styles.bannerTitle}>Construtores do Saber</h2>
          <p style={styles.bannerText}>
            Juntos construímos bases fortes para grandes conquistas.
          </p>
        </div>
      </div>
    </div>
  );
}

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`;

const styles = {
  container: { display: "flex", minHeight: "100vh", width: "100%", fontFamily: "'Manrope', system-ui, sans-serif", position: "relative" },
  leftPanel: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.paper, padding: "40px" },
  formContainer: { width: "100%", maxWidth: "400px" },
  brandMark: { display: "flex", gap: "6px", marginBottom: "32px" },
  dot: { width: "12px", height: "12px", borderRadius: "50%", display: "inline-block" },
  title: { margin: "0 0 8px 0", fontSize: "32px", fontWeight: 800, color: BRAND.navy, letterSpacing: "-0.02em" },
  subtitle: { margin: "0 0 40px 0", fontSize: "16px", color: "#6B7280", lineHeight: "1.5" },
  form: { display: "flex", flexDirection: "column", gap: "24px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "14px", fontWeight: 600, color: BRAND.ink },
  input: { padding: "14px 16px", borderRadius: "8px", border: `1px solid ${BRAND.line}`, background: BRAND.paper, fontSize: "16px", color: BRAND.ink, outline: "none", transition: "border-color 0.2s" },
  erroText: { color: BRAND.vinho, fontSize: "14px", margin: "0", fontWeight: 600 },
  button: { background: BRAND.verde, color: BRAND.paper, border: "none", padding: "16px", borderRadius: "8px", fontSize: "16px", fontWeight: 700, cursor: "pointer", marginTop: "8px", transition: "background 0.2s" },
  secondaryButton: { background: "transparent", color: BRAND.vinho, border: `1px solid ${BRAND.vinho}`, padding: "16px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", marginTop: "8px" },
  rightPanel: { flex: 1, background: `linear-gradient(135deg, ${BRAND.verde} 0%, ${BRAND.vinho} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" },
  bannerContent: { maxWidth: "400px", textAlign: "left" },
  bannerTitle: { color: BRAND.paper, fontSize: "48px", fontWeight: 800, lineHeight: "1.1", margin: "0 0 16px 0" },
  bannerText: { color: "rgba(255,255,255,0.8)", fontSize: "18px", lineHeight: "1.6", margin: 0 },
};