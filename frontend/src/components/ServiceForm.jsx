import { useEffect, useRef, useState } from "react";
import { Clock3, ImagePlus, X } from "lucide-react";
import { apiBase, readJson, apiErrorMessage } from "../lib/api.js";
import { PORTUGAL_CITIES } from "../data/cities.js";
import { Button } from "./ui/button.jsx";
import { Card, CardContent } from "./ui/card.jsx";
import { Input } from "./ui/input.jsx";

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

  const campoClasse = "mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:ring-2 focus:ring-primary";
  const rotulo = "block text-xs font-semibold text-brand-muted";

  return (
    <Card className="p-6 md:p-8">
      <h2 className="font-display text-2xl font-extrabold text-brand-navy">
        {servico ? "Editar serviço" : "Criar novo serviço"}
      </h2>

      <form onSubmit={guardar} className="mt-6 space-y-5">
        <div>
          <span className={rotulo}>Fotografias (máx. {MAX_IMAGENS})</span>
          <input
            type="file"
            ref={inputRef}
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={escolherFicheiros}
            style={{ display: "none" }}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy || totalImagens >= MAX_IMAGENS} className="mt-2">
            <ImagePlus className="h-4 w-4" />
            {totalImagens > 0 ? `Adicionar mais (${totalImagens}/${MAX_IMAGENS})` : "Adicionar fotografias"}
          </Button>
          {totalImagens > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {imagens.map((url, i) => (
                <div key={`guardada-${url}`} className="relative h-20 w-24 overflow-hidden rounded-xl border border-brand-line">
                  <img src={url} alt={`Fotografia ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removerImagem(i)} aria-label="Remover fotografia" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-navy shadow">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {novas.map((nova, i) => (
                <div key={nova.preview} className="relative h-20 w-24 overflow-hidden rounded-xl border border-brand-line">
                  <img src={nova.preview} alt={`Nova fotografia ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removerNova(i)} aria-label="Remover fotografia" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-navy shadow">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={rotulo}>
            Título do serviço
            <Input type="text" value={valores.titulo} onChange={(event) => campo("titulo", event.target.value)} className={campoClasse} required />
          </label>
          <label className={rotulo}>
            Descrição
            <Input type="text" value={valores.descricao} onChange={(event) => campo("descricao", event.target.value)} placeholder="Descreve o serviço" className={campoClasse} />
          </label>
          <label className={rotulo}>
            Categoria
            <select value={valores.categoriaId} onChange={(event) => campo("categoriaId", event.target.value)} className={campoClasse} required>
              <option value="" disabled>Escolhe a categoria</option>
              {categories.map((categoria) => (
                <option key={categoria._id} value={categoria._id}>{categoria.icone} {categoria.nome}</option>
              ))}
            </select>
          </label>
          <label className={rotulo}>
            Preço (€)
            <Input type="number" min="0" step="0.01" value={valores.preco} onChange={(event) => campo("preco", event.target.value)} placeholder="Ex: 29.90" className={campoClasse} required />
          </label>
          <label className={`${rotulo} sm:col-span-2`}>
            Localização
            <select value={valores.zona} onChange={(event) => campo("zona", event.target.value)} className={campoClasse} required>
              <option value="" disabled>Escolhe a tua cidade</option>
              {PORTUGAL_CITIES.map((group) => (
                <optgroup key={group.district} label={group.district}>
                  {group.cities.map((city) => <option key={city} value={city}>{city}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="rounded-2xl border border-brand-line bg-brand-mist p-5">
          <legend className="flex items-center gap-2 px-2 font-display text-sm font-bold text-brand-navy">
            <Clock3 className="h-4 w-4 text-brand-purpleDark" /> Regras de tempo (duração)
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={rotulo}>
              Tipo de cálculo
              <select value={regras.tipo} onChange={(event) => alterarRegra("tipo", event.target.value)} className={campoClasse}>
                <option value="fixo">Fixo</option>
                <option value="por_m2">Por área (m²)</option>
                <option value="opcoes">Por opções</option>
              </select>
            </label>
            <label className={rotulo}>
              Tempo base (minutos)
              <Input type="number" min="0" value={regras.tempo_base} onChange={(event) => alterarRegra("tempo_base", event.target.value)} className={campoClasse} required />
            </label>
            {regras.tipo === "por_m2" && (
              <label className={rotulo}>
                Minutos por m²
                <Input type="number" min="0" step="0.1" value={regras.fator} onChange={(event) => alterarRegra("fator", event.target.value)} placeholder="Ex: 0.5" className={campoClasse} required />
              </label>
            )}
            {regras.tipo === "opcoes" && (
              <label className={`${rotulo} sm:col-span-2`}>
                Opções (uma por linha: Nome=minutos extra)
                <textarea rows={3} value={regras.opcoesTexto} onChange={(event) => alterarRegra("opcoesTexto", event.target.value)} placeholder={"Ligeiro=0\nSUV=20"} className={`${campoClasse} h-auto py-3`} required />
              </label>
            )}
          </div>
        </fieldset>

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="status">{erro}</p>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "A guardar…" : servico ? "Guardar alterações" : "Guardar serviço"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
