import assert from "node:assert/strict";
import test from "node:test";
import {
  DENIAL_REASON_GROUPS,
  buildSapAdditionalFields,
  formatDenialReason,
} from "../app/intelligent-script.js";

const reasons = DENIAL_REASON_GROUPS.flatMap((group) => group.reasons);

test("includes all supplied transfer-of-ownership denial reasons", () => {
  const labels = reasons.map((reason) => reason.label);
  assert.ok(labels.includes("O documento de vínculo/posse com o imóvel não é válido"));
  assert.ok(labels.includes("O contrato de locação não está vigente; vínculo encerrado em 00/00/00"));
  assert.ok(labels.includes("A numeração informada como conta contrato não foi localizada no sistema"));
  assert.ok(labels.includes("Serviço solicitado por terceiro sem contrato de administração ou procuração"));
  assert.ok(labels.includes("Faltou documento oficial com foto (CNH, RG, Passaporte ou Carteira Profissional)"));
  assert.ok(labels.includes("O arquivo enviado está corrompido"));
  assert.ok(labels.includes("RG com mais de 10 anos: orientar atualização conforme decreto"));
  assert.ok(labels.includes("Há débitos vencidos vinculados ao CPF/CNPJ do solicitante"));
});

test("formats selected debt reason with the provided account contract", () => {
  assert.match(formatDenialReason("debt-overdue", "3001234567"), /conta contrato 3001234567/i);
  assert.doesNotMatch(formatDenialReason("debt-overdue", "3001234567"), /3xxxxxxxxxx/i);
});

test("marks additional reasons as suggestions requiring manager validation", () => {
  const suggestions = reasons.filter((reason) => reason.managerReview);
  assert.ok(suggestions.length >= 3);
  assert.ok(suggestions.every((reason) => reason.groupLabel.includes("validar com o gestor")));
});

test("adds Local de Consumo and Parceiro de Negócio to SAP text", () => {
  const fields = buildSapAdditionalFields("Residência", "Parceiro 123");
  assert.match(fields, /LOCAL DE CONSUMO: Residência/);
  assert.match(fields, /PARCEIRO DE NEGÓCIO: Parceiro 123/);
});

test("uses clear placeholders when SAP fields are blank", () => {
  const fields = buildSapAdditionalFields("", "");
  assert.match(fields, /LOCAL DE CONSUMO: INFORME O LOCAL DE CONSUMO/);
  assert.match(fields, /PARCEIRO DE NEGÓCIO: INFORME O PARCEIRO DE NEGÓCIO/);
});
