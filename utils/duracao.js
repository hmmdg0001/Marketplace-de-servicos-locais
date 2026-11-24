// Cálculo centralizado da duração dos serviços. O backend é sempre a fonte da
// verdade: o frontend usa a mesma regra apenas para mostrar uma estimativa.

const MULTIPLO = 15;

function arredondarPorCima(minutos) {
  return Math.ceil(Number(minutos) / MULTIPLO) * MULTIPLO;
}

/**
 * Calcula a duração total de um serviço a partir das regras guardadas no serviço
 * e dos parâmetros escolhidos pelo cliente.
 *
 * @param {object} regras  { tipo, tempo_base, fator?, opcoes? }
 * @param {object} input   { area? } para por_m2, { opcao? } para opcoes
 * @returns {{ tipo: string, tempoBase: number, extra: number, tempoBruto: number, tempoTotal: number }}
 */
function calcularDuracao(regras, input = {}) {
  const tipo = regras?.tipo || 'fixo';
  const tempoBase = Number(regras?.tempo_base);

  if (!Number.isFinite(tempoBase) || tempoBase < 0) {
    throw new Error('Regras de tempo inválidas: tempo_base é obrigatório');
  }

  let extra = 0;

  if (tipo === 'por_m2') {
    const area = Number(input.area);
    if (!Number.isFinite(area) || area <= 0) {
      throw new Error('Indica a área em m² para calcular a duração');
    }
    const fator = Number(regras.fator);
    if (!Number.isFinite(fator) || fator < 0) {
      throw new Error('Regras de tempo inválidas: fator é obrigatório em por_m2');
    }
    extra = fator * area;
  } else if (tipo === 'opcoes') {
    const opcao = String(input.opcao ?? '');
    const opcoes = regras.opcoes || {};
    const valor = opcoes instanceof Map ? opcoes.get(opcao) : opcoes[opcao];
    if (valor === undefined || !Number.isFinite(Number(valor))) {
      throw new Error('Escolhe uma opção válida para calcular a duração');
    }
    extra = Number(valor);
  } else if (tipo !== 'fixo') {
    throw new Error('Tipo de regra de tempo desconhecido');
  }

  const tempoBruto = tempoBase + extra;
  return {
    tipo,
    tempoBase,
    extra,
    tempoBruto,
    tempoTotal: arredondarPorCima(tempoBruto),
  };
}

module.exports = { calcularDuracao, arredondarPorCima, MULTIPLO };
