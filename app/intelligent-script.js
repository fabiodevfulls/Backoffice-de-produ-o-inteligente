const suppliedReasonGroups = [
  {
    id: "a",
    label: "a) INFORMAÇÃO NO DOCUMENTO ANEXADO DIVERGENTE",
    reasons: [
      { id: "property-document-invalid", label: "O documento de vínculo/posse com o imóvel não é válido", detail: "O documento de vínculo/posse com o imóvel não é válido." },
      { id: "lease-expired", label: "O contrato de locação não está vigente; vínculo encerrado em 00/00/00", detail: "O contrato de locação não está vigente; a data de vínculo encerrou em 00/00/00." },
      { id: "document-unsigned", label: "O documento não está assinado/datado", detail: "O documento não está assinado ou datado." },
    ],
  },
  {
    id: "b",
    label: "b) CONTA CONTRATO NÃO LOCALIZADA/INVÁLIDA",
    reasons: [
      { id: "account-contract-invalid", label: "A numeração informada como conta contrato não foi localizada no sistema", detail: "A numeração informada como conta contrato não foi localizada em nosso sistema. Consulte a numeração exibida no canto direito da fatura de energia." },
      { id: "other-state", label: "Documentos/dados pertencem a outro estado", detail: "Identificamos que os documentos/dados apresentados pertencem a outro estado. Orientamos acessar novamente e selecionar o site da distribuidora de sua cidade." },
    ],
  },
  {
    id: "c",
    label: "c) SERVIÇO NÃO SOLICITADO PELO TITULAR",
    reasons: [
      { id: "third-party-no-authorization", label: "Serviço solicitado por terceiro sem contrato de administração ou procuração", detail: "Para solicitar serviço por terceiro, anexe contrato de administração ou procuração." },
      { id: "different-responsible", label: "O documento exibe dados de outro responsável", detail: "O documento exibe dados de outro responsável. Comprove o vínculo ou atualize o documento para o nome do solicitante." },
    ],
  },
  {
    id: "d",
    label: "d) DOCUMENTOS INCOMPLETOS",
    reasons: [
      { id: "missing-photo-id", label: "Faltou documento oficial com foto (CNH, RG, Passaporte ou Carteira Profissional)", detail: "Faltou anexar documento oficial com foto (CNH, RG, Passaporte ou Carteira Profissional)." },
      { id: "document-illegible", label: "Documento com baixa visibilidade ou ilegível", detail: "O documento anexado está com baixa visibilidade ou ilegível." },
      { id: "missing-property-pages", label: "Faltaram páginas do documento de vínculo/posse", detail: "Faltou anexar páginas do documento de vínculo/posse." },
    ],
  },
  {
    id: "e",
    label: "e) DOCUMENTAÇÃO ENVIADA EM FORMATO INCOMPATÍVEL",
    reasons: [
      { id: "corrupted-file", label: "O arquivo enviado está corrompido", detail: "O documento enviado está em formato incompatível ou o arquivo está corrompido." },
      { id: "old-id", label: "RG com mais de 10 anos: orientar atualização conforme decreto", detail: "O RG tem mais de 10 anos. Orientamos atualizar o documento, conforme o decreto aplicável." },
    ],
  },
  {
    id: "f",
    label: "f) DÉBITOS EM NOME DO SOLICITANTE",
    reasons: [
      { id: "debt-overdue", label: "Há débitos vencidos vinculados ao CPF/CNPJ do solicitante", detail: "Constam débitos em aberto vencidos vinculados ao CPF/CNPJ do solicitante na conta contrato {accountContract}." },
    ],
  },
];

const suggestedReasonGroups = [
  {
    id: "suggestions",
    label: "SUGESTÕES ADICIONAIS — validar com o gestor",
    reasons: [
      { id: "registration-divergence", label: "Dados cadastrais divergem entre a solicitação e os documentos", detail: "Os dados cadastrais informados divergem dos documentos apresentados. Confira e corrija os dados necessários.", managerReview: true },
      { id: "invalid-representation", label: "Procuração/representação ausente, vencida ou sem poderes para a solicitação", detail: "Não foi possível validar os poderes de representação. Apresente procuração ou documento de representação válido e compatível com o serviço.", managerReview: true },
      { id: "duplicate-request", label: "Já existe solicitação de troca de titularidade em andamento para a conta", detail: "Identificamos uma solicitação de troca de titularidade em andamento para esta conta. Aguarde a conclusão ou confirme a orientação com o gestor.", managerReview: true },
      { id: "service-eligibility", label: "Solicitação precisa de validação de elegibilidade do serviço/conta", detail: "Não foi possível confirmar a elegibilidade da conta para este serviço. Valide os critérios aplicáveis com o gestor antes de informar o indeferimento.", managerReview: true },
    ],
  },
];

export const DENIAL_REASON_GROUPS = [...suppliedReasonGroups, ...suggestedReasonGroups].map((group) => ({
  ...group,
  reasons: group.reasons.map((reason) => ({ ...reason, groupLabel: group.label })),
}));

export function formatDenialReason(reasonId, accountContract = "") {
  const reason = DENIAL_REASON_GROUPS.flatMap((group) => group.reasons).find((item) => item.id === reasonId);
  if (!reason) return "";
  return reason.detail.replace("{accountContract}", accountContract.trim() || "3xxxxxxxxxx");
}

export function buildSapAdditionalFields(consumptionLocation = "", businessPartner = "") {
  return [
    `LOCAL DE CONSUMO: ${consumptionLocation.trim() || "INFORME O LOCAL DE CONSUMO"}`,
    `PARCEIRO DE NEGÓCIO: ${businessPartner.trim() || "INFORME O PARCEIRO DE NEGÓCIO"}`,
  ].join("\n");
}
