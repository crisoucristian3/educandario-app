import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const BRAND = { verde: "#008000", navy: "#1a1a1a", paper: "#FFFFFF", line: "#E2E8F0", mist: "#F8F9FA", cinza: "#718096" };
const CHAVE_PIX = "6106aeee-9bab-4d1f-8c07-ae1a712f03a8";

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function LojaResponsavel({ sessao }) {
  const [abaLoja, setAbaLoja] = useState("comprar"); // "comprar" | "historico"
  
  const [produtos, setProdutos] = useState([]);
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  
  const [modalCheckout, setModalCheckout] = useState(false);
  const [arquivoPix, setArquivoPix] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [chaveCopiada, setChaveCopiada] = useState(false);

  // Dados do aluno associado
  const [nomeAluno, setNomeAluno] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    carregarCatalogo();
    if (sessao?.nome) {
      carregarMeusPedidos();
    }
  }, [sessao]);

  async function carregarCatalogo() {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome", { ascending: true });
    if (data) setProdutos(data);
  }

  async function carregarMeusPedidos() {
    const { data } = await supabase
      .from("pedidos")
      .select("*")
      .ilike("responsavel_nome", sessao.nome) // Traz apenas os pedidos do pai logado
      .order("criado_em", { ascending: false });
    
    if (data) setMeusPedidos(data);
  }

  function copiarChavePix() {
    navigator.clipboard.writeText(CHAVE_PIX);
    setChaveCopiada(true);
    setTimeout(() => setChaveCopiada(false), 2500);
  }

  function adicionarAoCarrinho(produto) {
    const jaTem = carrinho.find(item => item.id === produto.id);
    if (jaTem) {
      setCarrinho(carrinho.map(item => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item));
    } else {
      setCarrinho([...carrinho, { ...produto, quantidade: 1 }]);
    }
  }

  function removerDoCarrinho(id) {
    const atualizado = carrinho.map(item => item.id === id ? { ...item, quantidade: item.quantidade - 1 } : item).filter(item => item.quantidade > 0);
    setCarrinho(atualizado);
  }

  const valorTotalCarrinho = carrinho.reduce((acc, item) => acc + (item.valor_promocional * item.quantidade), 0);

  async function handleFinalizarCompra() {
    if (!arquivoPix || !nomeAluno.trim() || !telefone.trim()) {
      alert("Por favor, preencha o nome do aluno, telefone e anexe o comprovante do Pix.");
      return;
    }

    setEnviando(true);
    try {
      const fileExt = arquivoPix.name.split('.').pop();
      const fileName = `comprovante_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('loja').upload(fileName, arquivoPix);
      
      if (uploadError) throw uploadError;
      const { data: imgData } = supabase.storage.from('loja').getPublicUrl(fileName);

      const novoPedido = {
        aluno_nome: nomeAluno,
        responsavel_nome: sessao.nome,
        telefone: telefone,
        itens: carrinho.map(c => ({ id: c.id, nome: c.nome, quantidade: c.quantidade, valor: c.valor_promocional })),
        valor_total: valorTotalCarrinho,
        comprovante_url: imgData.publicUrl,
        status: 'pendente'
      };

      const { error: dbError } = await supabase.from("pedidos").insert([novoPedido]);
      if (dbError) throw dbError;

      alert("✅ Pedido enviado com sucesso! Acompanhe o status na aba 'Meus Pedidos'.");
      setModalCheckout(false);
      setCarrinho([]);
      setArquivoPix(null);
      setNomeAluno("");
      setTelefone("");
      
      // Atualiza o histórico para mostrar o novo pedido imediatamente
      carregarMeusPedidos();
      setAbaLoja("historico");
      
    } catch (error) {
      alert("Erro ao enviar o pedido: " + error.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "24px", flexDirection: "column" }}>
      
      {/* Menu interno da Loja */}
      <div style={{ display: "flex", gap: "12px", background: BRAND.paper, padding: "4px", borderRadius: "8px", border: `1px solid ${BRAND.line}`, width: "fit-content" }}>
        <button 
          onClick={() => setAbaLoja("comprar")} 
          style={{ ...styles.tabBtn, background: abaLoja === "comprar" ? BRAND.mist : "transparent", fontWeight: abaLoja === "comprar" ? 700 : 500 }}
        >
          Comprar Materiais
        </button>
        <button 
          onClick={() => setAbaLoja("historico")} 
          style={{ ...styles.tabBtn, background: abaLoja === "historico" ? BRAND.mist : "transparent", fontWeight: abaLoja === "historico" ? 700 : 500 }}
        >
          Meus Pedidos ({meusPedidos.length})
        </button>
      </div>

      {abaLoja === "comprar" && (
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* --- VITRINE DE PRODUTOS --- */}
          <div style={{ flex: "1 1 600px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
            {produtos.length === 0 && <p style={{ color: BRAND.cinza }}>Nenhum material disponível na loja no momento.</p>}
            
            {produtos.map(p => (
              <div key={p.id} style={styles.cardProduto}>
                {p.imagem_url ? (
                  <img src={p.imagem_url} alt={p.nome} style={styles.imgProduto} />
                ) : (
                  <div style={{...styles.imgProduto, background: BRAND.mist, display: "flex", alignItems: "center", justifyContent: "center", color: BRAND.cinza}}>Sem foto</div>
                )}
                <div style={{ padding: "16px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: BRAND.verde, textTransform: "uppercase" }}>{p.categoria}</span>
                  <h4 style={{ margin: "4px 0 8px 0", fontSize: "15px", color: BRAND.navy }}>{p.nome}</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: BRAND.cinza, textDecoration: "line-through" }}>{formatarMoeda(p.valor)}</div>
                      <div style={{ fontSize: "16px", fontWeight: 900, color: BRAND.verde }}>{formatarMoeda(p.valor_promocional)} <span style={{fontSize: "10px"}}>Pix</span></div>
                    </div>
                    <button onClick={() => adicionarAoCarrinho(p)} style={styles.btnAdd}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* --- CARRINHO LATERAL --- */}
          <div style={{ width: "320px", background: BRAND.paper, padding: "20px", borderRadius: "12px", border: `1px solid ${BRAND.line}`, position: "sticky", top: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", color: BRAND.navy }}>Meu Carrinho</h3>
            
            {carrinho.length === 0 ? (
              <p style={{ fontSize: "14px", color: BRAND.cinza }}>O carrinho está vazio.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {carrinho.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", borderBottom: `1px solid ${BRAND.line}`, paddingBottom: "8px" }}>
                    <div>
                      <strong style={{ color: BRAND.navy }}>{item.nome}</strong>
                      <div style={{ color: BRAND.cinza }}>{item.quantidade}x {formatarMoeda(item.valor_promocional)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => removerDoCarrinho(item.id)} style={styles.btnQtd}>-</button>
                      <strong>{item.quantidade}</strong>
                      <button onClick={() => adicionarAoCarrinho(item)} style={styles.btnQtd}>+</button>
                    </div>
                  </div>
                ))}
                
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "2px dashed #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 800, color: BRAND.navy }}>
                    <span>Total (Pix):</span>
                    <span style={{ color: BRAND.verde }}>{formatarMoeda(valorTotalCarrinho)}</span>
                  </div>
                  <button onClick={() => setModalCheckout(true)} style={{ ...styles.btnFinalizar, width: "100%", marginTop: "16px" }}>
                    Finalizar Compra
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ABA DE HISTÓRICO DE PEDIDOS --- */}
      {abaLoja === "historico" && (
        <div style={{ background: BRAND.paper, borderRadius: "12px", padding: "24px", border: `1px solid ${BRAND.line}`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", color: BRAND.navy }}>Meus Pedidos</h3>
          
          {meusPedidos.length === 0 ? (
            <p style={{ color: BRAND.cinza }}>Você ainda não realizou nenhum pedido na loja.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {meusPedidos.map(pedido => (
                <div key={pedido.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", border: `1px solid ${BRAND.line}`, borderRadius: "8px", flexWrap: "wrap", gap: "12px" }}>
                  
                  <div style={{ flex: "1 1 200px" }}>
                    <div style={{ fontSize: "12px", color: BRAND.cinza, marginBottom: "4px" }}>Enviado em {formatarData(pedido.criado_em)}</div>
                    <strong>Aluno: {pedido.aluno_nome}</strong>
                    <div style={{ fontSize: "13px", color: BRAND.navy, marginTop: "6px" }}>
                      {pedido.itens.map((item, idx) => (
                        <div key={idx}>• {item.quantidade}x {item.nome}</div>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: BRAND.navy, marginBottom: "8px" }}>
                      {formatarMoeda(pedido.valor_total)}
                    </div>
                    <span style={{
                      ...styles.badge, 
                      background: pedido.status === 'aprovado' ? '#E6FFFA' : pedido.status === 'rejeitado' ? '#FFF5F5' : '#FFF6E5',
                      color: pedido.status === 'aprovado' ? BRAND.verde : pedido.status === 'rejeitado' ? '#C53030' : '#B7791F'
                    }}>
                      {pedido.status === 'pendente' ? '⏳ Em Análise' : pedido.status === 'aprovado' ? '✅ Aprovado' : '❌ Rejeitado'}
                    </span>
                  </div>
                  
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- MODAL DE CHECKOUT (PIX) --- */}
      {modalCheckout && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "20px" }}>Finalizar Pagamento</h3>
              <button onClick={() => setModalCheckout(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ background: "#F0FFF4", border: "1px solid #008000", padding: "16px", borderRadius: "8px", marginBottom: "20px", textAlign: "center" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#008000" }}>Pague via Pix</h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "14px" }}>Transfira <strong>{formatarMoeda(valorTotalCarrinho)}</strong> para a chave aleatória abaixo:</p>
              <div style={{ background: "#FFF", padding: "10px", borderRadius: "6px", fontWeight: "bold", border: "1px dashed #008000", fontSize: "13px", wordBreak: "break-all" }}>
                {CHAVE_PIX}
                <div style={{ fontSize: "12px", color: BRAND.cinza, fontWeight: "normal", marginTop: "4px" }}>
                  Educandário Construtores do Saber
                </div>
              </div>
              <button
                type="button"
                onClick={copiarChavePix}
                style={styles.btnCopiar}
              >
                {chaveCopiada ? "✓ Chave copiada!" : "Copiar chave Pix"}
              </button>
            </div>

            <label style={styles.label}>Nome Completo *</label>
            <input type="text" value={nomeAluno} onChange={e => setNomeAluno(e.target.value)} style={styles.input} placeholder="Para identificarmos a entrega" />

            <label style={styles.label}>Seu Telefone / WhatsApp *</label>
            <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} style={styles.input} placeholder="(99) 99999-9999" />

            <label style={styles.label}>Anexar Comprovante do Pix *</label>
            <input type="file" accept="image/*,application/pdf" onChange={e => setArquivoPix(e.target.files[0])} style={styles.input} />

            <button onClick={handleFinalizarCompra} disabled={enviando} style={{ ...styles.btnFinalizar, width: "100%", marginTop: "24px", opacity: enviando ? 0.6 : 1 }}>
              {enviando ? "Enviando Pedido..." : "Enviar Comprovante e Finalizar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  tabBtn: { padding: "8px 16px", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px", color: "#2D3748" },
  cardProduto: { background: BRAND.paper, borderRadius: "10px", border: `1px solid ${BRAND.line}`, overflow: "hidden", display: "flex", flexDirection: "column" },
  imgProduto: { width: "100%", height: "200px", objectFit: "cover" },
  btnAdd: { background: BRAND.verde, color: BRAND.paper, border: "none", borderRadius: "50%", width: "32px", height: "32px", fontSize: "18px", fontWeight: "bold", cursor: "pointer" },
  btnQtd: { background: BRAND.mist, border: `1px solid ${BRAND.line}`, borderRadius: "4px", width: "24px", height: "24px", cursor: "pointer", fontWeight: "bold" },
  btnFinalizar: { background: BRAND.verde, color: BRAND.paper, padding: "12px", border: "none", borderRadius: "8px", fontWeight: 800, fontSize: "15px", cursor: "pointer" },
  btnCopiar: { marginTop: "10px", background: BRAND.paper, color: BRAND.verde, border: `1px solid ${BRAND.verde}`, padding: "8px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 700, cursor: "pointer", width: "100%" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { backgroundColor: BRAND.paper, padding: "32px", borderRadius: "12px", width: "420px", maxWidth: "95%" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: BRAND.navy, marginBottom: "4px", marginTop: "12px" },
  input: { padding: "10px", borderRadius: "6px", border: `1px solid ${BRAND.line}`, width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  badge: { padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, display: "inline-block" },
};