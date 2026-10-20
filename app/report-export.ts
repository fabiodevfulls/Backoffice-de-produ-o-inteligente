type Activity = { userName: string; userEmail: string; kind: "protocol" | "call"; protocol: string | null; outcome: "deferred" | "analysis" | "denied" | null; typologyName: string; quantity: number; occurredAt: string; distributionState: string | null };
type Options = { title: string; subtitle: string; activities: Activity[] };

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const filename = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dateLabel = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const outcomeLabel = (item: Activity) => item.kind !== "protocol" ? "-" : item.outcome === "deferred" ? "Deferido" : item.outcome === "analysis" ? "Em análise" : item.outcome === "denied" ? "Indeferido" : "Não informado";

function totals(activities: Activity[]) {
  const protocols = activities.filter((item) => item.kind === "protocol").reduce((sum, item) => sum + item.quantity, 0);
  const calls = activities.filter((item) => item.kind === "call").reduce((sum, item) => sum + item.quantity, 0);
  const types = new Map<string, number>();
  activities.forEach((item) => {
    const label = `${item.kind === "protocol" ? "Protocolo" : "Ligação"} — ${item.typologyName}`;
    types.set(label, (types.get(label) ?? 0) + item.quantity);
  });
  return { protocols, calls, total: protocols + calls, types: [...types].sort((a, b) => b[1] - a[1]) };
}

function exportExcelReportLegacy(options: Options) {
  const sum = totals(options.activities);
  const records = options.activities.map((item) => `<Row><Cell><Data ss:Type="String">${xml(item.userName)}</Data></Cell><Cell><Data ss:Type="String">${xml(item.userEmail)}</Data></Cell><Cell><Data ss:Type="String">${item.kind === "protocol" ? "Protocolo" : "Ligação"}</Data></Cell><Cell><Data ss:Type="String">${xml(item.distributionState || "-")}</Data></Cell><Cell><Data ss:Type="String">${xml(item.protocol || "-")}</Data></Cell><Cell><Data ss:Type="String">${xml(item.typologyName)}</Data></Cell><Cell ss:StyleID="Number"><Data ss:Type="Number">${item.quantity}</Data></Cell><Cell><Data ss:Type="String">${xml(dateLabel(item.occurredAt))}</Data></Cell></Row>`).join("");
  const types = sum.types.map(([name, count]) => `<Row><Cell><Data ss:Type="String">${xml(name)}</Data></Cell><Cell ss:StyleID="Number"><Data ss:Type="Number">${count}</Data></Cell></Row>`).join("");
  const book = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default"><Font ss:FontName="Aptos" ss:Size="11"/><Alignment ss:Vertical="Center"/></Style><Style ss:ID="Title"><Font ss:Size="20" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B1828" ss:Pattern="Solid"/></Style><Style ss:ID="Subtitle"><Font ss:Color="#DCE9FA"/><Interior ss:Color="#0B1828" ss:Pattern="Solid"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#111111"/><Interior ss:Color="#F2B705" ss:Pattern="Solid"/></Style><Style ss:ID="Metric"><Font ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#203149" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="Number"><NumberFormat ss:Format="#,##0"/><Alignment ss:Horizontal="Center"/></Style></Styles>
  <Worksheet ss:Name="Resumo"><Table><Column ss:Width="280"/><Column ss:Width="110"/><Column ss:Width="110"/><Column ss:Width="110"/><Row ss:Height="36"><Cell ss:StyleID="Title" ss:MergeAcross="3"><Data ss:Type="String">${xml(options.title)}</Data></Cell></Row><Row ss:Height="24"><Cell ss:StyleID="Subtitle" ss:MergeAcross="3"><Data ss:Type="String">${xml(options.subtitle)}</Data></Cell></Row><Row/><Row><Cell/><Cell ss:StyleID="Header"><Data ss:Type="String">Protocolos</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Ligações</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Total</Data></Cell></Row><Row ss:Height="32"><Cell/><Cell ss:StyleID="Metric"><Data ss:Type="Number">${sum.protocols}</Data></Cell><Cell ss:StyleID="Metric"><Data ss:Type="Number">${sum.calls}</Data></Cell><Cell ss:StyleID="Metric"><Data ss:Type="Number">${sum.total}</Data></Cell></Row><Row/><Row><Cell ss:StyleID="Header"><Data ss:Type="String">Tipologia</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Quantidade</Data></Cell></Row>${types}</Table></Worksheet>
  <Worksheet ss:Name="Registros"><Table><Column ss:Width="150"/><Column ss:Width="200"/><Column ss:Width="80"/><Column ss:Width="70"/><Column ss:Width="110"/><Column ss:Width="260"/><Column ss:Width="70"/><Column ss:Width="120"/><Row ss:Height="32"><Cell ss:StyleID="Title" ss:MergeAcross="7"><Data ss:Type="String">Registros detalhados</Data></Cell></Row><Row><Cell ss:StyleID="Header"><Data ss:Type="String">Atendente</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">E-mail</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Tipo</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Estado</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Protocolo</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Tipologia</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Quantidade</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Data e hora</Data></Cell></Row>${records}</Table></Worksheet></Workbook>`;
  save(new Blob([book], { type: "application/vnd.ms-excel;charset=utf-8" }), `relatorio-backoffice-producao-${filename(options.subtitle)}.xls`);
}

