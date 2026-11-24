import { useEffect, useRef, useState } from "react";
import { apiBase, readJson, apiErrorMessage } from "../lib/api.js";
import { PORTUGAL_CITIES } from "../data/cities.js";

const MAX_IMAGENS = 6;
const urlUpload = (cloudName) => `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

// Formulário único para criar e editar serviços.
// Recebe `servico` quando é edição e `null` quando é criação.
export default function ServiceForm({ user, categories, servico, onSaved, onCancel }) {
  const [valores, setValores] = useState({
    titulo: servico?.titulo || "",
    descricao: servico?.descricao || "",
    categoriaId: servico?.categoria?._id || servico?.categoriaId || "",
    preco: servico?.preco ?? "",
    zona: servico?.zona || "",
  });
  const [regras, setRegras] = useState({
    tipo: servico?.regras_tempo?.tipo || "fixo",
    tempo_base: servico?.regras_tempo?.tempo_base ?? 60,
    fator: servico?.regras_tempo?.fator ?? "",
    opcoesTexto: Object.entries(servico?.regras_tempo?.opcoes || {})
      .map(([nome, valor]) => `${nome}=${valor}`)
      .join("\n"),
  });
  const [imagens, setImagens] = useState(() => (Array.isArray(servico?.imagens) ? servico.imagens : []));
  const [novas, setNovas] = useState([]);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${apiBase}/upload/assinatura`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pasta: "servicos" }),
        });
        const data = await readJson(res);
        if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao preparar o upload de imagens"));
        if (!cancelado) setConfig(data);
      } catch (err) {
        if (!cancelado) setErro(err.message || "Erro ao preparar o upload de imagens.");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user]);

  const totalImagens = imagens.length + novas.length;

  function campo(nome, valor) {
    setValores((prev) => ({ ...prev, [nome]: valor }));
  }

  const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
  const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

  function escolherFicheiros(event) {
    const escolhidos = Array.from(event.target.files || []);
    const problemas = [];
    const aceites = [];

    for (const file of escolhidos) {
      if (!TIPOS_PERMITIDOS.includes(file.type)) {
        problemas.push(`${file.name}: usa JPG, PNG ou WEBP.`);
      } else if (file.size > TAMANHO_MAXIMO) {
        problemas.push(`${file.name}: o limite é 10 MB.`);
      } else if (aceites.length + totalImagens < MAX_IMAGENS) {
        aceites.push(file);
      }
    }

    if (problemas.length) setErro(problemas.join(" "));
    if (aceites.length) {
      setNovas((prev) => [
        ...prev,
        ...aceites.map((file) => ({ file, preview: URL.createObjectURL(file) })),
      ]);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function removerNova(indice) {
    setNovas((prev) => prev.filter((_, i) => i !== indice));
  }

  function removerImagem(indice) {
    setImagens((prev) => prev.filter((_, i) => i !== indice));
  }

  async function enviarNovasImagens() {
    if (novas.length === 0) return [];
    if (!config) throw new Error("O upload de imagens ainda não está pronto. Tenta outra vez.");

    const enviadas = [];
    for (const { file } of novas) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", config.apiKey);
      formData.append("timestamp", config.timestamp.toString());
      formData.append("signature", config.signature);
      formData.append("folder", config.folder);
      formData.append("allowed_formats", config.allowedFormats || config.allowed_formats);
      formData.append("resource_type", "image");

      const res = await fetch(urlUpload(config.cloudName), { method: "POST", body: formData });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error?.message || "Erro no upload da imagem.");
      enviadas.push(data.secure_url);
    }
    return enviadas;
  }

  function alterarRegra(campo, valor) {
    setRegras((prev) => ({ ...prev, [campo]: valor }));
  }

  function opcoesParaObjeto(texto) {
    const resultado = {};
    for (const linha of String(texto).split("\n")) {
      const linhaLimpa = linha.trim();
      if (!linhaLimpa) continue;
      const separador = linhaLimpa.lastIndexOf("=");
      if (separador < 1) throw new Error("Cada opção deve ter o formato Nome=minutos extra");
      const nome = linhaLimpa.slice(0, separador).trim();
      const minutos = Number(linhaLimpa.slice(separador + 1));
      if (!nome || !Number.isFinite(minutos) || minutos < 0) {
        throw new Error(`Opção inválida: ${linhaLimpa}`);
      }
      resultado[nome] = minutos;
    }
    if (Object.keys(resultado).length === 0) throw new Error("Introduz pelo menos uma opção");
    return resultado;
  }

  async function guardar(event) {
    event.preventDefault();
    setErro("");
    setBusy(true);
    try {
      if (imagens.length + novas.length === 0) {
        throw new Error("Adiciona pelo menos uma fotografia antes de publicar.");
      }
      const enviadas = await enviarNovasImagens();
      const token = await user.getIdToken();
      const regrasTempo = {
        tipo: regras.tipo,
        tempo_base: Number(regras.tempo_base || 0),
      };
      if (regras.tipo === "por_m2") regrasTempo.fator = Number(regras.fator || 0);
      if (regras.tipo === "opcoes") regrasTempo.opcoes = opcoesParaObjeto(regras.opcoesTexto);

      const corpo = {
        titulo: valores.titulo,
        descricao: valores.descricao,
        categoriaId: valores.categoriaId,
        preco: Number(valores.preco || 0),
        zona: valores.zona,
        imagens: [...imagens, ...enviadas].slice(0, MAX_IMAGENS),
        regras_tempo: regrasTempo,
      };

      const res = await fetch(
        servico ? `${apiBase}/services/${servico._id}` : `${apiBase}/services`,
        {
          method: servico ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(corpo),
        }
      );
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao guardar o serviço"));

      onSaved(data);
    } catch (err) {
      setErro(err.message || "Erro ao guardar o serviço.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-section">
      <h3>{servico ? "Editar serviço" : "Criar novo serviço"}</h3>
      <form onSubmit={guardar}>
        <div className="form-group">
          <span className="form-label">Fotografias (máx. {MAX_IMAGENS})</span>
          <input
            type="file"
            ref={inputRef}
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={escolherFicheiros}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="submit-button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || totalImagens >= MAX_IMAGENS}
          >
            {totalImagens > 0 ? `Adicionar mais (${totalImagens}/${MAX_IMAGENS})` : "Adicionar fotografias"}
          </button>
          {totalImagens > 0 && (
            <div className="image-previews">
              {imagens.map((url, i) => (
                <div key={`guardada-${url}`} className="image-preview">
                  <img src={url} alt={`Fotografia ${i + 1}`} />
                  <button type="button" onClick={() => removerImagem(i)} aria-label="Remover fotografia">×</button>
                </div>
              ))}
              {novas.map((nova, i) => (
                <div key={nova.preview} className="image-preview">
                  <img src={nova.preview} alt={`Nova fotografia ${i + 1}`} />
                  <button type="button" onClick={() => removerNova(i)} aria-label="Remover fotografia">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label>
          Título do serviço
          <input
            type="text"
            value={valores.titulo}
            onChange={(event) => campo("titulo", event.target.value)}
            required
          />
        </label>
        <label>
          Descrição
          <input
            type="text"
            value={valores.descricao}
            onChange={(event) => campo("descricao", event.target.value)}
            placeholder="Descreve o serviço"
          />
        </label>
        <label>
          Categoria
          <select
            value={valores.categoriaId}
            onChange={(event) => campo("categoriaId", event.target.value)}
            required
          >
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
          <input
            type="number"
            min="0"
            step="0.01"
            value={valores.preco}
            onChange={(event) => campo("preco", event.target.value)}
            placeholder="Ex: 29.90"
            required
          />
        </label>
        <label>
          Localização
          <select value={valores.zona} onChange={(event) => campo("zona", event.target.value)} required>
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

        <fieldset className="regras-tempo-form">
          <legend>Regras de tempo (duração)</legend>
          <label>
            Tipo de cálculo
            <select value={regras.tipo} onChange={(event) => alterarRegra("tipo", event.target.value)}>
              <option value="fixo">Fixo</option>
              <option value="por_m2">Por área (m²)</option>
              <option value="opcoes">Por opções</option>
            </select>
          </label>
          <label>
            Tempo base (minutos)
            <input
              type="number"
              min="0"
              value={regras.tempo_base}
              onChange={(event) => alterarRegra("tempo_base", event.target.value)}
              required
            />
          </label>
          {regras.tipo === "por_m2" && (
            <label>
              Minutos por m²
              <input
                type="number"
                min="0"
                step="0.1"
                value={regras.fator}
                onChange={(event) => alterarRegra("fator", event.target.value)}
                placeholder="Ex: 0.5"
                required
              />
            </label>
          )}
          {regras.tipo === "opcoes" && (
            <label>
              Opções (uma por linha: Nome=minutos extra)
              <textarea
                rows={3}
                value={regras.opcoesTexto}
                onChange={(event) => alterarRegra("opcoesTexto", event.target.value)}
                placeholder={"Ligeiro=0\nSUV=20"}
                required
              />
            </label>
          )}
        </fieldset>

        {erro && <p className="form-message error" role="status">{erro}</p>}

        <button className="submit-button" type="submit" disabled={busy}>
          {busy ? "A guardar…" : servico ? "Guardar alterações" : "Guardar serviço"}
        </button>
        <button className="submit-button" type="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </form>
    </div>
  );
}
