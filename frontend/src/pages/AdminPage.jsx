import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  Pencil,
  Plus,
  ShieldCheck,
  Tags,
  Trash2,
} from "lucide-react";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice, formatDateTime } from "../lib/api.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";

const COR_ESTADO = {
  Submetido: "bg-sky-50 text-sky-700",
  Aceite: "bg-indigo-50 text-indigo-700",
  "Em execução": "bg-amber-50 text-amber-700",
  "Aguarda confirmação": "bg-violet-50 text-violet-700",
  "Concluído": "bg-emerald-50 text-emerald-700",
  Recusado: "bg-red-50 text-red-700",
  Cancelado: "bg-slate-100 text-slate-600",
};

function CategoriaForm({ categoria, onGuardar, onCancelar }) {
  const [nome, setNome] = useState(categoria?.nome || "");
  const [icone, setIcone] = useState(categoria?.icone || "•");
  const [ordem, setOrdem] = useState(categoria?.ordem ?? 0);
  const [ativa, setAtiva] = useState(categoria?.ativa ?? true);

  return (
    <Card className="mb-6 p-6">
      <h3 className="font-display text-lg font-bold text-brand-navy">{categoria ? "Editar categoria" : "Nova categoria"}</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onGuardar({ nome: nome.trim(), icone: icone.trim() || "•", ordem: Number(ordem) || 0, ativa });
        }}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <label className="block">
          <span className="text-xs font-semibold text-brand-muted">Nome</span>
          <Input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-2" required />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-brand-muted">Ícone</span>
          <Input type="text" value={icone} onChange={(e) => setIcone(e.target.value)} className="mt-2" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-brand-muted">Ordem</span>
          <Input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className="mt-2" />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm text-brand-ink">
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="h-4 w-4 accent-primary" />
          Categoria ativa
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <Button type="submit">{categoria ? "Guardar alterações" : "Criar categoria"}</Button>
          <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
        </div>
      </form>
    </Card>
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
    return <div className="min-h-screen bg-brand-mist py-20 text-center text-brand-muted">A carregar…</div>;
  }

  if (!user || (papel && papel !== "admin")) {
    return (
      <div className="min-h-screen bg-brand-mist px-5 py-20 text-center">
        <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">Administração</Badge>
        <h1 className="mt-5 font-display text-4xl font-extrabold text-brand-navy">
          {!user ? "Entra para aceder ao painel" : "Acesso restrito"}
        </h1>
        <p className="mt-3 text-brand-muted">
          {!user ? "Esta área é reservada a administradores." : "Não tens permissão para ver esta página."}
        </p>
        <Button asChild className="mt-7">
          <Link to={!user ? "/conta" : "/"}>{!user ? "Iniciar sessão" : "Voltar ao catálogo"} <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  const { resumo, categorias, servicos, pedidos } = dados;
  const abas = [
    ["resumo", "Resumo", LayoutDashboard],
    ["categorias", "Categorias", Tags],
    ["servicos", "Serviços", BriefcaseBusiness],
    ["pedidos", "Pedidos", ClipboardList],
  ];

  return (
    <div className="min-h-screen bg-brand-mist font-sans text-brand-ink [&_a]:no-underline">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">Administração</Badge>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-brand-navy md:text-5xl">
          Painel de administração
        </h1>
        <p className="mt-3 text-brand-muted">Gere categorias, anúncios e acompanha a atividade da plataforma.</p>

        <div className="mt-8 inline-flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-soft">
          {abas.map(([chave, titulo, Icone]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                aba === chave ? "bg-primary text-white" : "text-brand-muted hover:bg-brand-mist"
              }`}
            >
              <Icone className="h-4 w-4" /> {titulo}
            </button>
          ))}
        </div>

        {mensagem && (
          <p className={`mt-5 rounded-lg p-3 text-sm ${mensagem.includes("Erro") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role="status">
            {mensagem}
          </p>
        )}
        {erro && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="status">{erro}</p>}
        {carregando && <p className="mt-5 text-sm text-brand-muted">A carregar…</p>}

        {!carregando && aba === "resumo" && resumo && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Utilizadores", resumo.utilizadores],
              ["Serviços ativos", resumo.servicosAtivos],
              ["Serviços no total", resumo.servicos],
              ["Pedidos", resumo.pedidos],
              ["Avaliações", resumo.avaliacoes],
              ["Categorias", resumo.categorias],
            ].map(([titulo, valor]) => (
              <Card key={titulo} className="p-6">
                <p className="font-display text-3xl font-extrabold text-brand-navy">{valor}</p>
                <p className="mt-1 text-sm text-brand-muted">{titulo}</p>
              </Card>
            ))}
            {Object.entries(resumo.porEstado || {}).length > 0 && (
              <Card className="p-6 sm:col-span-2 lg:col-span-3">
                <p className="font-display font-bold text-brand-navy">Pedidos por estado</p>
                <p className="mt-2 text-sm text-brand-muted">
                  {Object.entries(resumo.porEstado).map(([estado, total]) => `${estado}: ${total}`).join(" · ")}
                </p>
              </Card>
            )}
          </div>
        )}

        {!carregando && aba === "categorias" && (
          <div className="mt-6">
            <Button type="button" onClick={() => setFormCategoria({ categoria: null })}>
              <Plus className="h-4 w-4" /> Nova categoria
            </Button>
            <div className="mt-6">
              {formCategoria && (
                <CategoriaForm
                  categoria={formCategoria.categoria}
                  onGuardar={guardarCategoria}
                  onCancelar={() => setFormCategoria(null)}
                />
              )}
              <div className="space-y-3">
                {categorias.map((categoria) => (
                  <Card key={categoria._id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <strong className="font-display text-brand-navy">{categoria.icone} {categoria.nome}</strong>
                        <p className="mt-1 text-xs text-brand-muted">/{categoria.slug} · {categoria.totalServicos} serviço(s)</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={categoria.ativa ? "success" : "outline"}>{categoria.ativa ? "Ativa" : "Desativada"}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => pedidoAdmin(
                            `${apiBase}/admin/categorias/${categoria._id}`,
                            { method: "PUT", body: JSON.stringify({ ativa: !categoria.ativa }) },
                            categoria.ativa ? "Categoria desativada." : "Categoria ativada."
                          )}
                        >
                          {categoria.ativa ? "Desativar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="outline" type="button" onClick={() => setFormCategoria({ categoria })}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        {categoria.totalServicos === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            className="text-red-700"
                            onClick={() => {
                              if (!window.confirm(`Queres apagar a categoria "${categoria.nome}"?`)) return;
                              pedidoAdmin(`${apiBase}/admin/categorias/${categoria._id}`, { method: "DELETE" }, "Categoria apagada.");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Apagar
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {!carregando && aba === "servicos" && (
          <div className="mt-6">
            <p className="text-sm text-brand-muted">{servicos.length} serviço(s) no total</p>
            <div className="mt-4 space-y-3">
              {servicos.map((servico) => (
                <Card key={servico._id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <strong className="font-display text-brand-navy">{servico.titulo}</strong>
                      <p className="mt-1 text-xs text-brand-muted">
                        {servico.prestadorNome} · {servico.categoria?.nome || "Sem categoria"} · {servico.zona} · {formatPrice(servico.preco)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={servico.ativo ? "success" : "outline"}>{servico.ativo ? "Ativo" : "Inativo"}</Badge>
                      <Button asChild size="sm" variant="outline"><Link to={`/servico/${servico._id}`}>Ver</Link></Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => pedidoAdmin(
                          `${apiBase}/admin/servicos/${servico._id}/ativo`,
                          { method: "PATCH", body: JSON.stringify({ ativo: !servico.ativo }) },
                          servico.ativo ? "Serviço desativado." : "Serviço ativado."
                        )}
                      >
                        {servico.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!carregando && aba === "pedidos" && (
          <div className="mt-6">
            <p className="text-sm text-brand-muted">{pedidos.length} pedido(s) no total</p>
            <div className="mt-4 space-y-3">
              {pedidos.map((pedido) => (
                <Card key={pedido._id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <strong className="font-display text-brand-navy">{pedido.servicoTitulo}</strong>
                      <p className="mt-1 text-xs text-brand-muted">
                        {pedido.clienteNome} → {pedido.prestadorNome} · {formatDateTime(pedido.criadoEm)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`border-transparent ${COR_ESTADO[pedido.estado] || "bg-brand-mist text-brand-muted"}`}>
                        {pedido.estado}
                      </Badge>
                      <Button asChild size="sm" variant="outline"><Link to={`/pedidos/${pedido._id}`}>Ver</Link></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <p className="mt-10 inline-flex items-center gap-2 text-xs text-brand-muted">
          <ShieldCheck className="h-4 w-4 text-primary" /> Área reservada a administradores. Papéis geridos manualmente.
        </p>
      </div>
    </div>
  );
}
