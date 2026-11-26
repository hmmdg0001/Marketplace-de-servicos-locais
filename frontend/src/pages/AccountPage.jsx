import React, { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { auth } from "../firebase.js";
import { PORTUGAL_CITIES } from "../data/cities.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";

const apiBase = "/api";

const friendlyErrors = {
  "auth/email-already-in-use": "Este email já tem uma conta. Tenta iniciar sessão.",
  "auth/invalid-email": "O email não parece estar correto.",
  "auth/invalid-credential": "Email ou palavra-passe incorretos.",
  "auth/wrong-password": "Email ou palavra-passe incorretos.",
  "auth/user-not-found": "Não existe conta com este email. Cria uma conta primeiro.",
  "auth/missing-email": "Escreve um email válido.",
  "auth/missing-password": "Escreve a palavra-passe.",
  "auth/weak-password": "Escolhe uma palavra-passe com pelo menos 6 caracteres.",
  "auth/requires-recent-login": "Por segurança, termina a sessão, entra outra vez e repete a ação.",
  "auth/user-disabled": "Esta conta foi desativada. Contacta o suporte.",
  "auth/too-many-requests": "Foram feitas demasiadas tentativas. Tenta novamente mais tarde.",
  "auth/network-request-failed": "Não foi possível ligar. Verifica a tua ligação à internet.",
  "auth/operation-not-allowed": "O registo por email ainda não está ativado no Firebase. Ativa o método Email/Palavra-passe em Authentication → Sign-in method.",
  "auth/invalid-api-key": "A chave Firebase parece inválida. Confirma VITE_FIREBASE_API_KEY no frontend/.env.local.",
  "auth/app-not-authorized": "Este domínio ainda não está autorizado nas definições do Firebase Authentication.",
  "auth/configuration-not-found": "A configuração do Authentication não está concluída no projeto Firebase.",
  "auth/quota-exceeded": "O limite de pedidos do Firebase foi atingido. Tenta novamente mais tarde.",
};

function friendlyError(error) {
  return friendlyErrors[error?.code] || error?.message || "Não foi possível concluir. Tenta novamente.";
}

// Alguns erros do backend (ou do proxy) vêm sem corpo.
// Ler como texto evita o "Unexpected end of JSON input".
async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function apiErrorMessage(res, data, fallback) {
  if (data?.error) return data.error;
  if (res.status === 404) return "A API não respondeu. Confirma que o backend está a correr na porta 3000.";
  return fallback;
}

function Campo({ titulo, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-brand-muted">{titulo}</span>
      {children}
    </label>
  );
}

export default function AccountPage() {
  const [authTab, setAuthTab] = useState("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState({ text: "", kind: "success" });
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState("user");
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: "", telefone: "", cidade: "", bio: "", zona: "" });
  const [panel, setPanel] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const isRegister = authTab === "register";

  function notify(text, kind = "success") {
    setNotice({ text, kind });
  }

  function setProfileField(field, value) {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  }

  async function loadProfile(firebaseUser) {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${apiBase}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao carregar perfil"));
      setProfile(data);
      setProfileForm({
        name: data.user?.name || firebaseUser.displayName || "",
        telefone: data.user?.telefone || "",
        cidade: data.user?.cidade || "",
        bio: data.provider?.bio || "",
        zona: data.provider?.zona || data.user?.cidade || "",
      });
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setDisplayName(currentUser?.displayName || "");
      setEmailVerified(Boolean(currentUser?.emailVerified));
      setAuthReady(true);
      if (currentUser) {
        // Só carrega o perfil depois de garantir que o utilizador existe no Mongo.
        syncUser(currentUser, currentUser.displayName || "").then(() => loadProfile(currentUser));
      } else {
        setRole("user");
        setProfile(null);
        setProfileForm({ name: "", telefone: "", cidade: "", bio: "", zona: "" });
      }
    });
    return unsubscribe;
  }, []);

  // Sincroniza o utilizador no MongoDB (a rota de login cria se não existir)
  // e traz o papel (user/admin) guardado na base de dados.
  async function syncUser(firebaseUser, nameOverride = "") {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, name: nameOverride }),
      });
      const data = await readJson(res);
      if (res.ok && data.user?.role) setRole(data.user.role);
      return data.user || null;
    } catch (err) {
      console.error("Erro ao sincronizar utilizador:", err);
      return null;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    notify("");
    setBusy(true);
    try {
      if (isRegister) {
        const cleanName = name.trim();
        if (!cleanName) {
          notify("Escreve o teu nome para criar a conta.", "error");
          setBusy(false);
          return;
        }

        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);

        // Se o updateProfile falhar a conta já existe, por isso seguimos em frente.
        try {
          await updateProfile(result.user, { displayName: cleanName });
        } catch (err) {
          console.error("Não foi possível guardar o nome no Firebase:", err);
        }
        setDisplayName(cleanName);

        // O nome vai explícito para o backend: o token pode ainda não ter o claim "name".
        await syncUser(result.user, cleanName);

        // Envia email de verificação logo após o registo
        try {
          await sendEmailVerification(result.user);
          notify("Conta criada! Enviámos um email de verificação para " + result.user.email + ".");
        } catch {
          notify("Conta criada. Podes enviar o email de verificação nas definições.");
        }
      } else {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        await syncUser(result.user, result.user.displayName || "");
        notify("Sessão iniciada com sucesso.");
      }
    } catch (error) {
      notify(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  function changeTab(nextTab) {
    setAuthTab(nextTab);
    notify("");
    setShowResetForm(false);
    setResetEmail("");
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut(auth);
      notify("Sessão terminada.");
      setPanel(null);
      setShowResetForm(false);
      setResetEmail("");
      setVerificationSent(false);
    } catch {
      notify("Não foi possível terminar a sessão. Tenta novamente.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    notify("");
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      notify("Email de reset enviado! Verifica a caixa de entrada e o spam.");
      setShowResetForm(false);
      setResetEmail("");
    } catch (error) {
      notify(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleProfileUpdate(event) {
    event.preventDefault();
    notify("");
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const novoNome = profileForm.name.trim();

      if (!novoNome) {
        notify("O nome não pode ficar vazio.", "error");
        setBusy(false);
        return;
      }

      const res = await fetch(`${apiBase}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: novoNome,
          telefone: profileForm.telefone,
          cidade: profileForm.cidade,
          bio: profileForm.bio,
          zona: profileForm.zona,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao atualizar perfil"));

      if (data.user?.name && data.user.name !== displayName) {
        await updateProfile(user, { displayName: data.user.name });
        setDisplayName(data.user.name);
      }

      setProfile({ user: data.user, provider: data.provider });
      setProfileForm((prev) => ({
        ...prev,
        name: data.user?.name || prev.name,
        telefone: data.user?.telefone || "",
        cidade: data.user?.cidade || "",
        bio: data.provider?.bio || "",
        zona: data.provider?.zona || "",
      }));
      notify("Perfil atualizado com sucesso!");
    } catch (error) {
      notify(error.message || "Erro ao atualizar perfil.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendVerification() {
    notify("");
    setBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationSent(true);
      notify("Email de verificação enviado! Verifica a caixa de entrada e o spam.");
    } catch (error) {
      notify(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckVerification() {
    setBusy(true);
    try {
      await auth.currentUser.reload();
      const verified = Boolean(auth.currentUser.emailVerified);
      setEmailVerified(verified);
      notify(verified ? "Email verificado com sucesso! ✓" : "Ainda não está verificado. Confirma o link no email.", verified ? "success" : "error");
    } catch (error) {
      notify("Não foi possível verificar o estado do email.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmacao = window.confirm(
      "Queres mesmo apagar a tua conta e todos os teus dados? Esta ação não se pode anular."
    );
    if (!confirmacao) return;

    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/profile`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao eliminar a conta"));
      await signOut(auth);
      window.location.href = "/";
    } catch (err) {
      notify(err.message || "Erro ao eliminar a conta.", "error");
      setBusy(false);
    }
  }

  if (!authReady) {
    return <div className="min-h-screen bg-brand-mist py-20 text-center text-brand-muted">A carregar…</div>;
  }

  const autenticado = authReady && user;

  return (
    <div className="min-h-screen bg-brand-mist px-5 py-10 font-sans text-brand-ink [&_a]:no-underline">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.9fr_1.1fr]">
        <div className="flex flex-col justify-between rounded-3xl bg-brand-navy p-8 text-white md:p-10">
          <div>
            <Badge variant="outline" className="border-white/25 bg-white/10 text-white">
              {autenticado ? "A minha conta" : "A comunidade começa aqui"}
            </Badge>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              {autenticado ? (
                <>Olá, <span className="text-sky-300">{displayName || "bem-vindo/a"}</span>.</>
              ) : (
                <>Há sempre alguém <span className="text-sky-300">perto</span> que sabe ajudar.</>
              )}
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-white/70">
              {autenticado
                ? "Gere os teus serviços e pedidos a partir daqui."
                : "Encontra profissionais de confiança na tua zona ou dá a conhecer o teu talento à comunidade."}
            </p>
          </div>

          {autenticado ? (
            <div className="mt-10 grid gap-3">
              <Button asChild variant="outline" className="justify-start border-white/25 bg-white text-brand-navy hover:bg-white/90">
                <a href="/servicos"><BriefcaseBusiness className="h-4 w-4" /> Os meus serviços</a>
              </Button>
              <Button asChild variant="outline" className="justify-start border-white/25 bg-white text-brand-navy hover:bg-white/90">
                <a href="/pedidos"><ClipboardList className="h-4 w-4" /> Serviços que pedi</a>
              </Button>
              {role === "admin" && (
                <Button asChild variant="outline" className="justify-start border-white/25 bg-white text-brand-navy hover:bg-white/90">
                  <a href="/admin"><ShieldCheck className="h-4 w-4" /> Painel de administração</a>
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-10 flex items-center gap-4 rounded-2xl bg-white/10 p-5">
              <div className="flex -space-x-2" aria-hidden="true">
                {["m", "j", "r", "+"].map((letra) => (
                  <span key={letra} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-brand-navy bg-sky-200 text-xs font-bold text-brand-navy">
                    {letra}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-white/80">
                <strong className="text-white">Talento local, confiança real.</strong><br />
                Pequenos serviços. Grandes ligações.
              </p>
            </div>
          )}
        </div>

        <Card>
          <CardContent className="p-6 md:p-8">
            {autenticado ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-display text-xl font-extrabold text-white">
                    {(displayName || user.email || "S").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-muted">Sessão iniciada</p>
                    <h2 className="font-display text-2xl font-extrabold text-brand-navy">{displayName || "bem-vindo/a"}</h2>
                  </div>
                </div>

                <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-mist p-3 text-sm text-brand-muted">
                  <Mail className="h-4 w-4 text-primary" /> {user.email}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {role === "admin" && <Badge>Administrador</Badge>}
                  {profile?.provider && <Badge variant="success"><CheckCircle2 className="h-3.5 w-3.5" /> Prestador</Badge>}
                  {!emailVerified && <Badge variant="outline">Email por verificar</Badge>}
                  {emailVerified && <Badge variant="success"><CheckCircle2 className="h-3.5 w-3.5" /> Email verificado</Badge>}
                </div>

                {(profile?.user?.cidade || profile?.user?.telefone) && (
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-brand-muted">
                    {profile.user.cidade && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" /> {profile.user.cidade}</span>}
                    {profile.user.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4 text-primary" /> {profile.user.telefone}</span>}
                  </div>
                )}

                {profile?.provider && (
                  <p className="mt-4 inline-flex items-center gap-2 text-sm text-brand-muted">
                    <Star className="h-4 w-4 text-amber-500" />
                    {profile.provider.totalAvaliacoes > 0
                      ? `${profile.provider.mediaAvaliacoes.toFixed(1)}/5 em ${profile.provider.totalAvaliacoes} avaliações`
                      : "Ainda sem avaliações"}
                  </p>
                )}

                {notice.text && (
                  <p className={`mt-5 rounded-lg p-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role="status">
                    {notice.text}
                  </p>
                )}

                {panel === null ? (
                  <div className="mt-6 grid gap-3">
                    <Button type="button" onClick={() => { setPanel("profile"); notify(""); }} disabled={busy} className="justify-start">
                      <Settings2 className="h-4 w-4" /> Minhas definições
                    </Button>
                    <Button asChild variant="outline" className="justify-start">
                      <a href="/servicos"><BriefcaseBusiness className="h-4 w-4" /> Criar serviço</a>
                    </Button>
                    <Button type="button" variant="outline" onClick={handleSignOut} disabled={busy} className="justify-start">
                      <LogOut className="h-4 w-4" /> {busy ? "A terminar sessão…" : "Terminar sessão"}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleProfileUpdate} className="mt-6 space-y-4 border-t border-brand-line pt-6">
                    <h3 className="font-display text-lg font-bold text-brand-navy">O meu perfil</h3>
                    <Campo titulo="Nome">
                      <Input type="text" value={profileForm.name} onChange={(event) => setProfileField("name", event.target.value)} className="mt-2" required />
                    </Campo>
                    <Campo titulo="Email">
                      <Input type="email" value={user.email || ""} readOnly className="mt-2 bg-brand-mist" />
                    </Campo>
                    <Campo titulo="Telefone">
                      <Input type="tel" value={profileForm.telefone} onChange={(event) => setProfileField("telefone", event.target.value)} placeholder="Opcional" className="mt-2" />
                    </Campo>
                    <Campo titulo="Concelho">
                      <select value={profileForm.cidade} onChange={(event) => setProfileField("cidade", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary">
                        <option value="">Escolhe o teu concelho</option>
                        {PORTUGAL_CITIES.map((group) => (
                          <optgroup key={group.district} label={group.district}>
                            {group.cities.map((city) => <option key={city} value={city}>{city}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </Campo>
                    <Campo titulo="Sobre mim">
                      <textarea rows={3} value={profileForm.bio} onChange={(event) => setProfileField("bio", event.target.value)} placeholder="Uma pequena apresentação para os clientes" className="mt-2 w-full rounded-lg border border-brand-line bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                    </Campo>
                    <Campo titulo="Zona de atendimento">
                      <select value={profileForm.zona} onChange={(event) => setProfileField("zona", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary">
                        <option value="">Escolhe a zona</option>
                        {PORTUGAL_CITIES.map((group) => (
                          <optgroup key={group.district} label={group.district}>
                            {group.cities.map((city) => <option key={city} value={city}>{city}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </Campo>
                    <p className="text-xs text-brand-muted">A descrição e a zona aparecem na tua página de prestador.</p>

                    {emailVerified ? (
                      <p className="inline-flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Email verificado</p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <Button type="button" variant="outline" onClick={handleSendVerification} disabled={busy}>
                          {busy ? "A enviar…" : "Enviar email de verificação"}
                        </Button>
                        {verificationSent && (
                          <Button type="button" variant="outline" onClick={handleCheckVerification} disabled={busy}>
                            Já confirmei o email
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button type="submit" disabled={busy}>{busy ? "A guardar…" : "Guardar alterações"}</Button>
                      <Button type="button" variant="outline" onClick={() => { setPanel(null); notify(""); }} disabled={busy}>Voltar</Button>
                    </div>
                  </form>
                )}

                {panel === "profile" && (
                  <div className="mt-6 rounded-xl border border-red-200 p-5">
                    <h3 className="font-display font-bold text-red-700">Zona de perigo</h3>
                    <p className="mt-2 text-sm text-brand-muted">Apaga a conta, serviços, pedidos e avaliações. Não se pode anular.</p>
                    <Button type="button" variant="outline" onClick={handleDeleteAccount} disabled={busy} className="mt-4 border-red-200 text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" /> Eliminar a minha conta
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-center">
                  <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">A tua próxima ligação</Badge>
                  <h2 className="mt-4 font-display text-3xl font-extrabold text-brand-navy md:text-4xl">
                    {isRegister ? "Junta-te à vizinhança." : "Que bom ver-te."}
                  </h2>
                  <p className="mt-2 text-brand-muted">
                    {isRegister ? "Cria a tua conta gratuitamente." : "Entra na tua conta para continuar."}
                  </p>
                </div>

                <div className="mt-6 inline-flex w-full rounded-full bg-brand-mist p-1" role="tablist" aria-label="Tipo de acesso">
                  {[
                    ["register", "Criar conta"],
                    ["login", "Iniciar sessão"],
                  ].map(([chave, titulo]) => (
                    <button
                      key={chave}
                      type="button"
                      role="tab"
                      aria-selected={isRegister === (chave === "register")}
                      onClick={() => changeTab(chave)}
                      className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        isRegister === (chave === "register") ? "bg-white text-brand-navy shadow-soft" : "text-brand-muted"
                      }`}
                    >
                      {titulo}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {isRegister && (
                    <Campo titulo="Como te chamas?">
                      <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="O teu nome" className="mt-2" required />
                    </Campo>
                  )}
                  <Campo titulo="Email">
                    <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ola@exemplo.pt" className="mt-2" required />
                  </Campo>
                  <Campo titulo="Palavra-passe">
                    <Input type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pelo menos 6 caracteres" minLength={6} className="mt-2" required />
                  </Campo>
                  {notice.text && (
                    <p className={`rounded-lg p-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role="status">
                      {notice.text}
                    </p>
                  )}
                  <Button type="submit" disabled={busy} className="w-full">
                    {busy ? "A processar…" : isRegister ? "Criar a minha conta" : "Entrar na minha conta"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>

                {!isRegister && !showResetForm && (
                  <button type="button" onClick={() => { setShowResetForm(true); notify(""); }} className="mt-4 text-sm font-semibold text-primary hover:underline">
                    Esqueci a minha palavra-passe
                  </button>
                )}

                {showResetForm && (
                  <form onSubmit={handleResetSubmit} className="mt-5 space-y-4 rounded-xl border border-brand-line p-5">
                    <h3 className="font-display font-bold text-brand-navy">Reset de palavra-passe</h3>
                    <p className="text-sm text-brand-muted">Introduz o email da tua conta para receberes um link de reset.</p>
                    <Campo titulo="Email">
                      <Input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="ola@exemplo.pt" className="mt-2" required />
                    </Campo>
                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" disabled={busy}>{busy ? "A enviar…" : "Enviar link de reset"}</Button>
                      <Button type="button" variant="outline" onClick={() => { setShowResetForm(false); notify(""); }} disabled={busy}>Cancelar</Button>
                    </div>
                  </form>
                )}

                <p className="mt-6 text-center text-xs text-brand-muted">
                  Ao continuar, aceitas os nossos <a href="#termos" className="text-primary hover:underline">Termos de utilização</a> e a <a href="#privacidade" className="text-primary hover:underline">Política de privacidade</a>.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