async function exportExcelReportHtmlLegacy(options: Options) {
  const sum = totals(options.activities);
  let banner = "";
  try {
    const response = await fetch("/report-energy-banner.png");
    const blob = await response.blob();
    banner = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(blob);
    });
  } catch { /* O relatório continua funcional mesmo sem a imagem. */ }

  const maxType = Math.max(1, ...sum.types.map(([, count]) => count));
  const typeRows = sum.types.map(([name, count], index) => {
    const blocks = Math.max(1, Math.round((count / maxType) * 10));
    return `<tr class="${index % 2 ? "alt" : ""}"><td colspan="3">${xml(name)}</td><td colspan="4" class="bar">${`<i></i>`.repeat(blocks)}</td><td class="number">${count}</td></tr>`;
  }).join("") || `<tr><td colspan="8" class="empty">Nenhuma atividade no período</td></tr>`;
  const recordRows = options.activities.map((item, index) => `<tr class="${index % 2 ? "alt" : ""}"><td>${xml(item.userName)}</td><td>${xml(item.userEmail)}</td><td>${item.kind === "protocol" ? "Protocolo" : "Ligação"}</td><td class="center">${xml(item.distributionState || "-")}</td><td>${xml(item.protocol || "-")}</td><td>${xml(item.typologyName)}</td><td class="number">${item.quantity}</td><td>${xml(dateLabel(item.occurredAt))}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">Nenhum registro encontrado</td></tr>`;

  const report = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>
    body{font-family:Aptos,Calibri,Arial,sans-serif;background:#f1f5f9;color:#142235;margin:0}.sheet{width:1120px;background:#fff;border-collapse:collapse}.sheet td{border:0}.banner{height:150px;background:#071526;padding:0}.banner img{display:block;width:1120px;height:150px;object-fit:cover}.hero{background:#071526;color:#fff;padding:22px 30px}.hero h1{font-size:27px;margin:0 0 8px}.hero p{font-size:13px;color:#d6e3f2;margin:0}.accent{height:7px;background:#f5bf16}.space{height:18px}.metric-label{background:#152b45;color:#bcd0e6;font-size:11px;font-weight:bold;text-align:center;padding:11px;border-right:6px solid #fff}.metric-value{background:#203a5a;color:#fff;font-size:25px;font-weight:bold;text-align:center;padding:16px;border-right:6px solid #fff}.metric-total{background:#aeea18;color:#0b1929}.section{background:#0b1d31;color:#fff;font-size:16px;font-weight:bold;padding:12px 14px;border-left:7px solid #f5bf16}.subhead td{background:#f5bf16;color:#111827;font-weight:bold;padding:9px;border:1px solid #dca900}.data td{padding:9px;border:1px solid #d9e1e9}.alt td{background:#eef4f8}.number,.center{text-align:center}.bar i{display:inline-block;width:18px;height:11px;margin-right:2px;background:#9ee70b}.empty{text-align:center;color:#64748b;padding:20px!important}.foot{background:#071526;color:#9eb2c9;padding:12px 16px;font-size:10px}
  </style></head><body><table class="sheet">
    ${banner ? `<tr><td colspan="8" class="banner"><img src="${banner}" alt="Energia e produtividade"></td></tr>` : ""}
    <tr><td colspan="8" class="hero"><h1>${xml(options.title)}</h1><p>${xml(options.subtitle)} &nbsp; • &nbsp; Gerado em ${xml(new Date().toLocaleString("pt-BR"))}</p></td></tr><tr><td colspan="8" class="accent"></td></tr><tr><td colspan="8" class="space"></td></tr>
    <tr><td></td><td colspan="2" class="metric-label">PROTOCOLOS</td><td colspan="2" class="metric-label">LIGAÇÕES</td><td colspan="2" class="metric-label">TOTAL PRODUZIDO</td><td></td></tr>
    <tr><td></td><td colspan="2" class="metric-value">${sum.protocols}</td><td colspan="2" class="metric-value">${sum.calls}</td><td colspan="2" class="metric-value metric-total">${sum.total}</td><td></td></tr><tr><td colspan="8" class="space"></td></tr>
    <tr><td colspan="8" class="section">DISTRIBUIÇÃO POR TIPOLOGIA</td></tr><tr class="subhead"><td colspan="3">Tipologia</td><td colspan="4">Representação visual</td><td>Quantidade</td></tr><tbody class="data">${typeRows}</tbody>
    <tr><td colspan="8" class="space"></td></tr><tr><td colspan="8" class="section">REGISTROS DETALHADOS</td></tr><tr class="subhead"><td>Atendente</td><td>E-mail</td><td>Tipo</td><td>Estado</td><td>Protocolo</td><td>Tipologia</td><td>Quantidade</td><td>Data e hora</td></tr><tbody class="data">${recordRows}</tbody>
    <tr><td colspan="8" class="foot">Backoffice Produção • Controle de Produtividade • Documento gerado automaticamente</td></tr>
  </table></body></html>`;
  save(new Blob(["\ufeff", report], { type: "application/vnd.ms-excel;charset=utf-8" }), `relatorio-backoffice-producao-${filename(options.subtitle)}.xls`);
}

const xlsxCell = (reference: string, value: string | number, style = 0) => typeof value === "number"
  ? `<c r="${reference}" s="${style}"><v>${value}</v></c>`
  : `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;

const strToU8 = (value: string) => new TextEncoder().encode(value);
function createZip(files: Record<string, Uint8Array>) {
  const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const u16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const u32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);
  for (const [name, data] of Object.entries(files)) {
    const nameBytes = strToU8(name); const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length); const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0x0800); u16(lv, 8, 0); u32(lv, 14, crc); u32(lv, 18, data.length); u32(lv, 22, data.length); u16(lv, 26, nameBytes.length); local.set(nameBytes, 30);
    const directory = new Uint8Array(46 + nameBytes.length); const dv = new DataView(directory.buffer);
    u32(dv, 0, 0x02014b50); u16(dv, 4, 20); u16(dv, 6, 20); u16(dv, 8, 0x0800); u16(dv, 10, 0); u32(dv, 16, crc); u32(dv, 20, data.length); u32(dv, 24, data.length); u16(dv, 28, nameBytes.length); u32(dv, 42, offset); directory.set(nameBytes, 46);
    parts.push(local, data); central.push(directory); offset += local.length + data.length;
  }
  const centralSize = central.reduce((total, item) => total + item.length, 0); const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50); u16(ev, 8, central.length); u16(ev, 10, central.length); u32(ev, 12, centralSize); u32(ev, 16, offset);
  const result = new Uint8Array(offset + centralSize + end.length); let cursor = 0;
  for (const item of [...parts, ...central, end]) { result.set(item, cursor); cursor += item.length; }
  return result;
}

