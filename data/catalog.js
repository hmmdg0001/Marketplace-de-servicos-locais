// Catálogo inicial inspirado no OSCAR (https://www.oscar-app.com/pt).
// Preços "desde", serviços e categorias adaptados ao mercado português.
// Este ficheiro é usado por scripts/seed-catalog.js.

const categories = [
  { nome: 'Limpeza', slug: 'limpeza', descricao: 'Limpezas domésticas e profissionais', icone: '🧹', ordem: 1 },
  { nome: 'Reparação', slug: 'reparacao', descricao: 'Reparações e pequenos arranjos', icone: '🔧', ordem: 2 },
  { nome: 'Montagem', slug: 'montagem', descricao: 'Montagem de móveis e equipamentos', icone: '🪛', ordem: 3 },
  { nome: 'Beleza', slug: 'beleza', descricao: 'Beleza e cuidados ao domicílio', icone: '💅', ordem: 4 },
  { nome: 'Auto', slug: 'auto', descricao: 'Serviços automóveis ao domicílio', icone: '🚗', ordem: 5 },
  { nome: 'Decoração', slug: 'decoracao', descricao: 'Decoração e interiores', icone: '🖼️', ordem: 6 },
  { nome: 'Jardinagem', slug: 'jardinagem', descricao: 'Jardins e espaços exteriores', icone: '🌿', ordem: 7 },
  { nome: 'Instalação', slug: 'instalacao', descricao: 'Instalações técnicas', icone: '🔌', ordem: 8 },
  { nome: 'Lavandaria', slug: 'lavandaria', descricao: 'Lavandaria e tratamento de roupa', icone: '👕', ordem: 9 },
  { nome: 'Manutenção', slug: 'manutencao', descricao: 'Manutenção preventiva', icone: '🛠️', ordem: 10 },
  { nome: 'Mudanças', slug: 'mudancas', descricao: 'Mudanças e transporte', icone: '📦', ordem: 11 },
  { nome: 'Pragas', slug: 'pragas', descricao: 'Controlo de pragas', icone: '🐜', ordem: 12 },
  { nome: 'Impermeabilização', slug: 'impermeabilizacao', descricao: 'Impermeabilização e humidades', icone: '🏠', ordem: 13 },
];

const providers = [
  {
    id: 'demo-rui-martins',
    nome: 'Rui Martins',
    zona: 'Fafe',
    bio: 'Canalizações, reparações e instalações. Doze anos de experiência em casas e apartamentos.',
  },
  {
    id: 'demo-ana-silva',
    nome: 'Ana Silva',
    zona: 'Lisboa',
    bio: 'Limpezas domésticas e profissionais, com produtos amigos do ambiente.',
  },
  {
    id: 'demo-carlos-pereira',
    nome: 'Carlos Pereira',
    zona: 'Porto',
    bio: 'Eletricidade, manutenção e pequenas reparações em casa.',
  },
  {
    id: 'demo-mariana-costa',
    nome: 'Mariana Costa',
    zona: 'Braga',
    bio: 'Beleza e cuidados ao domicílio, com horários flexíveis.',
  },
  {
    id: 'demo-joao-santos',
    nome: 'João Santos',
    zona: 'Coimbra',
    bio: 'Montagem de móveis, pintura e mudanças com cuidado no detalhe.',
  },
  {
    id: 'demo-sofia-almeida',
    nome: 'Sofia Almeida',
    zona: 'Faro',
    bio: 'Jardinagem, piscinas e manutenção de espaços exteriores.',
  },
  {
    id: 'demo-miguel-ferreira',
    nome: 'Miguel Ferreira',
    zona: 'Aveiro',
    bio: 'Serviços automóveis ao domicílio e lavagens detalhadas.',
  },
  {
    id: 'demo-tania-rodrigues',
    nome: 'Tânia Rodrigues',
    zona: 'Setúbal',
    bio: 'Lavandaria, engomadoria e tratamento de têxteis.',
  },
  {
    id: 'demo-pedro-lopes',
    nome: 'Pedro Lopes',
    zona: 'Viseu',
    bio: 'Controlo de pragas, humidades e impermeabilizações.',
  },
];

