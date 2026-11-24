// Configuração da agenda mínima do MVP. Depois pode passar a ser por prestador.

const HORA_ABERTURA = 9;
const HORA_FECHO = 18;
const PASSO_SLOT = 30; // minutos entre inícios possíveis
const BLOCO = 15; // minutos por documento de bloqueio

const ESTADOS_BLOQUEIO = ['Submetido', 'Aceite', 'Em execução', 'Aguarda confirmação'];

function diaUtil(data) {
  const dia = new Date(data).getDay();
  return dia >= 1 && dia <= 5;
}

function minutosDesdeMeiaNoite(data) {
  return data.getHours() * 60 + data.getMinutes();
}

function dentroDaJanela(inicio, duracaoMinutos) {
  if (!diaUtil(inicio)) return false;
  const inicioMin = minutosDesdeMeiaNoite(inicio);
  const fimMin = inicioMin + duracaoMinutos;
  return inicioMin >= HORA_ABERTURA * 60 && fimMin <= HORA_FECHO * 60;
}

function blocosDe15(inicio, fim) {
  const blocos = [];
  const atual = new Date(inicio);
  while (atual < fim) {
    const proximo = new Date(atual.getTime() + BLOCO * 60 * 1000);
    blocos.push({ inicio: new Date(atual), fim: proximo });
    atual.setTime(proximo.getTime());
  }
  return blocos;
}

// Gera os inícios possíveis para uma data (YYYY-MM-DD), já excluindo o passado.
function iniciosPossiveis(dataStr, duracaoMinutos, agora = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataStr || ''))) return [];
  const [ano, mes, dia] = String(dataStr).split('-').map(Number);
  if (!diaUtil(new Date(ano, mes - 1, dia))) return [];
  const inicios = [];
  const ultimo = HORA_FECHO * 60 - duracaoMinutos;

  for (let min = HORA_ABERTURA * 60; min <= ultimo; min += PASSO_SLOT) {
    const inicio = new Date(ano, mes - 1, dia, Math.floor(min / 60), min % 60, 0, 0);
    if (inicio > agora) inicios.push(inicio);
  }
  return inicios;
}

module.exports = {
  HORA_ABERTURA,
  HORA_FECHO,
  PASSO_SLOT,
  BLOCO,
  ESTADOS_BLOQUEIO,
  diaUtil,
  dentroDaJanela,
  blocosDe15,
  iniciosPossiveis,
};
