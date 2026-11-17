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