const services = [
  // Limpeza
  { chave: 'limpeza-casa', categoria: 'limpeza', prestador: 'demo-ana-silva', titulo: 'Limpeza de casa', descricao: 'Limpeza geral de apartamentos e moradias, incluindo cozinha e casas de banho.', preco: 29.9 },
  { chave: 'limpeza-profunda', categoria: 'limpeza', prestador: 'demo-ana-silva', titulo: 'Limpeza profunda de casa', descricao: 'Limpeza detalhada de todas as divisões, ideal para mudanças de casa.', preco: 79.9 },
  { chave: 'limpeza-sofas', categoria: 'limpeza', prestador: 'demo-ana-silva', titulo: 'Limpeza de sofás', descricao: 'Higienização de sofás com extração, para remover manchas e odores.', preco: 34.9 },
  { chave: 'higienizacao-colchoes', categoria: 'limpeza', prestador: 'demo-ana-silva', titulo: 'Higienização de colchões', descricao: 'Tratamento antiácaros e desinfeção de colchões de todas as medidas.', preco: 39.9 },
  { chave: 'limpeza-tapetes', categoria: 'limpeza', prestador: 'demo-tania-rodrigues', titulo: 'Limpeza de tapetes', descricao: 'Lavagem de tapetes e alcatifas ao domicílio.', preco: 29.9 },
  { chave: 'limpeza-pos-obra', categoria: 'limpeza', prestador: 'demo-ana-silva', titulo: 'Limpeza pós-obra', descricao: 'Remoção de pó, cimento e resíduos depois de obras ou remodelações.', preco: 99 },

  // Reparação
  { chave: 'fugas-agua', categoria: 'reparacao', prestador: 'demo-rui-martins', titulo: 'Reparação de fugas de água', descricao: 'Deteção e reparação de fugas em torneiras, canos e autoclismos.', preco: 46.9 },
  { chave: 'desentupimento', categoria: 'reparacao', prestador: 'demo-rui-martins', titulo: 'Desentupimento de canos', descricao: 'Desentupimento de lava-loiças, sanitas e ralos com equipamento profissional.', preco: 49.9 },
  { chave: 'esquentadores', categoria: 'reparacao', prestador: 'demo-carlos-pereira', titulo: 'Reparação de esquentadores', descricao: 'Diagnóstico e reparação de esquentadores a gás e elétricos.', preco: 54.9 },
  { chave: 'maquinas-lavar', categoria: 'reparacao', prestador: 'demo-carlos-pereira', titulo: 'Reparação de máquinas de lavar roupa', descricao: 'Reparação de avarias em máquinas de lavar e secar roupa.', preco: 49.9 },
  { chave: 'estores', categoria: 'reparacao', prestador: 'demo-rui-martins', titulo: 'Reparação de estores', descricao: 'Substituição de lâminas, correias e mecanismos de estores.', preco: 39.9 },
  { chave: 'quadro-eletrico', categoria: 'reparacao', prestador: 'demo-carlos-pereira', titulo: 'Reparação de quadro elétrico', descricao: 'Reparação e substituição de disjuntores e diferenciais.', preco: 63.5 },

  // Montagem
  { chave: 'roupeiro', categoria: 'montagem', prestador: 'demo-joao-santos', titulo: 'Montagem de roupeiro', descricao: 'Montagem de roupeiros e armários de qualquer dimensão.', preco: 45 },
  { chave: 'cama', categoria: 'montagem', prestador: 'demo-joao-santos', titulo: 'Montagem de cama', descricao: 'Montagem de camas, beliches e estruturas de descanso.', preco: 35 },
  { chave: 'secretaria', categoria: 'montagem', prestador: 'demo-joao-santos', titulo: 'Montagem de secretária', descricao: 'Montagem de secretárias, estantes e móveis de escritório.', preco: 25 },
  { chave: 'cozinha-modular', categoria: 'montagem', prestador: 'demo-joao-santos', titulo: 'Montagem de cozinha modular', descricao: 'Montagem de armários e módulos de cozinha.', preco: 89 },
  { chave: 'parque-infantil', categoria: 'montagem', prestador: 'demo-rui-martins', titulo: 'Montagem de parque infantil', descricao: 'Montagem segura de parques, baloiços e escorregas.', preco: 59 },

  // Beleza
  { chave: 'manicure', categoria: 'beleza', prestador: 'demo-mariana-costa', titulo: 'Manicure ao domicílio', descricao: 'Tratamento de unhas com verniz normal ou gel.', preco: 15 },
  { chave: 'pedicure', categoria: 'beleza', prestador: 'demo-mariana-costa', titulo: 'Pedicure ao domicílio', descricao: 'Cuidado completo dos pés, com lixagem e hidratação.', preco: 18 },
  { chave: 'corte-cabelo', categoria: 'beleza', prestador: 'demo-mariana-costa', titulo: 'Corte de cabelo ao domicílio', descricao: 'Corte e acabamento para homem, mulher ou criança.', preco: 12 },
  { chave: 'maquilhagem', categoria: 'beleza', prestador: 'demo-mariana-costa', titulo: 'Maquilhagem para eventos', descricao: 'Maquilhagem profissional para casamentos, festas e sessões.', preco: 35 },
  { chave: 'massagem', categoria: 'beleza', prestador: 'demo-mariana-costa', titulo: 'Massagem relaxante', descricao: 'Massagem de 60 minutos ao domicílio.', preco: 30 },

  // Auto
  { chave: 'lavagem-carro', categoria: 'auto', prestador: 'demo-miguel-ferreira', titulo: 'Lavagem de carro ao domicílio', descricao: 'Lavagem exterior com produtos adequados à pintura.', preco: 19.9 },
  { chave: 'lavagem-completa', categoria: 'auto', prestador: 'demo-miguel-ferreira', titulo: 'Lavagem completa de carro', descricao: 'Lavagem exterior e interior, incluindo aspiração.', preco: 34.9 },
  { chave: 'interior-carro', categoria: 'auto', prestador: 'demo-miguel-ferreira', titulo: 'Limpeza interior de carro', descricao: 'Aspiração, limpeza de estofos e plásticos.', preco: 24.9 },
  { chave: 'farois', categoria: 'auto', prestador: 'demo-miguel-ferreira', titulo: 'Polimento de faróis', descricao: 'Recuperação da transparência dos faróis.', preco: 29.9 },
  { chave: 'escovas', categoria: 'auto', prestador: 'demo-miguel-ferreira', titulo: 'Substituição de escovas limpa-para-brisas', descricao: 'Troca de escovas com peças incluídas.', preco: 15 },

  // Decoração
  { chave: 'pintura-interior', categoria: 'decoracao', prestador: 'demo-joao-santos', titulo: 'Pintura interior', descricao: 'Pintura de paredes e tetos com preparação de superfícies.', preco: 120 },
  { chave: 'pintura-exterior', categoria: 'decoracao', prestador: 'demo-pedro-lopes', titulo: 'Pintura exterior', descricao: 'Pintura de fachadas com tintas resistentes ao tempo.', preco: 180 },
  { chave: 'papel-parede', categoria: 'decoracao', prestador: 'demo-joao-santos', titulo: 'Colocação de papel de parede', descricao: 'Aplicação de papel de parede em paredes preparadas.', preco: 80 },
  { chave: 'prateleiras', categoria: 'decoracao', prestador: 'demo-joao-santos', titulo: 'Montagem de prateleiras', descricao: 'Fixação de prateleiras e suportes em parede.', preco: 30 },
  { chave: 'vinil', categoria: 'decoracao', prestador: 'demo-joao-santos', titulo: 'Aplicação de vinil', descricao: 'Aplicação de vinil decorativo em paredes e vidros.', preco: 45 },

  // Jardinagem
  { chave: 'corte-relva', categoria: 'jardinagem', prestador: 'demo-sofia-almeida', titulo: 'Corte de relva', descricao: 'Corte e recolha de relva em jardins de qualquer dimensão.', preco: 25 },
  { chave: 'manutencao-jardim', categoria: 'jardinagem', prestador: 'demo-sofia-almeida', titulo: 'Manutenção de jardim', descricao: 'Limpeza, poda ligeira e tratamento de canteiros.', preco: 40 },
  { chave: 'poda-arvores', categoria: 'jardinagem', prestador: 'demo-sofia-almeida', titulo: 'Poda de árvores', descricao: 'Poda controlada com remoção de resíduos.', preco: 60 },
  { chave: 'sebes', categoria: 'jardinagem', prestador: 'demo-sofia-almeida', titulo: 'Plantação de sebes', descricao: 'Plantação e preparação de sebes para privacidade.', preco: 55 },
  { chave: 'sistema-rega', categoria: 'jardinagem', prestador: 'demo-sofia-almeida', titulo: 'Sistema de rega', descricao: 'Instalação de rega automática por aspersão ou gota a gota.', preco: 90 },

  // Instalação
  { chave: 'ar-condicionado', categoria: 'instalacao', prestador: 'demo-carlos-pereira', titulo: 'Instalação de ar condicionado', descricao: 'Instalação de unidades split com suportes incluídos.', preco: 199 },
  { chave: 'torneiras', categoria: 'instalacao', prestador: 'demo-rui-martins', titulo: 'Instalação de torneiras', descricao: 'Substituição e instalação de torneiras e misturadoras.', preco: 35 },
  { chave: 'maquina-lavar-instalacao', categoria: 'instalacao', prestador: 'demo-rui-martins', titulo: 'Instalação de máquina de lavar', descricao: 'Ligação de água e esgoto de máquinas de lavar.', preco: 40 },
  { chave: 'tv-parede', categoria: 'instalacao', prestador: 'demo-carlos-pereira', titulo: 'Instalação de televisão na parede', descricao: 'Fixação de suporte e passagem de cabos.', preco: 45 },
  { chave: 'videoporteiro', categoria: 'instalacao', prestador: 'demo-carlos-pereira', titulo: 'Instalação de videoporteiro', descricao: 'Instalação e configuração de videoporteiros.', preco: 75 },

  // Lavandaria
  { chave: 'lavar-passar', categoria: 'lavandaria', prestador: 'demo-tania-rodrigues', titulo: 'Lavar e passar roupa', descricao: 'Recolha, lavagem, secagem e entrega da roupa.', preco: 15 },
  { chave: 'cortinados', categoria: 'lavandaria', prestador: 'demo-tania-rodrigues', titulo: 'Limpeza de cortinados', descricao: 'Desmontagem, lavagem e recolocação de cortinados.', preco: 25 },
  { chave: 'casacos', categoria: 'lavandaria', prestador: 'demo-tania-rodrigues', titulo: 'Tratamento de casacos', descricao: 'Limpeza a seco de casacos e peças delicadas.', preco: 15 },
  { chave: 'engomadoria', categoria: 'lavandaria', prestador: 'demo-tania-rodrigues', titulo: 'Engomadoria ao domicílio', descricao: 'Engomadoria de roupa por peça ou ao lote.', preco: 18 },
  { chave: 'edredoens', categoria: 'lavandaria', prestador: 'demo-ana-silva', titulo: 'Lavagem de edredões', descricao: 'Lavagem e secagem de edredões e cobertores.', preco: 22 },

  // Manutenção
  { chave: 'manutencao-ac', categoria: 'manutencao', prestador: 'demo-carlos-pereira', titulo: 'Manutenção de ar condicionado', descricao: 'Limpeza de filtros e verificação de gás.', preco: 49.9 },
  { chave: 'caldeira', categoria: 'manutencao', prestador: 'demo-carlos-pereira', titulo: 'Manutenção de caldeira', descricao: 'Revisão anual e limpeza de caldeiras.', preco: 59.9 },
  { chave: 'revisao-eletrica', categoria: 'manutencao', prestador: 'demo-carlos-pereira', titulo: 'Revisão de instalação elétrica', descricao: 'Verificação de quadro, tomadas e iluminação.', preco: 70 },
  { chave: 'piscina', categoria: 'manutencao', prestador: 'demo-sofia-almeida', titulo: 'Manutenção de piscina', descricao: 'Limpeza, tratamento de água e verificação de equipamento.', preco: 65 },
  { chave: 'paineis-solares', categoria: 'manutencao', prestador: 'demo-sofia-almeida', titulo: 'Limpeza de painéis solares', descricao: 'Limpeza de painéis para melhorar o rendimento.', preco: 55 },

  // Mudanças
  { chave: 'mudanca-casa', categoria: 'mudancas', prestador: 'demo-joao-santos', titulo: 'Mudança de casa', descricao: 'Embalagem, transporte e montagem de móveis.', preco: 150 },
  { chave: 'mudanca-escritorio', categoria: 'mudancas', prestador: 'demo-joao-santos', titulo: 'Mudança de escritório', descricao: 'Transporte de mobiliário e equipamento de escritório.', preco: 250 },
  { chave: 'transporte-moveis', categoria: 'mudancas', prestador: 'demo-miguel-ferreira', titulo: 'Transporte de móveis', descricao: 'Transporte de peças individuais com carrinha.', preco: 45 },
  { chave: 'desmontagem', categoria: 'mudancas', prestador: 'demo-joao-santos', titulo: 'Desmontagem e montagem de móveis', descricao: 'Desmontagem e montagem no destino.', preco: 60 },
  { chave: 'carrinha-motorista', categoria: 'mudancas', prestador: 'demo-miguel-ferreira', titulo: 'Aluguer de carrinha com motorista', descricao: 'Carrinha com motorista à hora.', preco: 70 },

  // Pragas
  { chave: 'baratas', categoria: 'pragas', prestador: 'demo-pedro-lopes', titulo: 'Desinfestação de baratas', descricao: 'Tratamento com gel e inseticida em cozinhas e casas de banho.', preco: 60 },
  { chave: 'formigas', categoria: 'pragas', prestador: 'demo-pedro-lopes', titulo: 'Controlo de formigas', descricao: 'Aplicação de iscos e barreiras em zonas afetadas.', preco: 45 },
  { chave: 'pulgas', categoria: 'pragas', prestador: 'demo-pedro-lopes', titulo: 'Tratamento de pulgas', descricao: 'Tratamento de ambientes com animais de estimação.', preco: 55 },
  { chave: 'vespas', categoria: 'pragas', prestador: 'demo-pedro-lopes', titulo: 'Remoção de ninhos de vespas', descricao: 'Remoção segura de ninhos em telhados e varandas.', preco: 65 },
  { chave: 'desratizacao', categoria: 'pragas', prestador: 'demo-pedro-lopes', titulo: 'Desratização', descricao: 'Controlo de roedores com iscos em pontos estratégicos.', preco: 70 },

  // Impermeabilização
  { chave: 'terraco', categoria: 'impermeabilizacao', prestador: 'demo-pedro-lopes', titulo: 'Impermeabilização de terraço', descricao: 'Aplicação de membrana líquida em terraços e varandas.', preco: 180 },
  { chave: 'humidade', categoria: 'impermeabilizacao', prestador: 'demo-pedro-lopes', titulo: 'Tratamento de humidade', descricao: 'Diagnóstico e tratamento de humidades ascendentes.', preco: 120 },
  { chave: 'bolor', categoria: 'impermeabilizacao', prestador: 'demo-pedro-lopes', titulo: 'Remoção de bolor', descricao: 'Limpeza e tratamento anti-bolor em paredes e tetos.', preco: 80 },
  { chave: 'casa-banho', categoria: 'impermeabilizacao', prestador: 'demo-pedro-lopes', titulo: 'Impermeabilização de casa de banho', descricao: 'Impermeabilização de bases de duche e paredes.', preco: 140 },
  { chave: 'telhado', categoria: 'impermeabilizacao', prestador: 'demo-carlos-pereira', titulo: 'Reparação de telhado', descricao: 'Substituição de telhas e vedação de infiltrações.', preco: 200 },

  // Serviços da conta de demonstração do administrador
  { chave: 'admin-reparacoes', categoria: 'reparacao', prestador: 'admin', titulo: 'Pequenas reparações em casa', descricao: 'Arranjos rápidos: prateleiras, dobradiças, tomadas e fechaduras.', preco: 30 },
  { chave: 'admin-montagem', categoria: 'montagem', prestador: 'admin', titulo: 'Montagem de móveis', descricao: 'Montagem de móveis simples com ferramentas incluídas.', preco: 40 },
];

module.exports = { categories, providers, services };
