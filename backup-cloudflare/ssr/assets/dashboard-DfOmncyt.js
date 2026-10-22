import { a as require_react, o as __toESM, t as require_jsx_runtime } from "../index.js";
//#region app/report-export.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
function save(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
var filename = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
var xml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var dateLabel = (value) => new Date(value).toLocaleString("pt-BR", {
	dateStyle: "short",
	timeStyle: "short"
});
var outcomeLabel$1 = (item) => item.kind !== "protocol" ? "-" : item.outcome === "deferred" ? "Deferido" : item.outcome === "analysis" ? "Em análise" : item.outcome === "denied" ? "Indeferido" : "Não informado";
function totals(activities) {
	const protocols = activities.filter((item) => item.kind === "protocol").reduce((sum, item) => sum + item.quantity, 0);
	const calls = activities.filter((item) => item.kind === "call").reduce((sum, item) => sum + item.quantity, 0);
	const types = /* @__PURE__ */ new Map();
	activities.forEach((item) => {
		const label = `${item.kind === "protocol" ? "Protocolo" : "Ligação"} — ${item.typologyName}`;
		types.set(label, (types.get(label) ?? 0) + item.quantity);
	});
	return {
		protocols,
		calls,
		total: protocols + calls,
		types: [...types].sort((a, b) => b[1] - a[1])
	};
}
var xlsxCell = (reference, value, style = 0) => typeof value === "number" ? `<c r="${reference}" s="${style}"><v>${value}</v></c>` : `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
var strToU8 = (value) => new TextEncoder().encode(value);
function createZip(files) {
	const parts = [];
	const central = [];
	let offset = 0;
	const crc32 = (data) => {
		let crc = 4294967295;
		for (const byte of data) {
			crc ^= byte;
			for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ 3988292384 & -(crc & 1);
		}
		return (crc ^ 4294967295) >>> 0;
	};
	const u16 = (view, at, value) => view.setUint16(at, value, true);
	const u32 = (view, at, value) => view.setUint32(at, value, true);
	for (const [name, data] of Object.entries(files)) {
		const nameBytes = strToU8(name);
		const crc = crc32(data);
		const local = new Uint8Array(30 + nameBytes.length);
		const lv = new DataView(local.buffer);
		u32(lv, 0, 67324752);
		u16(lv, 4, 20);
		u16(lv, 6, 2048);
		u16(lv, 8, 0);
		u32(lv, 14, crc);
		u32(lv, 18, data.length);
		u32(lv, 22, data.length);
		u16(lv, 26, nameBytes.length);
		local.set(nameBytes, 30);
		const directory = new Uint8Array(46 + nameBytes.length);
		const dv = new DataView(directory.buffer);
		u32(dv, 0, 33639248);
		u16(dv, 4, 20);
		u16(dv, 6, 20);
		u16(dv, 8, 2048);
		u16(dv, 10, 0);
		u32(dv, 16, crc);
		u32(dv, 20, data.length);
		u32(dv, 24, data.length);
		u16(dv, 28, nameBytes.length);
		u32(dv, 42, offset);
		directory.set(nameBytes, 46);
		parts.push(local, data);
		central.push(directory);
		offset += local.length + data.length;
	}
	const centralSize = central.reduce((total, item) => total + item.length, 0);
	const end = new Uint8Array(22);
	const ev = new DataView(end.buffer);
	u32(ev, 0, 101010256);
	u16(ev, 8, central.length);
	u16(ev, 10, central.length);
	u32(ev, 12, centralSize);
	u32(ev, 16, offset);
	const result = new Uint8Array(offset + centralSize + end.length);
	let cursor = 0;
	for (const item of [
		...parts,
		...central,
		end
	]) {
		result.set(item, cursor);
		cursor += item.length;
	}
	return result;
}
async function exportExcelReport(options) {
	const activities = options.activities.filter((item) => item.kind === "protocol");
	const sum = totals(activities);
	const banner = new Uint8Array(await (await fetch("/report-energy-banner.png")).arrayBuffer());
	const detailTitleRow = 17 + sum.types.length;
	const detailHeaderRow = detailTitleRow + 1;
	const detailStartRow = detailHeaderRow + 1;
	let groupedRow = detailStartRow;
	const groupedDetailRows = [];
	const groupedMerges = [];
	const activitiesByDay = /* @__PURE__ */ new Map();
	[...activities].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).forEach((item) => {
		const day = item.occurredAt.slice(0, 10);
		activitiesByDay.set(day, [...activitiesByDay.get(day) ?? [], item]);
	});
	activitiesByDay.forEach((items, day) => {
		groupedDetailRows.push(`<row r="${groupedRow}" ht="24" customHeight="1">${xlsxCell(`A${groupedRow}`, `DIA ${(/* @__PURE__ */ new Date(`${day}T12:00:00`)).toLocaleDateString("pt-BR")}`, 6)}</row>`);
		groupedMerges.push(`<mergeCell ref="A${groupedRow}:I${groupedRow}"/>`);
		groupedRow++;
		items.forEach((item, index) => {
			const style = index % 2 ? 9 : 8;
			const protocolStyle = index % 2 ? 12 : 11;
			groupedDetailRows.push(`<row r="${groupedRow}" ht="22" customHeight="1">${xlsxCell(`A${groupedRow}`, item.userName, style)}${xlsxCell(`B${groupedRow}`, item.userEmail, style)}${xlsxCell(`C${groupedRow}`, item.kind === "protocol" ? "Protocolo" : "Ligação", style)}${xlsxCell(`D${groupedRow}`, item.distributionState || "-", style)}${xlsxCell(`E${groupedRow}`, item.protocol || "-", protocolStyle)}${xlsxCell(`F${groupedRow}`, outcomeLabel$1(item), style)}${xlsxCell(`G${groupedRow}`, item.typologyName, style)}${xlsxCell(`H${groupedRow}`, item.quantity, style)}${xlsxCell(`I${groupedRow}`, dateLabel(item.occurredAt), style)}</row>`);
			groupedRow++;
		});
	});
	const summaryRows = [
		`<row r="7" ht="34" customHeight="1">${xlsxCell("A7", options.title, 1)}</row>`,
		`<row r="8" ht="22" customHeight="1">${xlsxCell("A8", `${options.subtitle} • Gerado em ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR")}`, 2)}</row>`,
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
		`<row r="${detailHeaderRow}" ht="25" customHeight="1">${[
			"Atendente",
			"E-mail",
			"Tipo",
			"Estado",
			"Protocolo",
			"Parecer",
			"Tipologia",
			"Quantidade",
			"Data e hora"
		].map((value, index) => xlsxCell(`${String.fromCharCode(65 + index)}${detailHeaderRow}`, value, 7)).join("")}</row>`,
		...groupedDetailRows
	].join("");
	const lastSummaryRow = Math.max(detailStartRow, groupedRow - 1);
	const recordRows = activities.map((item, index) => {
		const row = 4 + index;
		const style = index % 2 ? 9 : 8;
		const protocolStyle = index % 2 ? 12 : 11;
		return `<row r="${row}" ht="21" customHeight="1">${xlsxCell(`A${row}`, item.userName, style)}${xlsxCell(`B${row}`, item.userEmail, style)}${xlsxCell(`C${row}`, item.kind === "protocol" ? "Protocolo" : "Ligação", style)}${xlsxCell(`D${row}`, item.distributionState || "-", style)}${xlsxCell(`E${row}`, item.protocol || "-", protocolStyle)}${xlsxCell(`F${row}`, outcomeLabel$1(item), style)}${xlsxCell(`G${row}`, item.typologyName, style)}${xlsxCell(`H${row}`, item.quantity, style)}${xlsxCell(`I${row}`, dateLabel(item.occurredAt), style)}</row>`;
	}).join("");
	const lastRecordRow = Math.max(4, 3 + activities.length);
	const sheet = (body, dimension, columns, merges, drawing = false, freeze = "", filter = "") => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${columns}<sheetData>${body}</sheetData>${filter ? `<autoFilter ref="${filter}"/>` : ""}${merges}${drawing ? `<drawing r:id="rId1"/>` : ""}</worksheet>`;
	const summaryMerges = `<mergeCells count="${7 + groupedMerges.length}"><mergeCell ref="A7:I7"/><mergeCell ref="A8:I8"/><mergeCell ref="B10:H10"/><mergeCell ref="B11:H11"/><mergeCell ref="A13:I13"/><mergeCell ref="A14:F14"/><mergeCell ref="A${detailTitleRow}:I${detailTitleRow}"/>${groupedMerges.join("")}</mergeCells>`;
	const recordHeader = `<row r="1" ht="32" customHeight="1">${xlsxCell("A1", "REGISTROS DETALHADOS", 1)}</row><row r="3" ht="25" customHeight="1">${[
		"Atendente",
		"E-mail",
		"Tipo",
		"Estado",
		"Protocolo",
		"Parecer",
		"Tipologia",
		"Quantidade",
		"Data e hora"
	].map((value, index) => xlsxCell(`${String.fromCharCode(65 + index)}3`, value, 7)).join("")}</row>`;
	const summarySheet = sheet(summaryRows, `A1:I${lastSummaryRow}`, `<cols><col min="1" max="1" width="31" customWidth="1" style="10"/><col min="2" max="4" width="17" customWidth="1" style="10"/><col min="5" max="5" width="27" customWidth="1" style="10"/><col min="6" max="6" width="18" customWidth="1" style="10"/><col min="7" max="7" width="22" customWidth="1" style="10"/><col min="8" max="9" width="17" customWidth="1" style="10"/></cols>`, summaryMerges, true);
	const recordsSheet = sheet(recordHeader + recordRows, `A1:I${lastRecordRow}`, `<cols><col min="1" max="1" width="25" customWidth="1" style="10"/><col min="2" max="2" width="38" customWidth="1" style="10"/><col min="3" max="4" width="17" customWidth="1" style="10"/><col min="5" max="5" width="27" customWidth="1" style="10"/><col min="6" max="6" width="18" customWidth="1" style="10"/><col min="7" max="7" width="32" customWidth="1" style="10"/><col min="8" max="8" width="13" customWidth="1" style="10"/><col min="9" max="9" width="22" customWidth="1" style="10"/></cols>`, `<mergeCells count="1"><mergeCell ref="A1:I1"/></mergeCells>`, false, `<pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>`, `A3:I${lastRecordRow}`);
	const files = {
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
		"xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="22"/><name val="Aptos Display"/></font><font><color rgb="FFD6E3F2"/><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FF111827"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF071526"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF152B45"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF203A5A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFAEEA18"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5BF16"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF4F8"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD9E1E9"/></left><right style="thin"><color rgb="FFD9E1E9"/></right><top style="thin"><color rgb="FFD9E1E9"/></top><bottom style="thin"><color rgb="FFD9E1E9"/></bottom></border></borders><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="1" fontId="1" fillId="4" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="1" fontId="3" fillId="5" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0"/><xf numFmtId="0" fontId="3" fillId="6" borderId="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0"/><xf numFmtId="49" fontId="2" fillId="2" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf><xf numFmtId="49" fontId="2" fillId="3" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf></cellXfs></styleSheet>`)
	};
	save(new Blob([createZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `relatorio-backoffice-producao-${filename(options.subtitle)}.xlsx`);
}
var pdfText = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
var short = (value, length) => {
	const text = pdfText(value);
	return text.length > length ? `${text.slice(0, length - 3)}...` : text;
};
function exportPdfReport(options) {
	const activities = options.activities.filter((item) => item.kind === "protocol");
	const sum = totals(activities);
	const perPage = 15;
	const pdfDays = /* @__PURE__ */ new Map();
	[...activities].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).forEach((item) => {
		const day = item.occurredAt.slice(0, 10);
		pdfDays.set(day, [...pdfDays.get(day) ?? [], item]);
	});
	const pages = [...pdfDays.entries()].flatMap(([day, items]) => Array.from({ length: Math.ceil(items.length / perPage) }, (_, i) => ({
		day,
		items: items.slice(i * perPage, (i + 1) * perPage)
	})));
	if (!pages.length) pages.push({
		day: "",
		items: []
	});
	const streams = pages.map(({ day, items }, page) => {
		const dayLabel = day ? ` | DIA ${(/* @__PURE__ */ new Date(`${day}T12:00:00`)).toLocaleDateString("pt-BR")}` : "";
		const c = [
			"0.043 0.094 0.157 rg 0 0 842 595 re f",
			"0.949 0.718 0.020 rg 0 531 842 64 re f",
			`BT /F2 20 Tf 0.06 0.06 0.06 rg 34 560 Td (BACKOFFICE PRODUCAO | ${pdfText(options.title)}) Tj ET`,
			`BT /F1 9 Tf 0.12 0.18 0.25 rg 34 543 Td (${pdfText(options.subtitle)} | Gerado em ${pdfText((/* @__PURE__ */ new Date()).toLocaleString("pt-BR"))}) Tj ET`,
			"0.125 0.192 0.286 rg 34 478 774 42 re f",
			`BT /F1 8 Tf 0.68 0.76 0.86 rg 48 504 Td (QUANTIDADE DE PROTOCOLOS) Tj ET`,
			`BT /F2 18 Tf 1 1 1 rg 48 485 Td (${sum.protocols}) Tj ET`,
			"0.949 0.718 0.020 rg 34 438 774 26 re f",
			`BT /F2 7 Tf 0.06 0.06 0.06 rg 40 447 Td (ATENDENTE${pdfText(dayLabel)}) Tj 135 0 Td (TIPO / UF) Tj 90 0 Td (PROTOCOLO COMPLETO) Tj 120 0 Td (PARECER) Tj 95 0 Td (TIPOLOGIA) Tj 185 0 Td (DATA) Tj 90 0 Td (QTD) Tj ET`
		];
		items.forEach((item, i) => {
			const y = 420 - i * 24;
			const protocolValue = pdfText(item.protocol || "-");
			const protocolSize = protocolValue.length > 24 ? 5 : protocolValue.length > 19 ? 6 : 7;
			if (i % 2 === 0) c.push(`0.067 0.133 0.216 rg 34 ${y - 7} 774 22 re f`);
			c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 40 ${y} Td (${short(item.userName, 24)}) Tj ET`);
			c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 175 ${y} Td (Protocolo / ${pdfText(item.distributionState || "-")}) Tj ET`);
			c.push(`BT /F1 ${protocolSize} Tf 1 1 1 rg 265 ${y} Td (${protocolValue}) Tj ET`);
			c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 385 ${y} Td (${pdfText(outcomeLabel$1(item))}) Tj ET`);
			c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 480 ${y} Td (${short(item.typologyName, 29)}) Tj ET`);
			c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 665 ${y} Td (${pdfText(new Date(item.occurredAt).toLocaleDateString("pt-BR"))}) Tj ET`);
			c.push(`BT /F1 7 Tf 0.9 0.94 0.98 rg 755 ${y} Td (${item.quantity}) Tj ET`);
		});
		c.push(`BT /F1 8 Tf 0.55 0.65 0.76 rg 34 28 Td (Backoffice Producao - Relatorio de protocolos) Tj 690 0 Td (Pagina ${page + 1}/${pages.length}) Tj ET`);
		return c.join("\n");
	});
	const regular = 3 + streams.length * 2, bold = regular + 1;
	const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${streams.length} /Kids [${streams.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] >>`];
	streams.forEach((stream, i) => {
		objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
	});
	objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
	let pdf = "%PDF-1.4\n";
	const offsets = [0];
	objects.forEach((obj, i) => {
		offsets.push(pdf.length);
		pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
	});
	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	save(new Blob([pdf], { type: "application/pdf" }), `relatorio-backoffice-producao-${filename(options.subtitle)}.pdf`);
}
//#endregion
//#region app/dashboard.tsx
var import_jsx_runtime = require_jsx_runtime();
var EMPTY_DATA = {
	currentUser: {
		email: "",
		name: "",
		role: "attendant",
		employeeCode: null,
		registrationComplete: false,
		isAdmin: false
	},
	typologies: [],
	activities: [],
	team: [],
	settings: {
		workdaySeconds: 20400,
		goal: .9,
		challenge: 1
	}
};
var todayInput = () => {
	const date = /* @__PURE__ */ new Date();
	const offset = date.getTimezoneOffset();
	return (/* @__PURE__ */ new Date(date.getTime() - offset * 6e4)).toISOString().slice(0, 10);
};
var timeInput = () => (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", {
	hour: "2-digit",
	minute: "2-digit"
});
function formatDuration(totalSeconds) {
	const seconds = Math.max(0, Math.round(totalSeconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor(seconds % 3600 / 60);
	return `${hours}h${String(minutes).padStart(2, "0")}`;
}
function formatPercent(value) {
	return `${(value * 100).toLocaleString("pt-BR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}%`;
}
function attendantAverageProductivity(data, email) {
	const activities = data.activities.filter((activity) => activity.userEmail === email);
	const activeDays = new Set(activities.map((activity) => activity.occurredAt.slice(0, 10))).size;
	if (!activeDays) return 0;
	return activities.reduce((sum, activity) => sum + activity.durationSeconds * activity.quantity, 0) / (data.settings.workdaySeconds * activeDays);
}
function kindLabel(kind) {
	return kind === "protocol" ? "Protocolo" : "Ligação";
}
function outcomeLabel(outcome) {
	if (outcome === "deferred") return "Deferido";
	if (outcome === "analysis") return "Em análise";
	if (outcome === "denied") return "Indeferido";
	return "Não informado";
}
function activityDate(value) {
	const [date, time] = value.split("T");
	const [year, month, day] = date.split("-");
	return `${day}/${month}/${year} • ${time?.slice(0, 5) ?? "--:--"}`;
}
function Dashboard({ authUser, accessToken }) {
	const [data, setData] = (0, import_react.useState)(EMPTY_DATA);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)("");
	const [tab, setTab] = (0, import_react.useState)("overview");
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	const [search, setSearch] = (0, import_react.useState)("");
	const onSignOut = async () => {
		window.location.assign("/api/auth/logout");
	};
	const loadDashboard = (0, import_react.useCallback)(async () => {
		setLoading(true);
		setError("");
		try {
			const response = await fetch("/api/dashboard", {
				cache: "no-store",
				headers: { authorization: `Bearer ${accessToken}` }
			});
			const payload = await response.json();
			if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o painel.");
			setData(payload);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o painel.");
		} finally {
			setLoading(false);
		}
	}, [accessToken]);
	(0, import_react.useEffect)(() => {
		const timer = window.setTimeout(() => void loadDashboard(), 0);
		return () => window.clearTimeout(timer);
	}, [loadDashboard]);
	const isSupervisor = data.currentUser.role === "supervisor";
	const navItems = isSupervisor ? [
		{
			id: "overview",
			label: "Visão geral",
			icon: "⌂"
		},
		{
			id: "records",
			label: "Protocolos e ligações",
			icon: "▤"
		},
		{
			id: "report",
			label: "Relatórios da equipe",
			icon: "▥"
		},
		{
			id: "team",
			label: "Equipe",
			icon: "◎"
		}
	] : [
		{
			id: "overview",
			label: "Visão geral",
			icon: "⌂"
		},
		{
			id: "calculator",
			label: "Calculadora",
			icon: "▦"
		},
		{
			id: "records",
			label: "Meus registros",
			icon: "▤"
		},
		{
			id: "scripts",
			label: "Scripts",
			icon: "✎"
		},
		{
			id: "report",
			label: "Meu relatório",
			icon: "▥"
		}
	];
	const today = todayInput();
	const todayActivities = (0, import_react.useMemo)(() => data.activities.filter((activity) => activity.occurredAt.startsWith(today)), [data.activities, today]);
	const todayProtocols = todayActivities.filter((activity) => activity.kind === "protocol").reduce((sum, activity) => sum + activity.quantity, 0);
	const todayCalls = todayActivities.filter((activity) => activity.kind === "call").reduce((sum, activity) => sum + activity.quantity, 0);
	const todayProductiveSeconds = todayActivities.reduce((sum, activity) => sum + activity.durationSeconds * activity.quantity, 0);
	const productivity = todayProductiveSeconds / data.settings.workdaySeconds;
	function selectTab(nextTab) {
		setTab(nextTab);
		setMenuOpen(false);
		setSearch("");
	}
	if (!loading && !error && !isSupervisor && !data.currentUser.registrationComplete) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountRegistration, {
		email: data.currentUser.email || authUser.email,
		suggestedName: data.currentUser.name || authUser.displayName,
		accessToken,
		onSignOut,
		onCompleted: loadDashboard
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "app-shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: `sidebar ${menuOpen ? "sidebar-open" : ""}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "brand",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "brand-mark",
							children: "BP"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Backoffice" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Produção" })] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						"aria-label": "Navegação principal",
						children: navItems.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: tab === item.id ? "nav-item active" : "nav-item",
							onClick: () => selectTab(item.id),
							type: "button",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "nav-icon",
								"aria-hidden": "true",
								children: item.icon
							}), item.label]
						}, item.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sidebar-footer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `role-chip ${isSupervisor ? "supervisor" : "attendant"}`,
							children: isSupervisor ? "Supervisão • leitura" : "Atendente"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: data.currentUser.email || authUser.email })]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "workspace",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "topbar",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "menu-button",
							type: "button",
							onClick: () => setMenuOpen(!menuOpen),
							"aria-label": "Abrir menu",
							children: "☰"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", { children: [
							"Controle de Produtividade ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "•" }),
							" Backoffice"
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: isSupervisor ? "Acompanhamento da equipe" : "Meus protocolos e ligações" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "topbar-user",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "today-label",
									children: (/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR", {
										day: "2-digit",
										month: "long",
										year: "numeric"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "avatar",
									"aria-hidden": "true",
									children: (data.currentUser.name || authUser.displayName).charAt(0).toUpperCase()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "signout signout-button",
									onClick: () => void onSignOut(),
									children: "Sair"
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "content",
					children: [
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "alert error",
							children: [error, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => void loadDashboard(),
								children: "Tentar novamente"
							})]
						}) : null,
						loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingState, {}) : null,
						!loading && !error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							tab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overview, {
								isSupervisor,
								data,
								productivity,
								todayProtocols,
								todayCalls,
								todayProductiveSeconds,
								onSaved: loadDashboard,
								accessToken
							}),
							tab === "calculator" && !isSupervisor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, { data }),
							tab === "scripts" && !isSupervisor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {}),
							tab === "records" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Records, {
								activities: data.activities,
								typologies: data.typologies,
								search,
								setSearch,
								isSupervisor,
								accessToken,
								onChanged: loadDashboard
							}),
							tab === "report" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductionReports, {
								data,
								isSupervisor
							}),
							tab === "team" && isSupervisor && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "page-stack",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Team, { data }), data.currentUser.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Attendants, {
									typologies: data.typologies,
									onChanged: loadDashboard
								}) : null]
							})
						] }) : null
					]
				})]
			}),
			menuOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "menu-backdrop",
				"aria-label": "Fechar menu",
				onClick: () => setMenuOpen(false)
			}) : null
		]
	});
}
function AccountRegistration({ email, suggestedName, accessToken, onSignOut, onCompleted }) {
	const [name, setName] = (0, import_react.useState)(suggestedName);
	const [employeeCode, setEmployeeCode] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)({
		type: "idle",
		message: ""
	});
	async function submit(event) {
		event.preventDefault();
		setStatus({
			type: "saving",
			message: "Criando seu cadastro..."
		});
		try {
			const response = await fetch("/api/account", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					name,
					employeeCode
				})
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível concluir o cadastro.");
			await onCompleted();
		} catch (submitError) {
			setStatus({
				type: "error",
				message: submitError instanceof Error ? submitError.message : "Não foi possível concluir o cadastro."
			});
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "registration-shell",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "registration-card",
			"aria-labelledby": "registration-title",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "registration-heading",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "brand-mark",
						children: "BP"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "PRIMEIRO ACESSO"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						id: "registration-title",
						children: "Crie seu cadastro de atendente"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "registration-copy",
					children: "Preencha seus dados uma única vez. Depois você terá acesso à calculadora, aos seus registros e ao seu relatório individual."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "activity-form",
					onSubmit: submit,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Nome completo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: name,
								onChange: (event) => setName(event.target.value),
								minLength: 3,
								maxLength: 120,
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "E-mail de acesso" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: email,
								readOnly: true,
								"aria-readonly": "true"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Matrícula ou identificação" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: employeeCode,
								onChange: (event) => setEmployeeCode(event.target.value),
								minLength: 2,
								maxLength: 40,
								placeholder: "Ex.: 123456",
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "primary-button",
							type: "submit",
							disabled: status.type === "saving",
							children: status.type === "saving" ? "Criando cadastro..." : "Concluir meu cadastro"
						}),
						status.message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: `form-status ${status.type}`,
							children: status.message
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "registration-exit registration-exit-button",
					type: "button",
					onClick: () => void onSignOut(),
					children: "Sair e usar outra conta"
				})
			]
		})
	});
}
function LoadingState() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "loading-grid",
		"aria-label": "Carregando painel",
		children: [
			1,
			2,
			3,
			4
		].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "skeleton" }, item))
	});
}
function Overview({ isSupervisor, data, productivity, todayProtocols, todayCalls, todayProductiveSeconds, onSaved, accessToken }) {
	const [overviewEmail, setOverviewEmail] = (0, import_react.useState)("all");
	const selectedOverviewMember = data.team.find((member) => member.email === overviewEmail);
	const overviewActivities = overviewEmail === "all" ? data.activities : data.activities.filter((activity) => activity.userEmail === overviewEmail);
	const overviewTeam = selectedOverviewMember ? [selectedOverviewMember] : data.team;
	const overviewData = {
		...data,
		activities: overviewActivities,
		team: overviewTeam
	};
	const teamProductivity = data.team.length ? data.team.reduce((sum, member) => sum + attendantAverageProductivity(data, member.email), 0) / data.team.length : 0;
	const selectedProductivity = selectedOverviewMember ? attendantAverageProductivity(data, selectedOverviewMember.email) : teamProductivity;
	const cards = isSupervisor ? [
		{
			label: selectedOverviewMember?.name ?? "Atendentes",
			value: selectedOverviewMember ? "1" : String(data.team.length),
			icon: "◎",
			tone: "blue"
		},
		{
			label: "Protocolos registrados",
			value: String(overviewActivities.filter((a) => a.kind === "protocol").reduce((s, a) => s + a.quantity, 0)),
			icon: "▤",
			tone: "blue"
		},
		{
			label: "Ligações registradas",
			value: String(overviewActivities.filter((a) => a.kind === "call").reduce((s, a) => s + a.quantity, 0)),
			icon: "◖",
			tone: "green"
		},
		{
			label: selectedOverviewMember ? "Produtividade média do atendente" : "Média de produtividade da equipe",
			value: formatPercent(selectedProductivity),
			icon: "↗",
			tone: "green"
		}
	] : [
		{
			label: "Produtividade hoje",
			value: formatPercent(productivity),
			icon: "↗",
			tone: "green"
		},
		{
			label: "Protocolos hoje",
			value: String(todayProtocols),
			icon: "▤",
			tone: "blue"
		},
		{
			label: "Ligações hoje",
			value: String(todayCalls),
			icon: "◖",
			tone: "blue"
		},
		{
			label: "Tempo produtivo",
			value: formatDuration(todayProductiveSeconds),
			icon: "◷",
			tone: "green"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			isSupervisor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel overview-scope-filter",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "VISÃO DA PRODUTIVIDADE"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: selectedOverviewMember ? selectedOverviewMember.name : "Equipe geral" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Escolha a equipe completa ou um atendente para atualizar todos os indicadores desta tela." })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Visualizar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: overviewEmail,
					onChange: (event) => setOverviewEmail(event.target.value),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "all",
						children: "Equipe geral"
					}), data.team.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: member.email,
						children: member.name
					}, member.email))]
				})] })]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "metric-grid",
				children: cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "metric-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `metric-icon ${card.tone}`,
						children: card.icon
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: card.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: card.value })] })]
				}, card.label))
			}),
			isSupervisor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "dashboard-grid supervisor-grid",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TeamSummary, {
					data: overviewData,
					compact: true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecentActivities, {
					activities: overviewActivities,
					supervisor: true
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "dashboard-grid",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityForm, {
					typologies: data.typologies,
					onSaved,
					accessToken
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecentActivities, { activities: data.activities })]
			})
		]
	});
}
function ActivityForm({ typologies, onSaved, accessToken }) {
	const [kind, setKind] = (0, import_react.useState)("protocol");
	const [protocol, setProtocol] = (0, import_react.useState)("");
	const [outcome, setOutcome] = (0, import_react.useState)("analysis");
	const [typologyId, setTypologyId] = (0, import_react.useState)(typologies[0]?.id ?? 0);
	const [date, setDate] = (0, import_react.useState)(todayInput());
	const [time, setTime] = (0, import_react.useState)(timeInput());
	const [quantity, setQuantity] = (0, import_react.useState)(1);
	const [distributionState, setDistributionState] = (0, import_react.useState)("PA");
	const [status, setStatus] = (0, import_react.useState)({
		type: "idle",
		message: ""
	});
	const selectedTypologyId = typologyId || typologies[0]?.id || 0;
	async function submit(event) {
		event.preventDefault();
		setStatus({
			type: "saving",
			message: "Salvando registro..."
		});
		try {
			const response = await fetch("/api/activities", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					kind,
					protocol,
					outcome,
					typologyId: selectedTypologyId,
					date,
					time,
					quantity,
					distributionState
				})
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
			setStatus({
				type: "success",
				message: result.message || "Registro salvo."
			});
			setProtocol("");
			setQuantity(1);
			await onSaved();
		} catch (submitError) {
			setStatus({
				type: "error",
				message: submitError instanceof Error ? submitError.message : "Não foi possível salvar."
			});
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel register-panel",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "section-heading",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "NOVO REGISTRO"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Registrar atividade" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "permission-tag",
					children: "Seu acesso"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "kind-toggle",
				role: "group",
				"aria-label": "Tipo de atividade",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: kind === "protocol" ? "selected" : "",
					onClick: () => setKind("protocol"),
					children: "Protocolo"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: kind === "call" ? "selected" : "",
					onClick: () => setKind("call"),
					children: "Ligação"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: submit,
				className: "activity-form",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipologia" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: selectedTypologyId,
							onChange: (event) => setTypologyId(Number(event.target.value)),
							required: true,
							children: typologies.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: item.id,
								children: item.name
							}, item.id))
						})]
					}),
					kind === "protocol" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Número do protocolo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: protocol,
							onChange: (event) => setProtocol(event.target.value),
							placeholder: "Ex.: PC-5821",
							required: true
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Parecer do protocolo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: outcome,
							onChange: (event) => setOutcome(event.target.value),
							required: true,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "deferred",
									children: "Deferido"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "analysis",
									children: "Em análise"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "denied",
									children: "Indeferido"
								})
							]
						})]
					})] }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Estado atendido" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: distributionState,
							onChange: (event) => setDistributionState(event.target.value),
							required: true,
							children: Object.entries(STATE_CONTACTS).map(([code, item]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: code,
								children: item.state
							}, code))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row three",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Data" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "date",
									value: date,
									onChange: (event) => setDate(event.target.value),
									required: true
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hora" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "time",
									value: time,
									onChange: (event) => setTime(event.target.value),
									required: true
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Quantidade" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "1",
									max: "9999",
									value: quantity,
									onChange: (event) => setQuantity(Number(event.target.value)),
									required: true
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "primary-button",
						type: "submit",
						disabled: status.type === "saving",
						children: status.type === "saving" ? "Salvando..." : "Salvar meu registro"
					}),
					status.message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `form-status ${status.type}`,
						children: status.message
					}) : null
				]
			})
		]
	});
}
function RecentActivities({ activities, supervisor = false }) {
	const recent = activities.slice(0, 8);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel recent-panel",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "section-heading",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "eyebrow",
				children: "ATUALIZAÇÃO AUTOMÁTICA"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: supervisor ? "Últimos registros da equipe" : "Meus últimos registros" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "live-dot",
				children: "Ao vivo"
			})]
		}), recent.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "activity-list",
			children: recent.map((activity) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "activity-item",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `kind-badge ${activity.kind}`,
						children: activity.kind === "protocol" ? "P" : "L"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "activity-main",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: activity.protocol || kindLabel(activity.kind) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [activity.typologyName, activity.distributionState ? ` • ${activity.distributionState}` : ""] }),
							supervisor ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: activity.userName }) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "activity-meta",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: activity.quantity }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activityDate(activity.occurredAt) })]
					})
				]
			}, activity.id))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			title: "Nenhum registro ainda",
			text: supervisor ? "Os registros dos atendentes aparecerão aqui." : "Cadastre seu primeiro protocolo ou ligação."
		})]
	});
}
function Calculator({ data }) {
	const [quantities, setQuantities] = (0, import_react.useState)({});
	const productiveSeconds = data.typologies.reduce((sum, item) => sum + item.seconds * (quantities[item.id] || 0), 0);
	const percentage = productiveSeconds / data.settings.workdaySeconds;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "page-title",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "SIMULAÇÃO INDIVIDUAL"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Calculadora de produtividade" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Informe quanto realizou de cada tipologia. A simulação não cria registros." })
			] })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "calculator-layout",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel calculator-table",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "table-header",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipologia" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tempo padrão" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Quantidade" })
					]
				}), data.typologies.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "calculator-row",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.name }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatDuration(item.seconds) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": `Quantidade de ${item.name}`,
							type: "number",
							min: "0",
							value: quantities[item.id] || "",
							onChange: (event) => setQuantities((current) => ({
								...current,
								[item.id]: Math.max(0, Number(event.target.value) || 0)
							}))
						})
					]
				}, item.id))]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "panel calculator-result",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "RESULTADO"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "score-ring",
						style: { "--score": `${Math.min(100, percentage * 100)}%` },
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: formatPercent(percentage) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "produtividade" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "result-line",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tempo produtivo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: formatDuration(productiveSeconds) })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "result-line",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Meta" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "90%" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `result-status ${percentage >= 1 ? "challenge" : percentage >= .9 ? "goal" : "below"}`,
						children: percentage >= 1 ? "Desafio alcançado" : percentage >= .9 ? "Meta alcançada" : "Abaixo da meta"
					})
				]
			})]
		})]
	});
}
function Records({ activities, typologies, search, setSearch, isSupervisor, accessToken, onChanged }) {
	const [kind, setKind] = (0, import_react.useState)("all");
	const [selectedAttendant, setSelectedAttendant] = (0, import_react.useState)("all");
	const [recordPeriod, setRecordPeriod] = (0, import_react.useState)("daily");
	const [recordDate, setRecordDate] = (0, import_react.useState)(todayInput());
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [actionStatus, setActionStatus] = (0, import_react.useState)("");
	const [deletingId, setDeletingId] = (0, import_react.useState)(null);
	const filtered = activities.filter((activity) => {
		const matchesKind = kind === "all" || activity.kind === kind;
		const matchesAttendant = !isSupervisor || selectedAttendant === "all" || activity.userEmail === selectedAttendant;
		const range = reportRange(recordPeriod, recordDate);
		const activityDay = activity.occurredAt.slice(0, 10);
		const matchesPeriod = !isSupervisor || activityDay >= range.start && activityDay <= range.end;
		const haystack = `${activity.protocol ?? ""} ${activity.typologyName} ${activity.userName} ${activity.distributionState ?? ""}`.toLowerCase();
		return matchesKind && matchesAttendant && matchesPeriod && haystack.includes(search.toLowerCase());
	});
	const attendantOptions = [...new Map(activities.map((activity) => [activity.userEmail, activity.userName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
	async function deleteActivity(activity) {
		const label = activity.protocol ? `o protocolo ${activity.protocol}` : "esta ligação";
		if (!window.confirm(`Tem certeza que deseja excluir ${label}? Esta ação não pode ser desfeita.`)) return;
		setDeletingId(activity.id);
		setActionStatus("");
		try {
			const response = await fetch(`/api/activities?id=${activity.id}`, {
				method: "DELETE",
				headers: { authorization: `Bearer ${accessToken}` }
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível excluir o registro.");
			setActionStatus(result.message || "Registro excluído.");
			await onChanged();
		} catch (error) {
			setActionStatus(error instanceof Error ? error.message : "Não foi possível excluir o registro.");
		} finally {
			setDeletingId(null);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "page-title",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "HISTÓRICO"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: isSupervisor ? "Protocolos e ligações da equipe" : "Meus registros" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: isSupervisor ? "Consulta somente de leitura, organizada por atendente." : "Confira tudo o que você cadastrou." })
				] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel records-panel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "filters",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: search,
							onChange: (event) => setSearch(event.target.value),
							placeholder: "Buscar protocolo, tipologia ou atendente"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: kind,
							onChange: (event) => setKind(event.target.value),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "all",
									children: "Todos os tipos"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "protocol",
									children: "Protocolos"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "call",
									children: "Ligações"
								})
							]
						})]
					}),
					isSupervisor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "record-period-filters",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "record-calendar",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Escolher dia no calendário" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "date",
										value: recordDate,
										onChange: (event) => {
											setRecordDate(event.target.value);
											setRecordPeriod("daily");
										}
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Ao escolher uma data, serão mostrados somente os registros daquele dia." })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Atendente" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: selectedAttendant,
								onChange: (event) => setSelectedAttendant(event.target.value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "all",
									children: "Todos os atendentes"
								}), attendantOptions.map(([email, name]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: email,
									children: name
								}, email))]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Período" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: recordPeriod,
								onChange: (event) => setRecordPeriod(event.target.value),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "daily",
										children: "Somente o dia escolhido"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "weekly",
										children: "Semana do dia escolhido"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "monthly",
										children: "Mês do dia escolhido"
									})
								]
							})] })
						]
					}) : null,
					actionStatus ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "records-status",
						role: "status",
						children: actionStatus
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityTable, {
						activities: filtered,
						showUser: isSupervisor,
						onEdit: isSupervisor ? void 0 : setEditing,
						onDelete: isSupervisor ? void 0 : deleteActivity,
						deletingId
					})
				]
			}),
			editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditActivityModal, {
				activity: editing,
				typologies,
				accessToken,
				onClose: () => setEditing(null),
				onSaved: async (message) => {
					setEditing(null);
					setActionStatus(message);
					await onChanged();
				}
			}) : null
		]
	});
}
function ActivityTable({ activities, showUser, onEdit, onDelete, deletingId }) {
	if (!activities.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		title: "Nada encontrado",
		text: "Ajuste os filtros ou aguarde novos registros."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "table-scroll",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
			showUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Atendente" }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Tipo" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Estado" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Protocolo" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Parecer" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Tipologia" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Quantidade" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Data e hora" }),
			onEdit && onDelete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Ações" }) : null
		] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: activities.map((activity) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
			showUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: activity.userName }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: activity.userEmail })] }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `table-kind ${activity.kind}`,
				children: kindLabel(activity.kind)
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: activity.distributionState || "—" }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: activity.protocol || "—" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: activity.kind === "protocol" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `outcome-badge ${activity.outcome || "unknown"}`,
				children: outcomeLabel(activity.outcome)
			}) : "—" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: activity.typologyName }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: activity.quantity }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: activityDate(activity.occurredAt) }),
			onEdit && onDelete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "record-actions",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "edit-action",
					onClick: () => onEdit(activity),
					children: "Editar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "delete-action",
					onClick: () => onDelete(activity),
					disabled: deletingId === activity.id,
					children: deletingId === activity.id ? "Excluindo..." : "Excluir"
				})]
			}) }) : null
		] }, activity.id)) })] })
	});
}
function EditActivityModal({ activity, typologies, accessToken, onClose, onSaved }) {
	const [kind, setKind] = (0, import_react.useState)(activity.kind);
	const [protocol, setProtocol] = (0, import_react.useState)(activity.protocol || "");
	const [outcome, setOutcome] = (0, import_react.useState)(activity.outcome || "analysis");
	const [typologyId, setTypologyId] = (0, import_react.useState)(activity.typologyId);
	const [quantity, setQuantity] = (0, import_react.useState)(activity.quantity);
	const [date, setDate] = (0, import_react.useState)(activity.occurredAt.slice(0, 10));
	const [time, setTime] = (0, import_react.useState)(activity.occurredAt.slice(11, 16));
	const [distributionState, setDistributionState] = (0, import_react.useState)(activity.distributionState || "PA");
	const [status, setStatus] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	async function submit(event) {
		event.preventDefault();
		setSaving(true);
		setStatus("");
		try {
			const response = await fetch("/api/activities", {
				method: "PATCH",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					id: activity.id,
					kind,
					protocol,
					outcome,
					typologyId,
					quantity,
					date,
					time,
					distributionState
				})
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o registro.");
			await onSaved(result.message || "Registro atualizado.");
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Não foi possível atualizar o registro.");
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "modal-backdrop",
		role: "presentation",
		onMouseDown: (event) => {
			if (event.target === event.currentTarget) onClose();
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "panel edit-modal",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "edit-record-title",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "section-heading",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "CORRIGIR REGISTRO"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "edit-record-title",
						children: "Editar protocolo ou ligação"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "modal-close",
						onClick: onClose,
						"aria-label": "Fechar",
						children: "×"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "kind-toggle",
					role: "group",
					"aria-label": "Tipo de atividade",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: kind === "protocol" ? "selected" : "",
						onClick: () => setKind("protocol"),
						children: "Protocolo"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: kind === "call" ? "selected" : "",
						onClick: () => setKind("call"),
						children: "Ligação"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "activity-form",
					onSubmit: submit,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipologia" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: typologyId,
								onChange: (event) => setTypologyId(Number(event.target.value)),
								required: true,
								children: typologies.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: item.id,
									children: item.name
								}, item.id))
							})]
						}),
						kind === "protocol" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Número do protocolo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: protocol,
								onChange: (event) => setProtocol(event.target.value),
								required: true,
								autoFocus: true
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Parecer do protocolo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: outcome,
								onChange: (event) => setOutcome(event.target.value),
								required: true,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "deferred",
										children: "Deferido"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "analysis",
										children: "Em análise"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "denied",
										children: "Indeferido"
									})
								]
							})]
						})] }) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Estado atendido" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: distributionState,
								onChange: (event) => setDistributionState(event.target.value),
								required: true,
								children: Object.entries(STATE_CONTACTS).map(([code, item]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: code,
									children: item.state
								}, code))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "form-row three",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Data" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "date",
										value: date,
										onChange: (event) => setDate(event.target.value),
										required: true
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hora" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "time",
										value: time,
										onChange: (event) => setTime(event.target.value),
										required: true
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Quantidade" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "1",
										max: "9999",
										value: quantity,
										onChange: (event) => setQuantity(Number(event.target.value)),
										required: true
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "modal-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "secondary-button",
								onClick: onClose,
								children: "Cancelar"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								className: "primary-button",
								disabled: saving,
								children: saving ? "Salvando..." : "Salvar alterações"
							})]
						}),
						status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "form-status error",
							role: "alert",
							children: status
						}) : null
					]
				})
			]
		})
	});
}
function Attendants({ typologies, onChanged }) {
	const [attendants, setAttendants] = (0, import_react.useState)([]);
	const [limit, setLimit] = (0, import_react.useState)(25);
	const [name, setName] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [employeeCode, setEmployeeCode] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [adminSearch, setAdminSearch] = (0, import_react.useState)("");
	const [deletingEmail, setDeletingEmail] = (0, import_react.useState)("");
	const [updatingEmail, setUpdatingEmail] = (0, import_react.useState)("");
	const [productionEmail, setProductionEmail] = (0, import_react.useState)("");
	const [productionKind, setProductionKind] = (0, import_react.useState)("protocol");
	const [productionProtocol, setProductionProtocol] = (0, import_react.useState)("");
	const [productionOutcome, setProductionOutcome] = (0, import_react.useState)("analysis");
	const [productionTypologyId, setProductionTypologyId] = (0, import_react.useState)(typologies[0]?.id ?? 0);
	const [productionState, setProductionState] = (0, import_react.useState)("PA");
	const [productionQuantity, setProductionQuantity] = (0, import_react.useState)(1);
	const [productionDate, setProductionDate] = (0, import_react.useState)(todayInput());
	const [productionTime, setProductionTime] = (0, import_react.useState)(timeInput());
	const [productionStatus, setProductionStatus] = (0, import_react.useState)({
		type: "idle",
		message: ""
	});
	const [status, setStatus] = (0, import_react.useState)({
		type: "loading",
		message: "Carregando atendentes..."
	});
	const loadAttendants = (0, import_react.useCallback)(async () => {
		const response = await fetch("/api/attendants", { cache: "no-store" });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Não foi possível carregar os atendentes.");
		setAttendants(result.attendants ?? []);
		setLimit(result.limit ?? 25);
		setStatus({
			type: "idle",
			message: ""
		});
	}, []);
	(0, import_react.useEffect)(() => {
		loadAttendants().catch((error) => setStatus({
			type: "error",
			message: error instanceof Error ? error.message : "Erro ao carregar."
		}));
	}, [loadAttendants]);
	async function submit(event) {
		event.preventDefault();
		setStatus({
			type: "loading",
			message: "Criando acesso..."
		});
		try {
			const response = await fetch("/api/attendants", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name,
					email,
					employeeCode,
					password
				})
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar.");
			setName("");
			setEmail("");
			setEmployeeCode("");
			setPassword("");
			await loadAttendants();
			setStatus({
				type: "success",
				message: result.message || "Atendente cadastrado."
			});
		} catch (error) {
			setStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Não foi possível cadastrar."
			});
		}
	}
	async function deleteAttendant(attendant) {
		if (!window.confirm(`Excluir o cadastro de ${attendant.name}? O acesso será removido, mas os registros de produção serão preservados.`)) return;
		setDeletingEmail(attendant.email);
		setStatus({
			type: "loading",
			message: "Excluindo cadastro..."
		});
		try {
			const response = await fetch(`/api/attendants?email=${encodeURIComponent(attendant.email)}`, { method: "DELETE" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível excluir o cadastro.");
			await loadAttendants();
			setStatus({
				type: "success",
				message: result.message || "Cadastro excluído."
			});
		} catch (error) {
			setStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Não foi possível excluir o cadastro."
			});
		} finally {
			setDeletingEmail("");
		}
	}
	async function toggleAttendant(attendant) {
		const nextActive = !attendant.active;
		if (!window.confirm(`${nextActive ? "Reativar" : "Suspender"} o acesso de ${attendant.name}?`)) return;
		setUpdatingEmail(attendant.email);
		setStatus({
			type: "loading",
			message: nextActive ? "Reativando acesso..." : "Suspendendo acesso..."
		});
		try {
			const response = await fetch("/api/attendants", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email: attendant.email,
					active: nextActive
				})
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível alterar o acesso.");
			await loadAttendants();
			setStatus({
				type: "success",
				message: result.message || "Acesso atualizado."
			});
		} catch (error) {
			setStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Não foi possível alterar o acesso."
			});
		} finally {
			setUpdatingEmail("");
		}
	}
	const visibleAttendants = attendants.filter((attendant) => `${attendant.name} ${attendant.email} ${attendant.employeeCode}`.toLowerCase().includes(adminSearch.toLowerCase()));
	async function addMissingProduction(event) {
		event.preventDefault();
		setProductionStatus({
			type: "loading",
			message: "Salvando produção..."
		});
		try {
			const response = await fetch("/api/activities", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					userEmail: productionEmail,
					kind: productionKind,
					protocol: productionKind === "protocol" ? productionProtocol : "",
					outcome: productionOutcome,
					typologyId: productionTypologyId,
					distributionState: productionState,
					quantity: productionQuantity,
					date: productionDate,
					time: productionTime
				})
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Não foi possível lançar a produção.");
			setProductionProtocol("");
			await Promise.all([loadAttendants(), onChanged()]);
			setProductionStatus({
				type: "success",
				message: `Produção lançada para ${attendants.find((item) => item.email === productionEmail)?.name ?? productionEmail}.`
			});
		} catch (error) {
			setProductionStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Não foi possível lançar a produção."
			});
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack attendants-page",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "page-title",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "ADMINISTRAÇÃO DE ACESSOS"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Cadastro de atendentes" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						"Crie até ",
						limit,
						" acessos individuais. Somente e-mails Microsoft corporativos da Equatorial Serviços."
					] })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "permission-tag",
					children: [
						attendants.length,
						"/",
						limit,
						" cadastrados"
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "attendants-layout",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "panel attendants-form activity-form",
					onSubmit: submit,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "section-heading",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "NOVO ACESSO"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Adicionar atendente" })] })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Nome completo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: name,
								onChange: (event) => setName(event.target.value),
								minLength: 3,
								maxLength: 120,
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "E-mail corporativo Microsoft" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "email",
								value: email,
								onChange: (event) => setEmail(event.target.value.toLowerCase()),
								placeholder: "nome@equatorialservicos.com.br",
								pattern: ".+@equatorialservicos\\.com\\.br",
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Matrícula" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: employeeCode,
								onChange: (event) => setEmployeeCode(event.target.value),
								minLength: 2,
								maxLength: 40,
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Senha inicial" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									value: password,
									onChange: (event) => setPassword(event.target.value),
									minLength: 8,
									maxLength: 128,
									autoComplete: "new-password",
									required: true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "Use no mínimo 8 caracteres. Entregue a senha diretamente ao atendente." })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "primary-button",
							type: "submit",
							disabled: status.type === "loading" || attendants.length >= limit,
							children: attendants.length >= limit ? "Limite atingido" : status.type === "loading" ? "Salvando..." : "Cadastrar atendente"
						}),
						status.message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: `form-status ${status.type}`,
							children: status.message
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel attendants-list-panel",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "section-heading",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "EQUIPE CADASTRADA"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Gerenciar atendentes" })] })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "admin-search",
							value: adminSearch,
							onChange: (event) => setAdminSearch(event.target.value),
							placeholder: "Buscar por nome, e-mail ou matrícula"
						}),
						visibleAttendants.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "attendant-list",
							children: visibleAttendants.map((attendant) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								className: `attendant-card ${attendant.active ? "" : "inactive"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "avatar",
										children: attendant.name.charAt(0).toUpperCase()
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: attendant.name }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: attendant.email }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["Matrícula: ", attendant.employeeCode] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
											"Protocolos: ",
											attendant.protocols,
											" • Ligações: ",
											attendant.calls
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["Último registro: ", attendant.lastActivityAt ? activityDate(attendant.lastActivityAt) : "Nenhum"] })
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "attendant-access-actions",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: attendant.active ? "active-badge" : "inactive-badge",
												children: attendant.active ? "Ativo" : "Suspenso"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "secondary-button",
												disabled: updatingEmail === attendant.email,
												onClick: () => void toggleAttendant(attendant),
												children: updatingEmail === attendant.email ? "Atualizando..." : attendant.active ? "Suspender acesso" : "Reativar acesso"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "delete-attendant-button",
												disabled: deletingEmail === attendant.email,
												onClick: () => void deleteAttendant(attendant),
												children: deletingEmail === attendant.email ? "Excluindo..." : "Excluir cadastro"
											})
										]
									})
								]
							}, attendant.email))
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
							title: "Nenhum atendente encontrado",
							text: "Ajuste a busca ou cadastre um novo acesso."
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "panel admin-production-form activity-form",
				onSubmit: addMissingProduction,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "section-heading",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "CORREÇÃO ADMINISTRATIVA"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Lançar produção não registrada" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Use quando uma atividade do atendente não tiver sido adicionada no dia correto." })
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "permission-tag",
							children: "Somente Admin"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Atendente" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: productionEmail,
									onChange: (event) => setProductionEmail(event.target.value),
									required: true,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "Escolha o atendente"
									}), attendants.map((attendant) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: attendant.email,
										children: attendant.name
									}, attendant.email))]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: productionKind,
									onChange: (event) => setProductionKind(event.target.value),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "protocol",
										children: "Protocolo"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "call",
										children: "Ligação"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipologia" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: productionTypologyId,
									onChange: (event) => setProductionTypologyId(Number(event.target.value)),
									required: true,
									children: typologies.map((typology) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: typology.id,
										children: typology.name
									}, typology.id))
								})]
							})
						]
					}),
					productionKind === "protocol" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Número do protocolo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: productionProtocol,
								onChange: (event) => setProductionProtocol(event.target.value),
								required: true
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Parecer do protocolo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: productionOutcome,
								onChange: (event) => setProductionOutcome(event.target.value),
								required: true,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "deferred",
										children: "Deferido"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "analysis",
										children: "Em análise"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "denied",
										children: "Indeferido"
									})
								]
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Estado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: productionState,
									onChange: (event) => setProductionState(event.target.value),
									children: Object.entries(STATE_CONTACTS).map(([code, item]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: code,
										children: item.state
									}, code))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Quantidade" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "1",
									max: "9999",
									value: productionQuantity,
									onChange: (event) => setProductionQuantity(Number(event.target.value)),
									required: true
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Data da produção" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "date",
									value: productionDate,
									onChange: (event) => setProductionDate(event.target.value),
									required: true
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hora" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "time",
									value: productionTime,
									onChange: (event) => setProductionTime(event.target.value),
									required: true
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "primary-button",
						type: "submit",
						disabled: productionStatus.type === "loading",
						children: productionStatus.type === "loading" ? "Salvando..." : "Lançar para o atendente"
					}),
					productionStatus.message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `form-status ${productionStatus.type}`,
						children: productionStatus.message
					}) : null
				]
			})
		]
	});
}
var DENIAL_REASONS = [
	{
		id: "invalid-possession",
		category: "A) INFORMAÇÃO NO DOCUMENTO ANEXADO DIVERGENTE",
		text: "O documento de vínculo/posse com o imóvel não é válido."
	},
	{
		id: "expired-lease",
		category: "A) INFORMAÇÃO NO DOCUMENTO ANEXADO DIVERGENTE",
		text: "O contrato de locação não está vigente; a data do vínculo encerrou em {DATA}."
	},
	{
		id: "unsigned-document",
		category: "A) INFORMAÇÃO NO DOCUMENTO ANEXADO DIVERGENTE",
		text: "O documento não está assinado/datado."
	},
	{
		id: "invalid-account",
		category: "B) CONTA CONTRATO NÃO LOCALIZADA/INVÁLIDA",
		text: "A numeração informada como conta contrato não foi localizada em nosso sistema. Consulte a numeração exibida no canto direito da fatura de energia."
	},
	{
		id: "wrong-state",
		category: "B) CONTA CONTRATO NÃO LOCALIZADA/INVÁLIDA",
		text: "Identificamos que os documentos/dados apresentados pertencem a outro estado. Orientamos acessar novamente e selecionar o site da distribuidora de sua cidade."
	},
	{
		id: "third-party",
		category: "C) SERVIÇO NÃO SOLICITADO PELO TITULAR",
		text: "Para solicitar o serviço por terceiro, anexar contrato de administração ou procuração."
	},
	{
		id: "other-responsible",
		category: "C) SERVIÇO NÃO SOLICITADO PELO TITULAR",
		text: "O documento exibe dados de outro responsável. É necessário comprovar o vínculo ou atualizar o documento para o nome do solicitante."
	},
	{
		id: "missing-photo-id",
		category: "D) DOCUMENTOS INCOMPLETOS",
		text: "Faltou anexar documento oficial com foto (CNH, RG, Passaporte ou Carteira Profissional)."
	},
	{
		id: "illegible-document",
		category: "D) DOCUMENTOS INCOMPLETOS",
		text: "Documento com baixa visibilidade ou ilegível."
	},
	{
		id: "missing-pages",
		category: "D) DOCUMENTOS INCOMPLETOS",
		text: "Faltou anexar páginas do documento de vínculo/posse."
	},
	{
		id: "corrupted-file",
		category: "E) DOCUMENTAÇÃO ENVIADA EM FORMATO INCOMPATÍVEL",
		text: "O documento enviado é um arquivo corrompido."
	},
	{
		id: "old-rg",
		category: "E) DOCUMENTAÇÃO ENVIADA EM FORMATO INCOMPATÍVEL",
		text: "RG superior a 10 anos. Orientamos atualizar o documento, conforme o decreto aplicável."
	},
	{
		id: "applicant-debts",
		category: "F) DÉBITOS EM NOME DO SOLICITANTE",
		text: "Constam débitos em aberto vencidos vinculados ao CPF/CNPJ {CPF_CNPJ} do solicitante na conta contrato {CONTA_CONTRATO}."
	},
	{
		id: "other",
		category: "OUTROS",
		text: "OUTRO MOTIVO"
	}
];
var STATE_CONTACTS = {
	AL: {
		state: "Alagoas",
		whatsapp: "(82) 2126-9200",
		central: "0800 082 0196"
	},
	AP: {
		state: "Amapá",
		whatsapp: "(96) 3082-2949",
		central: "0800 096 0196"
	},
	GO: {
		state: "Goiás",
		whatsapp: "(62) 3243-2020",
		central: "0800 062 0196"
	},
	MA: {
		state: "Maranhão",
		whatsapp: "(98) 2055-0116",
		central: "116"
	},
	PA: {
		state: "Pará",
		whatsapp: "(91) 3217-8200",
		central: "0800 091 0196"
	},
	PI: {
		state: "Piauí",
		whatsapp: "(86) 3228-8200",
		central: "0800 086 0800"
	},
	RS: {
		state: "Rio Grande do Sul",
		whatsapp: "(51) 3382-5500",
		central: "0800 721 2333"
	}
};
function Scripts() {
	const [stateCode, setStateCode] = (0, import_react.useState)("PA");
	const [kind, setKind] = (0, import_react.useState)("immediate");
	const [siteCustomerName, setSiteCustomerName] = (0, import_react.useState)("");
	const [sapCustomerName, setSapCustomerName] = (0, import_react.useState)("");
	const [sapProtocol, setSapProtocol] = (0, import_react.useState)("");
	const [newContract, setNewContract] = (0, import_react.useState)("");
	const [siteProtocol, setSiteProtocol] = (0, import_react.useState)("");
	const [previousProtocol, setPreviousProtocol] = (0, import_react.useState)("");
	const [denialReason, setDenialReason] = (0, import_react.useState)(DENIAL_REASONS[0].id);
	const [otherDenialReason, setOtherDenialReason] = (0, import_react.useState)("");
	const [leaseEndDate, setLeaseEndDate] = (0, import_react.useState)("");
	const [debtorDocument, setDebtorDocument] = (0, import_react.useState)("");
	const [debtAccountContract, setDebtAccountContract] = (0, import_react.useState)("");
	const [consumptionLocation, setConsumptionLocation] = (0, import_react.useState)("");
	const [businessPartner, setBusinessPartner] = (0, import_react.useState)("");
	const [accountContract, setAccountContract] = (0, import_react.useState)("");
	const [contactPhone, setContactPhone] = (0, import_react.useState)("");
	const [documents, setDocuments] = (0, import_react.useState)("RG, CPF, DOCUMENTO DE POSSE");
	const [returnEmail, setReturnEmail] = (0, import_react.useState)("");
	const [consumptionClass, setConsumptionClass] = (0, import_react.useState)("RESIDENCIAL");
	const [copied, setCopied] = (0, import_react.useState)(null);
	const contact = STATE_CONTACTS[stateCode];
	const siteName = siteCustomerName.trim().toUpperCase() || "NOME COMPLETO DO CLIENTE";
	const sapName = sapCustomerName.trim().toUpperCase() || "NOME COMPLETO DO CLIENTE";
	const protocol = sapProtocol.trim() || "NÚMERO DO PROTOCOLO SAP";
	const denialReasonTemplate = DENIAL_REASONS.find((reason) => reason.id === denialReason)?.text || "OUTRO MOTIVO";
	const selectedDenialReason = denialReason === "other" ? otherDenialReason.trim() || "Informe o outro motivo do indeferimento." : denialReasonTemplate.replace("{DATA}", leaseEndDate ? (/* @__PURE__ */ new Date(`${leaseEndDate}T12:00:00`)).toLocaleDateString("pt-BR") : "INFORME A DATA").replace("{CPF_CNPJ}", debtorDocument.trim() || "INFORME O CPF/CNPJ").replace("{CONTA_CONTRATO}", debtAccountContract.trim() || "INFORME A CONTA CONTRATO");
	const consumptionLocationText = consumptionLocation.trim() || "LOCAL DE CONSUMO";
	const businessPartnerText = businessPartner.trim() || "PARCEIRO DE NEGÓCIO DO OUTRO CLIENTE";
	const sapTransferDetails = kind === "immediate" || kind === "analysis" ? `LOCAL DE CONSUMO: ${consumptionLocationText}\nPARCEIRO DE NEGÓCIO DO OUTRO CLIENTE: ${businessPartnerText}\n\n` : "";
	const footer = `Estamos à disposição para lhe atender: www.equatorialenergia.com.br, WhatsApp ${contact.whatsapp} e Central de Atendimento ${contact.central}.\n\nConte sempre com a nossa Energia!\n\nEquatorial Energia`;
	const result = {
		immediate: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade e já registramos em nosso sistema. Sua nova conta contrato ${newContract.trim() || "NOVA CONTA CONTRATO"} marca o início da sua jornada como cliente da Equatorial. O número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
		analysis: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade e já encaminhamos para análise. Se estiver tudo certo, o serviço será realizado em até 3 (três) dias úteis para área urbana ou 5 (cinco) dias úteis para área rural. Orientamos acompanhar o andamento pela Central de Atendimento, site ou agência mais próxima. O número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
		denied: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade, porém ainda não foi possível realizar o atendimento pelo seguinte motivo: ${selectedDenialReason}. Solicite um novo serviço assim que o motivo indicado estiver resolvido. Aguardamos seu retorno!\n\nO número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
		reactivation: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade e já encaminhamos para análise. Se estiver tudo certo, o serviço será realizado em até 3 (três) dias úteis para área urbana ou 5 (cinco) dias úteis para área rural, e a reativação será realizada em até 5 dias úteis. Orientamos acompanhar o andamento pela Central de Atendimento, site ou agência mais próxima. O número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
		repeat: `Olá, ${siteName}!\n\nA sua solicitação de Troca de Titularidade, registrada pelo protocolo do site ${siteProtocol.trim() || "PROTOCOLO DO SITE"}, não foi registrada porque identificamos que já consta uma solicitação pelo protocolo ${previousProtocol.trim() || "PROTOCOLO ANTERIOR"}, que se encontra em andamento. Esta solicitação será classificada como reincidente e será necessário aguardar sua conclusão e comunicação.\n\nO número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`
	}[kind];
	const sapRequest = `SOLICITAÇÃO VIA BACKOFFICE
Nº DO PROTOCOLO DO SITE: ${siteProtocol.trim() || "INFORME O PROTOCOLO DO SITE"}

PEDIDO DE TROCA DE TITULARIDADE PARA O CLIENTE: ${sapName}

CC/UC: ${accountContract.trim() || "INFORME A CC/UC"}

${sapTransferDetails}MOTIVO DA TROCA: XXXXXXXXXXXXXXX

TELEFONE DE CONTATO: ${contactPhone.trim() || "INFORME O TELEFONE DE CONTATO"}

DOCUMENTOS APRESENTADOS: ${documents.trim().toUpperCase() || "INFORME OS DOCUMENTOS APRESENTADOS"}.

OPÇÃO DE RETORNO CASO IMPROCEDENTE:
E-MAIL: ${returnEmail.trim() || "INFORME O E-MAIL"}
CLASSE DE CONSUMO: ${consumptionClass.trim().toUpperCase() || "INFORME A CLASSE DE CONSUMO"}

CLIENTE ESTÁ CIENTE QUE PRECISA ACOMPANHAR SUA SOLICITAÇÃO PELA CENTRAL DE ATENDIMENTO, SITE OU NAS AGÊNCIAS DE ATENDIMENTO. CIENTE DO PRAZO DE 3 DIAS (ÚTEIS ÁREA URBANA) / 5 DIAS (ÚTEIS ÁREA RURAL) PARA A CONCLUSÃO.
EM ANEXO DECLARAÇÃO DE TROCA DE TITULARIDADE REVISADA COM AS DOCUMENTAÇÕES APRESENTADAS.`;
	async function copyScript(text, target) {
		await navigator.clipboard.writeText(text);
		setCopied(target);
		window.setTimeout(() => setCopied(null), 2200);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack scripts-page",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "page-title",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "TEXTOS PADRONIZADOS"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Scripts de Troca de Titularidade" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Selecione o estado e o parecer. Os telefones corretos entram automaticamente." })
			] })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "scripts-layout",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel scripts-form-panel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row script-two-columns",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Estado do atendimento" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: stateCode,
								onChange: (event) => setStateCode(event.target.value),
								children: Object.entries(STATE_CONTACTS).map(([code, item]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: code,
									children: item.state
								}, code))
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tipo de parecer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: kind,
								onChange: (event) => setKind(event.target.value),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "immediate",
										children: "Deferido — troca imediata"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "analysis",
										children: "Deferido — encaminhado para análise"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "denied",
										children: "Indeferido"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "reactivation",
										children: "Análise com reativação"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "repeat",
										children: "Reincidente"
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Nome do cliente - script do site" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: siteCustomerName,
							onChange: (event) => setSiteCustomerName(event.target.value),
							placeholder: "Ex.: Antônio dos Santos Sousa"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Protocolo do SAP" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: sapProtocol,
							onChange: (event) => setSapProtocol(event.target.value),
							placeholder: "Ex.: 65986619"
						})]
					}),
					kind === "immediate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Nova conta contrato" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: newContract,
							onChange: (event) => setNewContract(event.target.value),
							placeholder: "Ex.: 3040387519"
						})]
					}) : null,
					kind === "denied" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Motivo do indeferimento" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: denialReason,
								onChange: (event) => setDenialReason(event.target.value),
								children: Array.from(new Set(DENIAL_REASONS.map((reason) => reason.category))).map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("optgroup", {
									label: category,
									children: DENIAL_REASONS.filter((reason) => reason.category === category).map((reason) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: reason.id,
										children: reason.text
									}, reason.id))
								}, category))
							})]
						}),
						denialReason === "expired-lease" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Data em que o vínculo encerrou" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "date",
								value: leaseEndDate,
								onChange: (event) => setLeaseEndDate(event.target.value)
							})]
						}) : null,
						denialReason === "applicant-debts" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "form-row script-two-columns",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "CPF/CNPJ com débito" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: debtorDocument,
									onChange: (event) => setDebtorDocument(event.target.value),
									placeholder: "Somente números"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Conta contrato com débito" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: debtAccountContract,
									onChange: (event) => setDebtAccountContract(event.target.value),
									placeholder: "Ex.: 3020866887"
								})]
							})]
						}) : null,
						denialReason === "other" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Detalhe o outro motivo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: otherDenialReason,
								onChange: (event) => setOtherDenialReason(event.target.value),
								placeholder: "Descreva o motivo do indeferimento",
								rows: 4
							})]
						}) : null
					] }) : null,
					kind === "repeat" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row script-two-columns",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Protocolo do site" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: siteProtocol,
								onChange: (event) => setSiteProtocol(event.target.value)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Protocolo anterior em andamento" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: previousProtocol,
								onChange: (event) => setPreviousProtocol(event.target.value)
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "section-heading script-sap-heading",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "TEXTO PARA O SAP"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Solicitação via Backoffice" })] })
					}),
					kind !== "repeat" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Protocolo do site" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: siteProtocol,
							onChange: (event) => setSiteProtocol(event.target.value),
							placeholder: "Ex.: 20260805000579351"
						})]
					}) : null,
					kind === "immediate" || kind === "analysis" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row script-two-columns",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Local de consumo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: consumptionLocation,
								onChange: (event) => setConsumptionLocation(event.target.value),
								placeholder: "Ex.: 80881568"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Parceiro de negócio do outro cliente" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: businessPartner,
								onChange: (event) => setBusinessPartner(event.target.value),
								placeholder: "Ex.: 66992238136"
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row script-two-columns",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Nome do cliente - texto do SAP" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: sapCustomerName,
								onChange: (event) => setSapCustomerName(event.target.value),
								placeholder: "Ex.: Antônio dos Santos Sousa"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "CC/UC" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: accountContract,
								onChange: (event) => setAccountContract(event.target.value)
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Telefone de contato" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "tel",
							value: contactPhone,
							onChange: (event) => setContactPhone(event.target.value),
							placeholder: "Ex.: (91) 99999-9999"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Documentos apresentados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: documents,
							onChange: (event) => setDocuments(event.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "form-row script-two-columns",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "E-mail para retorno" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "email",
								value: returnEmail,
								onChange: (event) => setReturnEmail(event.target.value)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Classe de consumo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: consumptionClass,
								onChange: (event) => setConsumptionClass(event.target.value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "RESIDENCIAL",
									children: "Residencial"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "EMPRESA",
									children: "Empresa"
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "state-contact-card",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["Contatos de ", contact.state] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["WhatsApp ", contact.whatsapp] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Central ", contact.central] })
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "panel script-preview-panel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "section-heading",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "PRONTO PARA USAR"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Prévia do script" })] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: result }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "primary-button copy-script-button",
						type: "button",
						onClick: () => void copyScript(result, "customer"),
						children: copied === "customer" ? "Script copiado!" : "Copiar mensagem do cliente"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "section-heading script-sap-heading",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "PRONTO PARA COLAR NO SAP"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Solicitação via Backoffice" })] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: sapRequest }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "primary-button copy-script-button",
						type: "button",
						onClick: () => void copyScript(sapRequest, "sap"),
						children: copied === "sap" ? "Texto do SAP copiado!" : "Copiar texto para o SAP"
					})
				]
			})]
		})]
	});
}
function reportRange(period, reference) {
	const [year, month, day] = reference.split("-").map(Number);
	const start = new Date(year, month - 1, day);
	const end = new Date(start);
	if (period === "weekly") {
		const weekday = (start.getDay() + 6) % 7;
		start.setDate(start.getDate() - weekday);
		end.setTime(start.getTime());
		end.setDate(end.getDate() + 6);
	} else if (period === "monthly") {
		start.setDate(1);
		end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
	}
	const iso = (value) => {
		const offset = value.getTimezoneOffset();
		return (/* @__PURE__ */ new Date(value.getTime() - offset * 6e4)).toISOString().slice(0, 10);
	};
	return {
		start: iso(start),
		end: iso(end)
	};
}
function ProductionReports({ data, isSupervisor }) {
	const [selectedEmail, setSelectedEmail] = (0, import_react.useState)("all");
	const [period, setPeriod] = (0, import_react.useState)("");
	const [referenceDate, setReferenceDate] = (0, import_react.useState)(todayInput());
	const [startDate, setStartDate] = (0, import_react.useState)(todayInput());
	const [endDate, setEndDate] = (0, import_react.useState)(todayInput());
	const periods = [
		{
			id: "daily",
			label: "Diário",
			description: "Produção do dia selecionado"
		},
		{
			id: "weekly",
			label: "Semanal",
			description: "De segunda-feira a domingo"
		},
		{
			id: "monthly",
			label: "Mensal",
			description: "Produção do mês selecionado"
		}
	];
	const selectedMember = data.team.find((member) => member.email === selectedEmail);
	const personLabel = isSupervisor ? selectedMember?.name ?? "Toda a equipe" : data.currentUser.name;
	const baseSource = (isSupervisor && selectedEmail !== "all" ? data.activities.filter((activity) => activity.userEmail === selectedEmail) : data.activities).filter((activity) => activity.kind === "protocol");
	const rangeFor = (nextPeriod) => nextPeriod === "custom" ? {
		start: startDate <= endDate ? startDate : endDate,
		end: startDate <= endDate ? endDate : startDate
	} : reportRange(nextPeriod, referenceDate);
	const filterPeriod = (nextPeriod) => {
		const range = rangeFor(nextPeriod);
		return baseSource.filter((activity) => {
			const date = activity.occurredAt.slice(0, 10);
			return date >= range.start && date <= range.end;
		});
	};
	const activePeriod = period || "daily";
	const source = filterPeriod(activePeriod);
	const range = rangeFor(activePeriod);
	const currentPeriod = periods.find((item) => item.id === activePeriod) ?? {
		id: "custom",
		label: "Personalizado",
		description: "Intervalo escolhido"
	};
	const dateText = range.start === range.end ? (/* @__PURE__ */ new Date(`${range.start}T12:00:00`)).toLocaleDateString("pt-BR") : `${(/* @__PURE__ */ new Date(`${range.start}T12:00:00`)).toLocaleDateString("pt-BR")} a ${(/* @__PURE__ */ new Date(`${range.end}T12:00:00`)).toLocaleDateString("pt-BR")}`;
	const protocolCount = source.reduce((sum, item) => sum + item.quantity, 0);
	const groupMap = /* @__PURE__ */ new Map();
	source.forEach((activity) => {
		const key = String(activity.typologyId);
		const existing = groupMap.get(key);
		groupMap.set(key, {
			name: `Protocolo — ${activity.typologyName}`,
			total: (existing?.total ?? 0) + activity.quantity
		});
	});
	const groups = [...groupMap.values()].sort((a, b) => b.total - a.total);
	const max = Math.max(1, ...groups.map((item) => item.total));
	const dailySummary = [...source.reduce((days, activity) => {
		const day = activity.occurredAt.slice(0, 10);
		const current = days.get(day) ?? {
			day,
			protocols: 0
		};
		current.protocols += activity.quantity;
		days.set(day, current);
		return days;
	}, /* @__PURE__ */ new Map()).values()].sort((a, b) => b.day.localeCompare(a.day));
	const optionsFor = (nextPeriod) => {
		const label = periods.find((item) => item.id === nextPeriod)?.label ?? "Personalizado";
		const exportRange = rangeFor(nextPeriod);
		const exportDates = exportRange.start === exportRange.end ? (/* @__PURE__ */ new Date(`${exportRange.start}T12:00:00`)).toLocaleDateString("pt-BR") : `${(/* @__PURE__ */ new Date(`${exportRange.start}T12:00:00`)).toLocaleDateString("pt-BR")} a ${(/* @__PURE__ */ new Date(`${exportRange.end}T12:00:00`)).toLocaleDateString("pt-BR")}`;
		return {
			title: `Relatório ${label.toLowerCase()} de protocolos`,
			subtitle: `${personLabel} • Período: ${exportDates}`,
			activities: filterPeriod(nextPeriod).filter((activity) => activity.kind === "protocol")
		};
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "page-title report-title",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "ANÁLISE DE PRODUÇÃO"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: isSupervisor ? "Relatórios por atendente" : "Meu relatório" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: isSupervisor ? "Consulte e exporte a produção diária, semanal e mensal de cada atendente." : "Consulte e exporte sua produção por período." })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "permission-tag readonly",
					children: "Somente leitura"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel report-filters",
				children: [
					isSupervisor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Atendente" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: selectedEmail,
						onChange: (event) => setSelectedEmail(event.target.value),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "Toda a equipe"
						}), data.team.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: member.email,
							children: member.name
						}, member.email))]
					})] }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Período exibido" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: period,
						onChange: (event) => setPeriod(event.target.value),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "Escolha Diário, Semanal ou Mensal"
							}),
							periods.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: item.id,
								children: item.label
							}, item.id)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "custom",
								children: "Personalizado"
							})
						]
					})] }),
					period === "custom" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "permission-tag",
						children: "Período personalizado"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "report-date-range",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Data inicial" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "date",
								value: startDate,
								onClick: (event) => event.currentTarget.showPicker?.(),
								onChange: (event) => {
									setStartDate(event.target.value);
									setReferenceDate(event.target.value);
									setPeriod("custom");
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Clique no campo para abrir o calendário." })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "report-date-range",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Data final" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "date",
								value: endDate,
								onClick: (event) => event.currentTarget.showPicker?.(),
								onChange: (event) => {
									setEndDate(event.target.value);
									setPeriod("custom");
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Clique no campo para abrir o calendário." })
						]
					})
				]
			}),
			period ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "report-period-grid single-period",
					children: periods.filter((item) => item.id === period).map((item) => {
						const protocols = filterPeriod(item.id).filter((activity) => activity.kind === "protocol").reduce((sum, activity) => sum + activity.quantity, 0);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: `panel report-period-card ${period === item.id ? "active" : ""}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: "period-select",
								type: "button",
								onClick: () => setPeriod(item.id),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "period-kind-counts",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["Protocolos: ", protocols] })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: item.description })
								]
							}), period === item.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "export-actions",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "export-button pdf",
									onClick: () => exportPdfReport(optionsFor(item.id)),
									children: "Baixar PDF"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "export-button excel",
									onClick: () => void exportExcelReport(optionsFor(item.id)),
									children: "Baixar Excel"
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "period-download-hint",
								children: "Selecione este período para baixar"
							})]
						}, item.id);
					})
				}),
				period === "custom" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel report-custom-download",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "PERÍODO PERSONALIZADO"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: dateText }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Baixe somente os protocolos encontrados entre as datas escolhidas." })
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "export-actions",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "export-button pdf",
							onClick: () => exportPdfReport(optionsFor("custom")),
							children: "Baixar PDF"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "export-button excel",
							onClick: () => void exportExcelReport(optionsFor("custom")),
							children: "Baixar Excel"
						})]
					})]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "report-range-note",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: personLabel }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						currentPeriod.label,
						": ",
						dateText
					] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "metric-grid report-metrics report-one-metric",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "metric-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "metric-icon blue",
							children: "P"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Quantidade de protocolos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: protocolCount })] })]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel report-days",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "section-heading",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "PROTOCOLOS POR DIA"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Dias incluídos no relatório" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Clique em um dia para filtrar somente os protocolos daquela data." })
						] })
					}), dailySummary.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "table-scroll",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Dia" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Protocolos" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Filtrar" })
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: dailySummary.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: (/* @__PURE__ */ new Date(`${item.day}T12:00:00`)).toLocaleDateString("pt-BR") }) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: item.protocols }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "export-button",
								onClick: () => {
									setStartDate(item.day);
									setEndDate(item.day);
									setReferenceDate(item.day);
									setPeriod("custom");
								},
								children: "Ver este dia"
							}) })
						] }, item.day)) })] })
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
						title: "Nenhum dia encontrado",
						text: "Escolha outro período para consultar."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel chart-panel",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "section-heading",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "DISTRIBUIÇÃO"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Quantidade por tipologia" })] })
					}), groups.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bar-chart",
						children: groups.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bar-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: item.total })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "bar-track",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${item.total / max * 100}%` } })
							})]
						}, item.name))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
						title: "Sem produção neste período",
						text: "Escolha outra data, período ou atendente para consultar."
					})]
				})
			] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "panel report-awaiting-selection",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					title: "Escolha o período do relatório",
					text: "Selecione Diário, Semanal, Mensal ou informe as datas inicial e final para visualizar e baixar os protocolos."
				})
			})
		]
	});
}
function Team({ data }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "page-stack",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "page-title",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "ACESSO DA SUPERVISÃO"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Desempenho da equipe" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Somente visualização: nenhum registro pode ser criado ou alterado aqui." })
			] })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TeamSummary, { data })]
	});
}
function TeamSummary({ data, compact = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: `panel team-panel ${compact ? "compact" : ""}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "section-heading",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "eyebrow",
				children: "EQUIPE"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Resultado por atendente" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "permission-tag readonly",
				children: "Somente leitura"
			})]
		}), data.team.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "table-scroll",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Atendente" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Protocolos" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Ligações" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Produtividade média" })
			] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: data.team.map((member) => {
				const score = attendantAverageProductivity(data, member.email);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: member.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: member.email })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: member.protocols }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: member.calls }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `score-pill ${score >= .9 ? "good" : "low"}`,
						children: formatPercent(score)
					}) })
				] }, member.email);
			}) })] })
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			title: "Nenhum atendente identificado",
			text: "Os atendentes aparecerão depois do primeiro acesso ao sistema."
		})]
	});
}
function EmptyState({ title, text }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "empty-state",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "○" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: title }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: text })
		]
	});
}
//#endregion
export { Dashboard as default };
