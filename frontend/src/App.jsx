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
import { auth } from "./firebase.js";

const apiBase = "/api";

const friendlyErrors = {
  "auth/email-already-in-use": "Este email já tem uma conta. Tenta iniciar sessão.",
  "auth/invalid-email": "O email não parece estar correto.",
  "auth/invalid-credential": "Email ou palavra-passe incorretos.",
  "auth/wrong-password": "Email ou palavra-passe incorretos.",
  "auth/user-not-found": "Não existe conta com este email. Cria uma conta primeiro.",
  "auth/missing-email": "Escreve um email válido.",
  "auth/weak-password": "Escolhe uma palavra-passe com pelo menos 6 caracteres.",
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

export default function App() {
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
  const [ownServices, setOwnServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [role, setRole] = useState("user");
  const [panel, setPanel] = useState(null); // null | "create" | "profile"
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const isRegister = authTab === "register";

  function notify(text, kind = "success") {
    setNotice({ text, kind });
  }

  async function loadOwnServices(firebaseUser) {
    if (!firebaseUser) {
      setOwnServices([]);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/services?userId=${firebaseUser.uid}`);
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao carregar serviços"));
      setOwnServices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAllServices() {
    try {
      const res = await fetch(`${apiBase}/services`);
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao carregar serviços"));
      setAllServices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setDisplayName(currentUser?.displayName || "");
      setEmailVerified(Boolean(currentUser?.emailVerified));
      setAuthReady(true);
      loadOwnServices(currentUser);
      if (currentUser) {
        syncUser(currentUser);
      } else {
        setRole("user");
      }
    });
    loadAllServices();
    return unsubscribe;
  }, []);

  // Sincroniza o utilizador no MongoDB (a rota de login cria se não existir)
  // e traz o papel (user/admin) guardado na base de dados.
  async function syncUser(firebaseUser) {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
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
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(result.user, { displayName: name.trim() });
        setDisplayName(name.trim());
        await syncUser(result.user);
        // Envia email de verificação logo após o registo
        try {
          await sendEmailVerification(result.user);
          notify("Conta criada! Enviámos um email de verificação para " + result.user.email + ".");
        } catch {
          notify("Conta criada. Podes enviar o email de verificação nas definições.");
        }
      } else {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        await syncUser(result.user);
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
      const res = await fetch(`${apiBase}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: event.target.name.value,
          email: user.email,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao atualizar perfil"));

      const newName = event.target.name.value;
      await updateProfile(user, { displayName: newName });
      setDisplayName(newName);
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

  async function handleCreateService(event) {
    event.preventDefault();
    notify("");
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: event.target.title.value,
          description: event.target.description.value,
          location: event.target.location.value,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao criar serviço"));

      setOwnServices((prev) => [data, ...prev]);
      setAllServices((prev) => [data, ...prev]);
      notify("Serviço criado com sucesso!");
      setPanel(null);
    } catch (error) {
      notify(error.message || "Erro ao criar serviço.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteService(service) {
    const confirmed = window.confirm(`Queres apagar o serviço "${service.title}"?`);
    if (!confirmed) return;

    notify("");
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/services/${service._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao apagar serviço"));

      setOwnServices((prev) => prev.filter((svc) => svc._id !== service._id));
      setAllServices((prev) => prev.filter((svc) => svc._id !== service._id));
      notify("Serviço apagado.");
    } catch (error) {
      notify(error.message || "Erro ao apagar serviço.", "error");
    } finally {
      setBusy(false);
    }
  }

  const communityServices = user
    ? allServices.filter((svc) => svc.userId !== user.uid)
    : allServices;

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="ServiPerto, início">
          <span className="brand-mark" aria-hidden="true">s</span>
          <span>servi<span className="brand-accent">perto</span></span>
        </a>
        <span className="topbar-note">O talento da tua zona, mais perto.</span>
      </header>

      <section className="auth-layout" id="inicio">
        <div className="intro-panel">
          <div className="eyebrow"><span className="eyebrow-dot" /> A comunidade começa aqui</div>
          <h1>Há sempre alguém <em>por perto</em> que sabe como ajudar.</h1>
          <p className="intro-copy">Encontra profissionais de confiança na tua zona ou dá a conhecer o teu talento à comunidade.</p>
          <div className="neighbourhood-card">
            <div className="avatar-stack" aria-hidden="true"><span>m</span><span>j</span><span>r</span><span>+</span></div>
            <p><strong>Talento local, confiança real.</strong><br />Pequenos serviços. Grandes ligações.</p>
          </div>
          <div className="decor decor-one" /><div className="decor decor-two" />
        </div>

        {authReady && user ? (
          <div className="form-panel account-panel">
            <div className="account-avatar" aria-hidden="true">{(displayName || user.email || "S").charAt(0).toUpperCase()}</div>
            <p className="kicker">Sessão iniciada</p>
            <h2>Olá, {displayName || "bem-vindo/a"}.</h2>
            <p className="form-subtitle">A tua conta ServiPerto está pronta.</p>
            <p className="account-email">{user.email}</p>

            {role === "admin" && <p className="role-badge">Administrador</p>}

            <p className={`form-message ${emailVerified ? "success" : "error"}`}>
              {emailVerified ? "Email verificado ✓" : "Email não verificado"}
            </p>

            {notice.text && <p className={`form-message ${notice.kind}`} role="status">{notice.text}</p>}

            <button className="submit-button" type="button" onClick={handleSignOut} disabled={busy}>
              {busy ? "A terminar sessão…" : "Terminar sessão"}
              <span aria-hidden="true">→</span>
            </button>

            {ownServices.length > 0 && (
              <div className="services-section">
                <h3>Os meus serviços</h3>
                <ul className="service-list">
                  {ownServices.map((svc) => (
                    <li key={svc._id} className="service-item">
                      <div>
                        <strong>{svc.title}</strong>
                        {svc.description && <span>{svc.description}</span>}
                        {svc.location && <span>📍 {svc.location}</span>}
                      </div>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => handleDeleteService(svc)}
                        disabled={busy}
                      >
                        Apagar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Botões de ação - só aparecem quando nenhum painel está aberto */}
            {panel === null && (
              <>
                <button className="submit-button" type="button" onClick={() => { setPanel("create"); notify(""); }} disabled={busy}>
                  Criar serviço
                </button>
                <button className="submit-button" type="button" onClick={() => { setPanel("profile"); notify(""); }} disabled={busy}>
                  Minhas definições
                </button>
              </>
            )}

            {/* Painel: criar serviço (um único local) */}
            {panel === "create" && (
              <div className="settings-section">
                <h3>Criar novo serviço</h3>
                <form onSubmit={handleCreateService}>
                  <label>Título do serviço<input type="text" name="title" required /></label>
                  <label>Descrição<input type="text" name="description" placeholder="Descreve o serviço" /></label>
                  <label>Localização<input type="text" name="location" placeholder="Ex: Lisboa, Porto" /></label>
                  <button className="submit-button" type="submit" disabled={busy}>
                    {busy ? "A guardar…" : "Guardar serviço"}
                  </button>
                  <button className="submit-button" type="button" onClick={() => { setPanel(null); notify(""); }} disabled={busy}>
                    Cancelar
                  </button>
                </form>
              </div>
            )}

            {/* Painel: definições / perfil */}
            {panel === "profile" && (
              <div className="settings-section">
                <h3>Minhas definições</h3>
                <form onSubmit={handleProfileUpdate}>
                  <label>Nome<input type="text" name="name" defaultValue={displayName} required /></label>
                  <label>Email<input type="email" name="email" defaultValue={user.email || ""} readOnly /></label>

                  {emailVerified ? (
                    <p className="form-message success">Email verificado ✓</p>
                  ) : (
                    <>
                      <button className="submit-button" type="button" onClick={handleSendVerification} disabled={busy}>
                        {busy ? "A enviar…" : "Enviar email de verificação"}
                      </button>
                      {verificationSent && (
                        <button className="submit-button" type="button" onClick={handleCheckVerification} disabled={busy}>
                          Já confirmei o email
                        </button>
                      )}
                    </>
                  )}

                  <button className="submit-button" type="submit" disabled={busy}>
                    {busy ? "A salvar…" : "Guardar alterações"}
                  </button>
                  <button className="submit-button" type="button" onClick={() => { setPanel(null); notify(""); }} disabled={busy}>
                    Voltar
                  </button>
                </form>
              </div>
            )}

            {communityServices.length > 0 && (
              <div className="services-section">
                <h3>Serviços da comunidade</h3>
                <ul className="service-list">
                  {communityServices.map((svc) => (
                    <li key={svc._id} className="service-item">
                      <div>
                        <strong>{svc.title}</strong>
                        {svc.description && <span>{svc.description}</span>}
                        {svc.location && <span>📍 {svc.location}</span>}
                      </div>
                      {role === "admin" && (
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => handleDeleteService(svc)}
                          disabled={busy}
                        >
                          Apagar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="form-panel">
            <div className="form-heading">
              <div className="form-icon" aria-hidden="true">✳</div>
              <p className="kicker">A tua próxima ligação começa aqui</p>
              <h2>{isRegister ? "Junta-te à vizinhança." : "Que bom ver-te."}</h2>
              <p className="form-subtitle">
                {isRegister ? "Cria a tua conta gratuitamente." : "Entra na tua conta para continuar."}
              </p>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Tipo de acesso">
              <button type="button" role="tab" aria-selected={isRegister} className={isRegister ? "selected" : ""} onClick={() => changeTab("register")}>Criar conta</button>
              <button type="button" role="tab" aria-selected={!isRegister} className={!isRegister ? "selected" : ""} onClick={() => changeTab("login")}>Iniciar sessão</button>
            </div>

            <form onSubmit={handleSubmit}>
              {isRegister && <label>Como te chamas?<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="O teu nome" required /></label>}
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ola@exemplo.pt" required /></label>
              <label>Palavra-passe<input type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pelo menos 6 caracteres" minLength={6} required /></label>
              {notice.text && <p className={`form-message ${notice.kind}`} role="status">{notice.text}</p>}
              <button className="submit-button" type="submit" disabled={busy}>
                {busy ? "A processar…" : isRegister ? "Criar a minha conta" : "Entrar na minha conta"}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            {!isRegister && !showResetForm && (
              <p>
                <a onClick={() => { setShowResetForm(true); notify(""); }} style={{ cursor: "pointer", textDecoration: "underline" }}>
                  Esqueci a minha palavra-passe
                </a>
              </p>
            )}

            {showResetForm && (
              <div className="reset-section">
                <h3>Reset de palavra-passe</h3>
                <p>Introduz o email da tua conta para receber um link de reset.</p>
                <form onSubmit={handleResetSubmit}>
                  <label>Email<input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="ola@exemplo.pt" required /></label>
                  <button className="submit-button" type="submit" disabled={busy}>
                    {busy ? "A enviar…" : "Enviar link de reset"}
                  </button>
                  <button className="submit-button" type="button" onClick={() => { setShowResetForm(false); notify(""); }} disabled={busy}>
                    Cancelar
                  </button>
                </form>
              </div>
            )}

            <p className="terms">Ao continuar, aceitas os nossos <a href="#termos">Termos de utilização</a> e a <a href="#privacidade">Política de privacidade</a>.</p>
          </div>
        )}
      </section>

      <footer className="footer"><span>© 2026 ServiPerto</span><span>Feito para aproximar pessoas.</span></footer>
    </main>
  );
}