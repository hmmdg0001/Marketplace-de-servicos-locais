import React, { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { PORTUGAL_CITIES } from "../data/cities.js";

const apiBase = "/api";
const CLOUDINARY_UPLOAD_URL = (cloudName) => `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

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
  const [ownServices, setOwnServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [role, setRole] = useState("user");
  const [profile, setProfile] = useState(null); // { user, provider }
  const [profileForm, setProfileForm] = useState({ name: "", telefone: "", cidade: "", bio: "", zona: "" });
  const [panel, setPanel] = useState(null); // null | "create" | "profile"
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [cloudinaryConfig, setCloudinaryConfig] = useState(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [serviceImages, setServiceImages] = useState([]);
  const fileInputRef = useRef(null);

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

  async function fetchCloudinaryConfig() {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/upload/assinatura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pasta: "servicos" }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao obter configuração de upload"));
      setCloudinaryConfig(data);
    } catch (err) {
      console.error("Erro ao obter config Cloudinary:", err);
    }
  }

  async function uploadImagesToCloudinary(files) {
    if (!cloudinaryConfig || files.length === 0) return [];
    setUploadingImages(true);
    const urls = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", cloudinaryConfig.apiKey);
        formData.append("timestamp", cloudinaryConfig.timestamp.toString());
        formData.append("signature", cloudinaryConfig.signature);
        formData.append("folder", cloudinaryConfig.folder);
        formData.append("resource_type", "image");

        const res = await fetch(CLOUDINARY_UPLOAD_URL(cloudinaryConfig.cloudName), {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Erro no upload");
        urls.push(data.secure_url);
      }
      return urls;
    } catch (err) {
      notify(err.message || "Erro ao enviar imagens.", "error");
      return [];
    } finally {
      setUploadingImages(false);
    }
  }

  function handleFileSelect(event) {
    const files = Array.from(event.target.files).slice(0, 6);
    const previews = files.map((file) => URL.createObjectURL(file));
    setServiceImages(previews);
  }

  function removeServiceImage(index) {
    setServiceImages((prev) => prev.filter((_, i) => i !== index));
    // Limpar o input para permitir selecionar o mesmo ficheiro outra vez
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    fetch(`${apiBase}/categories`)
      .then(readJson)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Erro ao carregar categorias:", err));
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

  async function handleCreateService(event) {
    event.preventDefault();
    notify("");
    setBusy(true);
    try {
      // 1) Upload das imagens para o Cloudinary
      const imageFiles = [];
      if (fileInputRef.current?.files) {
        for (const file of fileInputRef.current.files) imageFiles.push(file);
      }
      const imageUrls = await uploadImagesToCloudinary(imageFiles);
      if (imageFiles.length > 0 && imageUrls.length === 0) {
        setBusy(false);
        return;
      }

      // 2) Criar o serviço com as URLs das imagens
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: event.target.title.value,
          descricao: event.target.description.value,
          categoriaId: event.target.categoria.value,
          preco: Number(event.target.preco.value || 0),
          zona: event.target.location.value,
          imagens: imageUrls,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao criar serviço"));

      setOwnServices((prev) => [data, ...prev]);
      notify("Serviço criado com sucesso!");
      setPanel(null);
      setServiceImages([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      notify(error.message || "Erro ao criar serviço.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteService(service) {
    const confirmed = window.confirm(`Queres apagar o serviço "${service.titulo || service.title}"?`);
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
      notify("Serviço apagado.");
    } catch (error) {
      notify(error.message || "Erro ao apagar serviço.", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (panel === "create" && user && !cloudinaryConfig) {
      fetchCloudinaryConfig();
    }
  }, [panel, user, cloudinaryConfig]);

  useEffect(() => {
    if (!user) {
      setOwnServices([]);
      return;
    }
    const uid = user.uid;
    // Pequeno atraso para garantir que o backend está pronto a responder.
    const timer = setTimeout(() => {
      fetch("/api/services?userId=" + uid)
        .then((res) => res.json())
        .then((data) => {
          setOwnServices(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error("Erro ao carregar serviços:", err);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [user]);

  return (
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

            {(role === "admin" || profile?.provider) && (
              <div className="account-badges">
                {role === "admin" && <span className="role-badge">Administrador</span>}
                {profile?.provider && <span className="role-badge">Prestador</span>}
              </div>
            )}

            {(profile?.user?.cidade || profile?.user?.telefone) && (
              <p className="account-meta">
                {profile.user.cidade && <>📍 {profile.user.cidade}</>}
                {profile.user.cidade && profile.user.telefone && <span aria-hidden="true"> · </span>}
                {profile.user.telefone && <>📞 {profile.user.telefone}</>}
              </p>
            )}

            {profile?.provider && (
              <p className="account-provider-stats">
                {profile.provider.totalAvaliacoes > 0
                  ? `${profile.provider.mediaAvaliacoes.toFixed(1)}/5 em ${profile.provider.totalAvaliacoes} avaliação(ões)`
                  : "Ainda sem avaliações"}
                <span aria-hidden="true"> · </span>
                {profile.provider.totalServicos} serviço(s) publicado(s)
              </p>
            )}

            <p className={`form-message ${emailVerified ? "success" : "error"}`}>
              {emailVerified ? "Email verificado ✓" : "Email não verificado"}
            </p>

            {notice.text && <p className={`form-message ${notice.kind}`} role="status">{notice.text}</p>}

            <button className="submit-button" type="button" onClick={handleSignOut} disabled={busy}>
              {busy ? "A terminar sessão…" : "Terminar sessão"}
              <span aria-hidden="true">→</span>
            </button>

            {panel === null && ownServices.length > 0 && (
              <div className="services-section">
                <h3>Os meus serviços <span className="column-count">{ownServices.length}</span></h3>
                <ul className="service-list">
                  {ownServices.map((svc) => (
                    <li key={svc._id} className="service-item">
                      <div>
                        <strong>{svc.titulo || svc.title}</strong>
                        {(svc.descricao || svc.description) && <span>{svc.descricao || svc.description}</span>}
                        {(svc.zona || svc.location) && <span>📍 {svc.zona || svc.location}</span>}
                        {(svc.preco > 0 || svc.price > 0) && (
                          <span>Desde {Number(svc.preco || svc.price).toFixed(2).replace(".", ",")} €</span>
                        )}
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
                  <div className="form-group">
                    <span className="form-label">Fotografias (máx. 6)</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      className="submit-button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy || uploadingImages || serviceImages.length >= 6}
                    >
                      {serviceImages.length > 0 ? `Adicionar mais (${serviceImages.length}/6)` : "Adicionar fotografias"}
                    </button>
                    {serviceImages.length > 0 && (
                      <div className="image-previews">
                        {serviceImages.map((preview, i) => (
                          <div key={i} className="image-preview">
                            <img src={preview} alt={`Pré-visualização ${i + 1}`} />
                            <button type="button" onClick={() => removeServiceImage(i)} aria-label="Remover">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <label>Título do serviço<input type="text" name="title" required /></label>
                  <label>Descrição<input type="text" name="description" placeholder="Descreve o serviço" /></label>
                  <label>
                    Categoria
                    <select name="categoria" defaultValue="" required>
                      <option value="" disabled>Escolhe a categoria</option>
                      {categories.map((categoria) => (
                        <option key={categoria._id} value={categoria._id}>
                          {categoria.icone} {categoria.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Preço (€)
                    <input type="number" name="preco" min="0" step="0.01" placeholder="Ex: 29.90" required />
                  </label>
                  <label>
                    Localização
                    <select name="location" defaultValue="" required>
                      <option value="" disabled>Escolhe a tua cidade</option>
                      {PORTUGAL_CITIES.map((group) => (
                        <optgroup key={group.district} label={group.district}>
                          {group.cities.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
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
                <h3>O meu perfil</h3>
                <form onSubmit={handleProfileUpdate}>
                  <label>
                    Nome
                    <input
                      type="text"
                      name="name"
                      value={profileForm.name}
                      onChange={(event) => setProfileField("name", event.target.value)}
                      required
                    />
                  </label>
                  <label>Email<input type="email" name="email" value={user.email || ""} readOnly /></label>
                  <label>
                    Telefone
                    <input
                      type="tel"
                      name="telefone"
                      value={profileForm.telefone}
                      onChange={(event) => setProfileField("telefone", event.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                  <label>
                    Concelho
                    <select
                      name="cidade"
                      value={profileForm.cidade}
                      onChange={(event) => setProfileField("cidade", event.target.value)}
                    >
                      <option value="">Escolhe o teu concelho</option>
                      {PORTUGAL_CITIES.map((group) => (
                        <optgroup key={group.district} label={group.district}>
                          {group.cities.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sobre mim
                    <textarea
                      name="bio"
                      rows={3}
                      value={profileForm.bio}
                      onChange={(event) => setProfileField("bio", event.target.value)}
                      placeholder="Uma pequena apresentação para os clientes"
                    />
                  </label>
                  <label>
                    Zona de atendimento
                    <select
                      name="zona"
                      value={profileForm.zona}
                      onChange={(event) => setProfileField("zona", event.target.value)}
                    >
                      <option value="">Escolhe a zona</option>
                      {PORTUGAL_CITIES.map((group) => (
                        <optgroup key={group.district} label={group.district}>
                          {group.cities.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <p className="field-hint">A descrição e a zona de atendimento aparecem na página dos teus serviços.</p>

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
  );
}