export async function exportExcelReport(options: Options) {
  const activities = options.activities.filter((item) => item.kind === "protocol");
  const sum = totals(activities);
  const banner = new Uint8Array(await (await fetch("/report-energy-banner.png")).arrayBuffer());
  const detailTitleRow = 17 + sum.types.length;
  const detailHeaderRow = detailTitleRow + 1;
  const detailStartRow = detailHeaderRow + 1;
  let groupedRow = detailStartRow;
  const groupedDetailRows: string[] = [];
  const groupedMerges: string[] = [];
  const activitiesByDay = new Map<string, Activity[]>();
  [...activities].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).forEach((item) => {
    const day = item.occurredAt.slice(0, 10);
    activitiesByDay.set(day, [...(activitiesByDay.get(day) ?? []), item]);
  });
  activitiesByDay.forEach((items, day) => {
    groupedDetailRows.push(`<row r="${groupedRow}" ht="24" customHeight="1">${xlsxCell(`A${groupedRow}`, `DIA ${new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR")}`, 6)}</row>`);
    groupedMerges.push(`<mergeCell ref="A${groupedRow}:I${groupedRow}"/>`);
    groupedRow++;
    items.forEach((item, index) => {
      const style = index % 2 ? 9 : 8;
      const protocolStyle = index % 2 ? 12 : 11;
      groupedDetailRows.push(`<row r="${groupedRow}" ht="22" customHeight="1">${xlsxCell(`A${groupedRow}`, item.userName, style)}${xlsxCell(`B${groupedRow}`, item.userEmail, style)}${xlsxCell(`C${groupedRow}`, item.kind === "protocol" ? "Protocolo" : "Ligação", style)}${xlsxCell(`D${groupedRow}`, item.distributionState || "-", style)}${xlsxCell(`E${groupedRow}`, item.protocol || "-", protocolStyle)}${xlsxCell(`F${groupedRow}`, outcomeLabel(item), style)}${xlsxCell(`G${groupedRow}`, item.typologyName, style)}${xlsxCell(`H${groupedRow}`, item.quantity, style)}${xlsxCell(`I${groupedRow}`, dateLabel(item.occurredAt), style)}</row>`);
      groupedRow++;
    });
  });
  const summaryRows = [
    `<row r="7" ht="34" customHeight="1">${xlsxCell("A7", options.title, 1)}</row>`,
    `<row r="8" ht="22" customHeight="1">${xlsxCell("A8", `${options.subtitle} • Gerado em ${new Date().toLocaleString("pt-BR")}`, 2)}</row>`,
    `<row r="10" ht="22" customHeight="1">${xlsxCell("B10", "QUANTIDADE DE PROTOCOLOS", 3)}</row>`,
    `<row r="11" ht="38" customHeight="1">${xlsxCell("B11", sum.protocols, 4)}</row>`,
    `<row r="13" ht="25" customHeight="1">${xlsxCell("A13", "DISTRIBUIÇÃO POR TIPOLOGIA", 6)}</row>`,
    `<row r="14" ht="22" customHeight="1">${xlsxCell("A14", "Tipologia", 7)}${xlsxCell("F14", "Quantidade", 7)}</row>`,
    ...sum.types.map(([name, count], index) => {
      const row = 15 + index;
      const style = index % 2 ? 9 : 8;
      return `<row r="${row}" ht="22" customHeight="1">${xlsxCell(`A${row}`, name, style)}${xlsxCell(`F${row}`, count, style)}</row>`;
    }),
    `<row r="${detailTitleRow}" ht="25" customHeight="1">${xlsxCell(`A${detailTitleRow}`, "REGISTROS DO PERÍODO", 6)}</row>`,
    `<row r="${detailHeaderRow}" ht="25" customHeight="1">${["Atendente", "E-mail", "Tipo", "Estado", "Protocolo", "Parecer", "Tipologia", "Quantidade", "Data e hora"].map((value, index) => xlsxCell(`${String.fromCharCode(65 + index)}${detailHeaderRow}`, value, 7)).join("")}</row>`,
    ...groupedDetailRows,
  ].join("");
  const lastSummaryRow = Math.max(detailStartRow, groupedRow - 1);
  const recordRows = activities.map((item, index) => {
    const row = 4 + index;
    const style = index % 2 ? 9 : 8;
    const protocolStyle = index % 2 ? 12 : 11;
    return `<row r="${row}" ht="21" customHeight="1">${xlsxCell(`A${row}`, item.userName, style)}${xlsxCell(`B${row}`, item.userEmail, style)}${xlsxCell(`C${row}`, item.kind === "protocol" ? "Protocolo" : "Ligação", style)}${xlsxCell(`D${row}`, item.distributionState || "-", style)}${xlsxCell(`E${row}`, item.protocol || "-", protocolStyle)}${xlsxCell(`F${row}`, outcomeLabel(item), style)}${xlsxCell(`G${row}`, item.typologyName, style)}${xlsxCell(`H${row}`, item.quantity, style)}${xlsxCell(`I${row}`, dateLabel(item.occurredAt), style)}</row>`;
  }).join("");
  const lastRecordRow = Math.max(4, 3 + activities.length);

  const sheet = (body: string, dimension: string, columns: string, merges: string, drawing = false, freeze = "", filter = "") => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${columns}<sheetData>${body}</sheetData>${filter ? `<autoFilter ref="${filter}"/>` : ""}${merges}${drawing ? `<drawing r:id="rId1"/>` : ""}</worksheet>`;
  const summaryMerges = `<mergeCells count="${7 + groupedMerges.length}"><mergeCell ref="A7:I7"/><mergeCell ref="A8:I8"/><mergeCell ref="B10:H10"/><mergeCell ref="B11:H11"/><mergeCell ref="A13:I13"/><mergeCell ref="A14:F14"/><mergeCell ref="A${detailTitleRow}:I${detailTitleRow}"/>${groupedMerges.join("")}</mergeCells>`;
  const recordHeader = `<row r="1" ht="32" customHeight="1">${xlsxCell("A1", "REGISTROS DETALHADOS", 1)}</row><row r="3" ht="25" customHeight="1">${["Atendente","E-mail","Tipo","Estado","Protocolo","Parecer","Tipologia","Quantidade","Data e hora"].map((value, index) => xlsxCell(`${String.fromCharCode(65 + index)}3`, value, 7)).join("")}</row>`;
  const summarySheet = sheet(summaryRows, `A1:I${lastSummaryRow}`, `<cols><col min="1" max="1" width="31" customWidth="1" style="10"/><col min="2" max="4" width="17" customWidth="1" style="10"/><col min="5" max="5" width="27" customWidth="1" style="10"/><col min="6" max="6" width="18" customWidth="1" style="10"/><col min="7" max="7" width="22" customWidth="1" style="10"/><col min="8" max="9" width="17" customWidth="1" style="10"/></cols>`, summaryMerges, true);
  const recordsSheet = sheet(recordHeader + recordRows, `A1:I${lastRecordRow}`, `<cols><col min="1" max="1" width="25" customWidth="1" style="10"/><col min="2" max="2" width="38" customWidth="1" style="10"/><col min="3" max="4" width="17" customWidth="1" style="10"/><col min="5" max="5" width="27" customWidth="1" style="10"/><col min="6" max="6" width="18" customWidth="1" style="10"/><col min="7" max="7" width="32" customWidth="1" style="10"/><col min="8" max="8" width="13" customWidth="1" style="10"/><col min="9" max="9" width="22" customWidth="1" style="10"/></cols>`, `<mergeCells count="1"><mergeCell ref="A1:I1"/></mergeCells>`, false, `<pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>`, `A3:I${lastRecordRow}`);

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/><sheet name="Registros" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(summarySheet),
    "xl/worksheets/sheet2.xml": strToU8(recordsSheet),
    "xl/worksheets/_rels/sheet1.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`),
    "xl/drawings/drawing1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Faixa ARII"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`),
    "xl/drawings/_rels/drawing1.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`),
    "xl/media/image1.png": banner,
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="22"/><name val="Aptos Display"/></font><font><color rgb="FFD6E3F2"/><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FF111827"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF071526"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF152B45"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF203A5A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFAEEA18"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5BF16"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF4F8"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD9E1E9"/></left><right style="thin"><color rgb="FFD9E1E9"/></right><top style="thin"><color rgb="FFD9E1E9"/></top><bottom style="thin"><color rgb="FFD9E1E9"/></bottom></border></borders><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="1" fontId="1" fillId="4" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="1" fontId="3" fillId="5" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0"/><xf numFmtId="0" fontId="3" fillId="6" borderId="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0"/><xf numFmtId="49" fontId="2" fillId="2" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf><xf numFmtId="49" fontId="2" fillId="3" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf></cellXfs></styleSheet>`),
  };
  save(new Blob([createZip(files) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `relatorio-backoffice-producao-${filename(options.subtitle)}.xlsx`);
}

void exportExcelReportLegacy;
void exportExcelReportHtmlLegacy;

const pdfText = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const short = (value: string, length: number) => { const text = pdfText(value); return text.length > length ? `${text.slice(0, length - 3)}...` : text; };

export function exportPdfReport(options: Options) {
  const activities = options.activities.filter((item) => item.kind === "protocol");
  const sum = totals(activities); const perPage = 15;
  const pdfDays = new Map<string, Activity[]>();
  [...activities].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).forEach((item) => { const day = item.occurredAt.slice(0, 10); pdfDays.set(day, [...(pdfDays.get(day) ?? []), item]); });
  const pages = [...pdfDays.entries()].flatMap(([day, items]) => Array.from({ length: Math.ceil(items.length / perPage) }, (_, i) => ({ day, items: items.slice(i * perPage, (i + 1) * perPage) })));
  if (!pages.length) pages.push({ day: "", items: [] });
  const streams = pages.map(({ day, items }, page) => {
    const dayLabel = day ? ` | DIA ${new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR")}` : "";
    const c = ["0.043 0.094 0.157 rg 0 0 842 595 re f", "0.949 0.718 0.020 rg 0 531 842 64 re f", `BT /F2 20 Tf 0.06 0.06 0.06 rg 34 560 Td (BACKOFFICE PRODUCAO | ${pdfText(options.title)}) Tj ET`, `BT /F1 9 Tf 0.12 0.18 0.25 rg 34 543 Td (${pdfText(options.subtitle)} | Gerado em ${pdfText(new Date().toLocaleString("pt-BR"))}) Tj ET`, "0.125 0.192 0.286 rg 34 478 774 42 re f", `BT /F1 8 Tf 0.68 0.76 0.86 rg 48 504 Td (QUANTIDADE DE PROTOCOLOS) Tj ET`, `BT /F2 18 Tf 1 1 1 rg 48 485 Td (${sum.protocols}) Tj ET`, "0.949 0.718 0.020 rg 34 438 774 26 re f", `BT /F2 7 Tf 0.06 0.06 0.06 rg 40 447 Td (ATENDENTE${pdfText(dayLabel)}) Tj 135 0 Td (TIPO / UF) Tj 90 0 Td (PROTOCOLO COMPLETO) Tj 120 0 Td (PARECER) Tj 95 0 Td (TIPOLOGIA) Tj 185 0 Td (DATA) Tj 90 0 Td (QTD) Tj ET`];
    items.forEach((item, i) => {
      const y = 420 - i * 24;
      const protocolValue = pdfText(item.protocol || "-");
      const protocolSize = protocolValue.length > 24 ? 5 : protocolValue.length > 19 ? 6 : 7;
      if (i % 2 === 0) c.push(`0.067 0.133 0.216 rg 34 ${y - 7} 774 22 re f`);
      c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 40 ${y} Td (${short(item.userName, 24)}) Tj ET`);
      c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 175 ${y} Td (Protocolo / ${pdfText(item.distributionState || "-")}) Tj ET`);
      c.push(`BT /F1 ${protocolSize} Tf 1 1 1 rg 265 ${y} Td (${protocolValue}) Tj ET`);
      c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 385 ${y} Td (${pdfText(outcomeLabel(item))}) Tj ET`);
      c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 480 ${y} Td (${short(item.typologyName, 29)}) Tj ET`);
      c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 665 ${y} Td (${pdfText(new Date(item.occurredAt).toLocaleDateString("pt-BR"))}) Tj ET`);
      c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 755 ${y} Td (${item.quantity}) Tj ET`);
    });
    c.push(`BT /F1 8 Tf 0.55 0.65 0.76 rg 34 28 Td (Backoffice Producao - Relatorio de protocolos) Tj 690 0 Td (Pagina ${page + 1}/${pages.length}) Tj ET`); return c.join("\n");
  });
  const regular = 3 + streams.length * 2, bold = regular + 1;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${streams.length} /Kids [${streams.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] >>`];
  streams.forEach((stream, i) => { objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`); });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  let pdf = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; }); const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  save(new Blob([pdf], { type: "application/pdf" }), `relatorio-backoffice-producao-${filename(options.subtitle)}.pdf`);
}
