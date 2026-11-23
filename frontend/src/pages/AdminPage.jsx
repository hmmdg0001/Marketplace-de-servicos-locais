import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice, formatDateTime, estadoClasse } from "../lib/api.js";

function CategoriaForm({ categoria, onGuardar, onCancelar }) {
  const [nome, setNome] = useState(categoria?.nome || "");
  const [icone, setIcone] = useState(categoria?.icone || "•");
  const [ordem, setOrdem] = useState(categoria?.ordem ?? 0);
  const [ativa, setAtiva] = useState(categoria?.ativa ?? true);

  return (
    <form
      className="settings-section admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        onGuardar({ nome: nome.trim(), icone: icone.trim() || "•", ordem: Number(ordem) || 0, ativa });
      }}
    >
      <h3>{categoria ? "Editar categoria" : "Nova categoria"}</h3>
      <label>Nome<input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required /></label>
      <label>Ícone<input type="text" value={icone} onChange={(e) => setIcone(e.target.value)} /></label>
      <label>Ordem<input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} /></label>
      <label className="admin-check">
        <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} /> Categoria ativa
      </label>
      <button className="submit-button" type="submit">Guardar categoria</button>
      <button className="submit-button" type="button" onClick={onCancelar}>Cancelar</button>
    </form>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [papel, setPapel] = useState(null);
  const [aba, setAba] = useState("resumo");
  const [dados, setDados] = useState({ resumo: null, categorias: [], servicos: [], pedidos: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [formCategoria, setFormCategoria] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const token = await user.getIdToken();
      const pedidos = ["resumo", "categorias", "servicos", "pedidos"].map((nome) =>
        fetch(`${apiBase}/admin/${nome}`, { headers: { Authorization: `Bearer ${token}` } }).then(readJson)
      );
      const [resumo, categorias, servicos, listaPedidos] = await Promise.all(pedidos);
      if (resumo.error || categorias.error || servicos.error || listaPedidos.error) {
        throw new Error(resumo.error || categorias.error || servicos.error || listaPedidos.error);
      }
      setDados({ resumo, categorias, servicos, pedidos: listaPedidos });
    } catch (err) {
      setErro(err.message || "Não foi possível carregar o painel.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setPapel(null);
      setCarregando(false);
      return;
    }
    (async () => {
      try {
        const token = await user.getIdToken();
        const perfil = await fetch(`${apiBase}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(readJson);
        if (perfil.user?.role !== "admin") {
          setPapel("user");
          setCarregando(false);
          return;
        }
        setPapel("admin");
        await carregar();
      } catch (err) {
        setErro(err.message || "Não foi possível verificar as permissões.");
        setCarregando(false);
      }
    })();
  }, [user]);

  async function pedidoAdmin(url, opcoes, texto) {
    setMensagem("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(url, {
        ...opcoes,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao guardar"));
      setMensagem(texto);
      await carregar();
      return data;
    } catch (err) {
      setMensagem(err.message || "Erro ao guardar.");
      return null;
    }
  }

  function guardarCategoria(valores) {
    const edicao = formCategoria?.categoria;
    const url = edicao ? `${apiBase}/admin/categorias/${edicao._id}` : `${apiBase}/admin/categorias`;
    pedidoAdmin(
      url,
      { method: edicao ? "PUT" : "POST", body: JSON.stringify(valores) },
      edicao ? "Categoria atualizada." : "Categoria criada."
    ).then((resultado) => {
      if (resultado) setFormCategoria(null);
    });
  }

  if (!authReady) {
    return <section className="catalog-page"><p className="catalog-count">A carregar…</p></section>;
  }

  if (!user) {
    return (
      <section className="catalog-page">
        <div className="catalog-hero">
          <p className="kicker">Administração</p>
          <h1>Entra para aceder ao painel</h1>
          <p className="catalog-subtitle">Esta área é reservada a administradores.</p>
          <Link className="submit-button" to="/conta">Iniciar sessão</Link>
        </div>
      </section>
    );
  }

  if (papel && papel !== "admin") {
    return (
      <section className="catalog-page">
        <div className="catalog-hero">
          <p className="kicker">Administração</p>
          <h1>Acesso restrito</h1>
          <p className="catalog-subtitle">Não tens permissão para ver esta página.</p>
          <Link className="submit-button" to="/">Voltar ao catálogo</Link>
        </div>
      </section>
    );
  }

  const { resumo, categorias, servicos, pedidos } = dados;

  return (
    <section className="catalog-page">
      <div className="catalog-hero">
        <p className="kicker">Administração</p>
        <h1>Painel de administração</h1>
        <p className="catalog-subtitle">Gere categorias, anúncios e acompanha a atividade da plataforma.</p>
      </div>

      <div className="admin-tabs">
        {[
          ["resumo", "Resumo"],
          ["categorias", "Categorias"],
          ["servicos", "Serviços"],
          ["pedidos", "Pedidos"],
        ].map(([chave, titulo]) => (
          <button
            key={chave}
            className="submit-button compact-button"
            type="button"
            onClick={() => setAba(chave)}
            style={aba === chave ? { background: "#1e4632" } : undefined}
          >
            {titulo}
          </button>
        ))}
      </div>

      {mensagem && <p className={`form-message ${mensagem.includes("Erro") ? "error" : "success"}`} role="status">{mensagem}</p>}
      {erro && <p className="form-message error" role="status">{erro}</p>}
      {carregando && <p className="catalog-count">A carregar…</p>}

      {!carregando && aba === "resumo" && resumo && (
        <div className="admin-cards">
          {[
            ["Utilizadores", resumo.utilizadores],
            ["Serviços ativos", resumo.servicosAtivos],
            ["Serviços no total", resumo.servicos],
            ["Pedidos", resumo.pedidos],
            ["Avaliações", resumo.avaliacoes],
            ["Categorias", resumo.categorias],
          ].map(([titulo, valor]) => (
            <div className="admin-card" key={titulo}>
              <strong>{valor}</strong><span>{titulo}</span>
            </div>
          ))}
          {Object.entries(resumo.porEstado || {}).length > 0 && (
            <div className="admin-card admin-card-wide">
              <strong>Pedidos por estado</strong>
              <span>
                {Object.entries(resumo.porEstado).map(([estado, total]) => `${estado}: ${total}`).join(" · ")}
              </span>
            </div>
          )}
        </div>
      )}

      {!carregando && aba === "categorias" && (
        <>
          <button
            className="submit-button admin-novo"
            type="button"
            onClick={() => setFormCategoria({ categoria: null })}
          >
            Nova categoria
          </button>
          {formCategoria && (
            <CategoriaForm
              categoria={formCategoria.categoria}
              onGuardar={guardarCategoria}
              onCancelar={() => setFormCategoria(null)}
            />
          )}
          <div className="admin-lista">
            {categorias.map((categoria) => (
              <div className="admin-linha" key={categoria._id}>
                <div className="admin-linha-main">
                  <strong>{categoria.icone} {categoria.nome}</strong>
                  <small>/{categoria.slug} · {categoria.totalServicos} serviço(s)</small>
                </div>
                <div className="admin-linha-actions">
                  <span className={`admin-badge ${categoria.ativa ? "" : "off"}`}>
                    {categoria.ativa ? "Ativa" : "Desativada"}
                  </span>
                  <button
                    className="submit-button compact-button"
                    type="button"
                    onClick={() => pedidoAdmin(
                      `${apiBase}/admin/categorias/${categoria._id}`,
                      { method: "PUT", body: JSON.stringify({ ativa: !categoria.ativa }) },
                      categoria.ativa ? "Categoria desativada." : "Categoria ativada."
                    )}
                  >
                    {categoria.ativa ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    className="submit-button compact-button"
                    type="button"
                    onClick={() => setFormCategoria({ categoria })}
                  >
                    Editar
                  </button>
                  {categoria.totalServicos === 0 && (
                    <button
                      className="submit-button compact-button"
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Queres apagar a categoria "${categoria.nome}"?`)) return;
                        pedidoAdmin(
                          `${apiBase}/admin/categorias/${categoria._id}`,
                          { method: "DELETE" },
                          "Categoria apagada."
                        );
                      }}
                    >
                      Apagar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!carregando && aba === "servicos" && (
        <>
          <p className="catalog-count">{servicos.length} serviço(s) no total</p>
          <div className="admin-lista">
            {servicos.map((servico) => (
              <div className="admin-linha" key={servico._id}>
                <div className="admin-linha-main">
                  <strong>{servico.titulo}</strong>
                  <small>
                    {servico.prestadorNome} · {servico.categoria?.nome || "Sem categoria"} · {servico.zona} · {formatPrice(servico.preco)}
                  </small>
                </div>
                <div className="admin-linha-actions">
                  <span className={`admin-badge ${servico.ativo ? "" : "off"}`}>
                    {servico.ativo ? "Ativo" : "Inativo"}
                  </span>
                  <Link className="submit-button compact-button" to={`/servico/${servico._id}`}>Ver</Link>
                  <button
                    className="submit-button compact-button"
                    type="button"
                    onClick={() => pedidoAdmin(
                      `${apiBase}/admin/servicos/${servico._id}/ativo`,
                      { method: "PATCH", body: JSON.stringify({ ativo: !servico.ativo }) },
                      servico.ativo ? "Serviço desativado." : "Serviço ativado."
                    )}
                  >
                    {servico.ativo ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!carregando && aba === "pedidos" && (
        <>
          <p className="catalog-count">{pedidos.length} pedido(s) no total</p>
          <div className="admin-lista">
            {pedidos.map((pedido) => (
              <div className="admin-linha" key={pedido._id}>
                <div className="admin-linha-main">
                  <strong>{pedido.servicoTitulo}</strong>
                  <small>
                    {pedido.clienteNome} → {pedido.prestadorNome} · {formatDateTime(pedido.criadoEm)}
                  </small>
                </div>
                <div className="admin-linha-actions">
                  <span className={`order-badge ${estadoClasse(pedido.estado)}`}>{pedido.estado}</span>
                  <Link className="submit-button compact-button" to={`/pedidos/${pedido._id}`}>Ver</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
