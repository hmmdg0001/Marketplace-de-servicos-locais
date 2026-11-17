export const apiBase = "/api";

// O backend (ou o proxy) pode devolver corpo vazio em caso de erro.
export async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function apiErrorMessage(res, data, fallback) {
  if (data?.error) return data.error;
  if (res.status === 404) return "A API não respondeu. Confirma que o backend está a correr na porta 3000.";
  return fallback;
}

export function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "Preço a combinar";
  return `${number.toFixed(2).replace(".", ",")} €`;
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Em execução" -> "em-execucao" (classe CSS do estado).
export function estadoClasse(estado) {
  const semAcentos = String(estado || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return `estado-${semAcentos.toLowerCase().replace(/\s+/g, "-")}`;
}
