import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const BRAND = {
  navy: "#1a1a1a", paper: "#FFFFFF", mist: "#F8F9FA", line: "#E2E8F0", 
  verde: "#008000", vermelho: "#C53030", cinza: "#718096", ink: "#2D3748"
};

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function LojaGestor() {
  const [abaAtiva, setAbaAtiva] = useState("pedidos"); // pedidos | catalogo
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  
  const [modalProduto, setModalProduto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  const [produtoForm, setProdutoForm] = useState({
    nome: "", categoria: "Líder em Mim", valor: 0, valor_promocional: 0, imagem_url: "",
  });
  const [arquivoImagem, setArquivoImagem] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    const { data: prods } = await supabase.from("produtos").select("*").order("criado_em", { ascending: false });
    if (prods) setProdutos(prods);

    const { data: peds } = await supabase.from("pedidos").select("*").order("criado_em", { ascending: false });
    if (peds) setPedidos(peds);
  }

  // --- LÓGICA DO PRODUTO ---
  async function handleSalvarProduto() {
    if (!produtoForm.nome || salvando) return;
    setSalvando(true);
    
    try {
      let urlFinal = produtoForm.imagem_url;
      
      // Se escolheu uma imagem nova, faz o upload para o bucket "loja"
      if (arquivoImagem) {
        const fileExt = arquivoImagem.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('loja').upload(fileName, arquivoImagem);
        
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('loja').getPublicUrl(fileName);
        urlFinal = data.publicUrl;
      }

      const novoProduto = {
        nome: produtoForm.nome,
        categoria: produtoForm.categoria,
        valor: Number(produtoForm.valor),
        valor_promocional: Number(produtoForm.valor_promocional),
        imagem_url: urlFinal,
      };

      await supabase.from("produtos").insert([novoProduto]);
      
      setModalProduto(false);
      setProdutoForm({ nome: "", categoria: "Líder em Mim", valor: 0, valor_promocional: 0, imagem_url: "" });
      setArquivoImagem(null);
      carregarDados();
    } catch (err) {
      alert("Erro ao salvar produto: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatusProduto(id, statusAtual) {
    await supabase.from("produtos").update({ ativo: !statusAtual }).eq("id", id);
    carregarDados();
  }

  // --- LÓGICA DOS PEDIDOS (PIX) ---
  async function alterarStatusPedido(id, novoStatus) {
    const confirma = window.confirm(`Deseja marcar este pedido como ${novoStatus.toUpperCase()}?`);
    if (!confirma) return;

    await supabase.from("pedidos").update({ status: novoStatus }).eq("id", id);
    carregarDados();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: 800, color: BRAND.navy }}>Loja da Escola</h1>
          <p style={{ margin: 0, fontSize: "15px", color: BRAND.cinza }}>Gerencie materiais, Líder em Mim e valide os pagamentos via Pix.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", background: BRAND.paper, padding: "4px", borderRadius: "8px", border: `1px solid ${BRAND.line}` }}>
          <button onClick={() => setAbaAtiva("pedidos")} style={{ ...styles.tabBtn, background: abaAtiva === "pedidos" ? BRAND.mist : "transparent", fontWeight: abaAtiva === "pedidos" ? 700 : 500 }}>
            Pedidos / Comprovantes
          </button>
          <button onClick={() => setAbaAtiva("catalogo")} style={{ ...styles.tabBtn, background: abaAtiva === "catalogo" ? BRAND.mist : "transparent", fontWeight: abaAtiva === "catalogo" ? 700 : 500 }}>
            Catálogo de Produtos
          </button>
        </div>
      </header>

      {/* --- ABA DE PEDIDOS --- */}
      {abaAtiva === "pedidos" && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Últimos Pedidos</h3>
          {pedidos.length === 0 ? <p style={{ color: BRAND.cinza }}>Nenhum pedido recebido ainda.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Aluno / Responsável</th>
                  <th style={styles.th}>Itens</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Comprovante</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} style={styles.tr}>
                    <td style={styles.td}>{formatarData(p.criado_em)}</td>
                    <td style={styles.td}>
                      <strong>{p.aluno_nome}</strong><br/>
                      <span style={{ fontSize: "12px", color: BRAND.cinza }}>{p.responsavel_nome} - {p.telefone}</span>
                    </td>
                    <td style={styles.td}>
                      {p.itens.map((i, idx) => (
                        <div key={idx} style={{ fontSize: "13px" }}>{i.quantidade}x {i.nome}</div>
                      ))}
                    </td>
                    <td style={styles.td}><strong>{formatarMoeda(p.valor_total)}</strong></td>
                    <td style={styles.td}>
                      <a href={p.comprovante_url} target="_blank" rel="noreferrer" style={{ color: BRAND.verde, fontWeight: "bold", textDecoration: "underline", fontSize:"13px" }}>
                        Ver Anexo
                      </a>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge, 
                        background: p.status === 'aprovado' ? '#E6FFFA' : p.status === 'rejeitado' ? '#FFF5F5' : '#FFF6E5',
                        color: p.status === 'aprovado' ? BRAND.verde : p.status === 'rejeitado' ? BRAND.vermelho : '#B7791F'
                      }}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {p.status === 'pendente' && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => alterarStatusPedido(p.id, "aprovado")} style={styles.btnAprovar}>✓ Aprovar</button>
                          <button onClick={() => alterarStatusPedido(p.id, "rejeitado")} style={styles.btnRejeitar}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* --- ABA DE CATÁLOGO --- */}
      {abaAtiva === "catalogo" && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", color: BRAND.navy }}>Produtos à Venda</h3>
            <button onClick={() => setModalProduto(true)} style={{ background: BRAND.verde, color: "white", padding: "8px 16px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
              + Novo Produto
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={styles.th}>Imagem</th>
                <th style={styles.th}>Nome / Categoria</th>
                <th style={styles.th}>Preço à Prazo</th>
                <th style={styles.th}>Preço à Vista (Pix)</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map(p => (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.td}>
                    {p.imagem_url ? <img src={p.imagem_url} alt="Capa" style={{ width: "40px", height: "55px", objectFit: "cover", borderRadius: "4px" }} /> : "—"}
                  </td>
                  <td style={styles.td}>
                    <strong>{p.nome}</strong><br/>
                    <span style={{ fontSize: "12px", color: BRAND.cinza }}>{p.categoria}</span>
                  </td>
                  <td style={styles.td}>{formatarMoeda(p.valor)}</td>
                  <td style={styles.td}><strong style={{color: BRAND.verde}}>{formatarMoeda(p.valor_promocional)}</strong></td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: p.ativo ? '#E6FFFA' : '#EDF2F7', color: p.ativo ? BRAND.verde : BRAND.cinza }}>
                      {p.ativo ? "Ativo" : "Oculto"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => alternarStatusProduto(p.id, p.ativo)} style={styles.btnSecundario}>
                      {p.ativo ? "Ocultar da Loja" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODAL DE PRODUTO --- */}
      {modalProduto && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: BRAND.paper, padding: "32px", borderRadius: "12px", width: "450px" }}>
            <h3 style={{ margin: "0 0 20px 0" }}>Adicionar Produto</h3>
            
            <label style={styles.label}>Nome do Livro/Material</label>
            <input type="text" value={produtoForm.nome} onChange={(e) => setProdutoForm({...produtoForm, nome: e.target.value})} style={styles.input} placeholder="Ex: Líder em Mim - G4" />
            
            <label style={styles.label}>Categoria</label>
            <select value={produtoForm.categoria} onChange={(e) => setProdutoForm({...produtoForm, categoria: e.target.value})} style={styles.input}>
              <option value="Líder em Mim">Líder em Mim</option>
              <option value="Livro Didático">Livro Didático</option>
              <option value="Uniforme">Uniforme</option>
            </select>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Valor (Prazo)</label>
                <input type="number" value={produtoForm.valor} onChange={(e) => setProdutoForm({...produtoForm, valor: e.target.value})} style={styles.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Valor à Vista (Pix)</label>
                <input type="number" value={produtoForm.valor_promocional} onChange={(e) => setProdutoForm({...produtoForm, valor_promocional: e.target.value})} style={styles.input} />
              </div>
            </div>

            <label style={styles.label}>Imagem da Capa</label>
            <input type="file" accept="image/*" onChange={(e) => setArquivoImagem(e.target.files[0])} style={styles.input} />

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button onClick={() => setModalProduto(false)} style={styles.btnSecundario}>Cancelar</button>
              <button onClick={handleSalvarProduto} disabled={salvando} style={{ background: BRAND.verde, color: "white", padding: "10px 16px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold", opacity: salvando ? 0.5 : 1 }}>
                {salvando ? "Salvando..." : "Salvar no Catálogo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { background: "#FFF", borderRadius: "12px", padding: "24px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" },
  cardTitle: { margin: "0 0 20px 0", fontSize: "18px", fontWeight: 700, color: "#1a1a1a" },
  tabBtn: { padding: "8px 16px", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px", color: "#2D3748" },
  th: { padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#718096", borderBottom: "1px solid #E2E8F0", textTransform: "uppercase" },
  tr: { borderBottom: "1px solid #E2E8F0" },
  td: { padding: "14px 16px", fontSize: "14px", color: "#2D3748" },
  badge: { padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, display: "inline-block" },
  btnAprovar: { background: "#E6FFFA", border: "1px solid #008000", color: "#008000", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  btnRejeitar: { background: "#FFF5F5", border: "1px solid #C53030", color: "#C53030", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  btnSecundario: { background: "transparent", border: "1px solid #E2E8F0", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#2D3748", marginBottom: "4px", marginTop: "12px" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
};