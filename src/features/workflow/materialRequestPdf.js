import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../../services/api";

const BRAND_LOGO_URL = "/api/v1/brand/logo";

const NAVY = [14, 42, 68];
const TEAL = [4, 167, 147];
const SLATE = [100, 116, 139];
const INK = [30, 41, 59];
const LINE = [226, 232, 240];
const PAPER = [248, 250, 252];

function priorityLabel(priority) {
  if (priority === "P1") return "P1 — Urgent";
  if (priority === "P2") return "P2 — High";
  return "P3 — Normal";
}

async function loadBrandLogo() {
  try {
    const response = await fetch(BRAND_LOGO_URL);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadSignatures(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  try {
    const data = await api.get(`/users/signatures?ids=${encodeURIComponent(unique.join(","))}`);
    return data.signatures || {};
  } catch {
    return {};
  }
}

async function loadLetterhead() {
  try {
    const data = await api.get("/company/letterhead");
    return data.letterhead || {};
  } catch {
    return {};
  }
}

function logoFormat(dataUrl) {
  if (String(dataUrl).startsWith("data:image/jpeg")) return "JPEG";
  if (String(dataUrl).startsWith("data:image/png")) return "PNG";
  return "PNG";
}

function contactLines(letterhead) {
  const lines = [];
  String(letterhead.address || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => lines.push(line));
  if (letterhead.poBox) lines.push(`P.O. Box ${letterhead.poBox}`);
  if (letterhead.phone) lines.push(`Phone : ${letterhead.phone}`);
  if (letterhead.mobile) lines.push(`Mobile : ${letterhead.mobile}`);
  if (letterhead.fax) lines.push(`Fax : ${letterhead.fax}`);
  if (letterhead.email) lines.push(`E-mail : ${letterhead.email}`);
  if (letterhead.website) lines.push(letterhead.website);
  if (letterhead.crNumber) lines.push(`C.R. : ${letterhead.crNumber}`);
  if (letterhead.vatNumber) lines.push(`VAT : ${letterhead.vatNumber}`);
  return lines.slice(0, 8);
}

function statusColor(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("reject") || value.includes("discrep")) return [185, 28, 28];
  if (value.includes("approv") || value.includes("closed") || value.includes("paid")) return [4, 120, 87];
  if (value.includes("draft") || value.includes("return")) return [71, 85, 105];
  return TEAL;
}

function drawHeader(doc, logo, letterhead) {
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 210, 3.2, "F");
  doc.setFillColor(...NAVY);
  doc.rect(0, 3.2, 210, 1.1, "F");

  if (logo) {
    try {
      doc.addImage(logo, logoFormat(logo), 14, 9, 52, 16);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...NAVY);
      doc.text(letterhead.companyName || "SERVHUB", 14, 20);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text(letterhead.companyName || "SERVHUB", 14, 20);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  contactLines(letterhead).forEach((line, index) => {
    doc.text(line, 196, 10 + index * 3.3, { align: "right" });
  });

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(14, 30, 196, 30);
}

function fieldPair(doc, x, y, w, label, value) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  const text = doc.splitTextToSize(String(value || "—"), w - 28);
  doc.text(text[0] || "—", x + 24, y);
  doc.setDrawColor(...LINE);
  doc.line(x + 24, y + 1.2, x + w - 4, y + 1.2);
}

function drawChoice(doc, x, y, label) {
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y - 3.1, 3.2, 3.2, 0.4, 0.4, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(label, x + 4.4, y);
}

const BEFORE_APPROVAL = new Set(["Draft", "Requested", "Returned", "Rejected"]);

function managerHasApproved(status) {
  return Boolean(status) && !BEFORE_APPROVAL.has(status);
}

function drawSignCard(doc, x, y, w, title, rows) {
  doc.setFillColor(...NAVY);
  doc.roundedRect(x, y, w, 7, 1.4, 1.4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(title, x + 3, y + 4.6);
  let rowY = y + 13;
  rows.forEach((row) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(row.label, x + 3, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    if (row.image) {
      try {
        doc.addImage(row.image, logoFormat(row.image), x + 24, rowY - 8, 34, 10);
      } catch {
        // A bad image leaves the signature line blank.
      }
    } else if (row.value) {
      doc.text(String(row.value), x + 24, rowY);
    }
    doc.setDrawColor(...LINE);
    doc.line(x + 24, rowY + 1.6, x + w - 4, rowY + 1.6);
    rowY += row.image ? 14 : 7;
  });
  return rowY;
}

function drawRequest(doc, record, departmentName, logo, letterhead, signatures = {}) {
  drawHeader(doc, logo, letterhead);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEAL);
  doc.text("MATERIAL REQUEST FORM", 14, 38);

  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text(String(record.id || record.mrNo || "Material request"), 14, 45);

  const status = String(record.status || "—");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const badgeWidth = Math.max(36, doc.getTextWidth(status) + 12);
  const badgeX = 196 - badgeWidth;
  doc.setFillColor(...statusColor(status));
  doc.roundedRect(badgeX, 36, badgeWidth, 8, 1.4, 1.4, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(status, badgeX + badgeWidth / 2, 41.2, { align: "center" });

  doc.setFillColor(...PAPER);
  doc.setDrawColor(...LINE);
  doc.roundedRect(14, 50, 182, 28, 2, 2, "FD");
  fieldPair(doc, 18, 57, 88, "Department", departmentName || record.department);
  fieldPair(doc, 108, 57, 84, "Date", record.date);
  fieldPair(doc, 18, 64, 88, "Location", record.location);
  fieldPair(doc, 108, 64, 84, "Project", record.project);
  fieldPair(doc, 18, 71, 88, "Region", record.region);
  fieldPair(doc, 108, 71, 84, "City", record.city);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(`Priority  ${priorityLabel(record.priority)}`, 14, 84);
  let tableTop = 87;
  if (record.justification) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const note = doc.splitTextToSize(String(record.justification), 182).slice(0, 2);
    doc.text(note, 14, 89);
    tableTop = 89 + note.length * 4;
  }

  const products = Array.isArray(record.products) ? record.products : [];
  const body = products.map((item, index) => [
    String(index + 1),
    item.name || "—",
    item.description || "—",
    item.unit || "—",
    String(item.quantity || "—"),
  ]);
  body.push(["", "", "----------------- nothing to follow -----------------", "", ""]);

  autoTable(doc, {
    startY: tableTop,
    margin: { left: 14, right: 14 },
    head: [["SI.", "Item", "Description", "Unit", "Quantity"]],
    body,
    styles: { fontSize: 8, textColor: INK, cellPadding: 2.2, lineColor: LINE, lineWidth: 0.1, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", cellPadding: 2.6 },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { cellWidth: 36 },
      3: { halign: "center", cellWidth: 22 },
      4: { halign: "center", cellWidth: 24 },
    },
  });

  let cursor = doc.lastAutoTable.finalY + 8;
  const room = (needed) => {
    if (cursor + needed <= 278) return;
    doc.addPage();
    drawHeader(doc, logo, letterhead);
    cursor = 40;
  };
  room(42);

  const cardW = 88;
  const creatorSignature = signatures[record.createdById] || "";
  const managerSignature = managerHasApproved(record.status) ? signatures[record.assignedToId] || "" : "";
  const initiatedEnd = drawSignCard(doc, 14, cursor, cardW, "Initiated by", [
    { label: "Name", value: record.createdBy },
    { label: "Date", value: record.date },
    { label: "Signature", image: creatorSignature },
  ]);
  const directorEnd = drawSignCard(doc, 108, cursor, cardW, "Management director approval", [
    { label: "Name", value: record.assignedTo },
    { label: "Date", value: "" },
    { label: "Signature", image: managerSignature },
  ]);
  cursor = Math.max(initiatedEnd, directorEnd) + 6;
  room(34);

  doc.setFillColor(...NAVY);
  doc.roundedRect(14, cursor, 182, 7, 1.4, 1.4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("Financial statement", 17, cursor + 4.6);
  drawChoice(doc, 18, cursor + 14, "Within budget");
  drawChoice(doc, 70, cursor + 14, "Out of budget");
  fieldPair(doc, 18, cursor + 22, 80, "Date", "");
  fieldPair(doc, 108, cursor + 22, 84, "Specialist", "");
  cursor += 32;
  room(36);

  doc.setFillColor(...NAVY);
  doc.roundedRect(14, cursor, 182, 7, 1.4, 1.4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Stock availability", 17, cursor + 4.6);
  drawChoice(doc, 18, cursor + 14, "Available");
  drawChoice(doc, 70, cursor + 14, "Not available");
  fieldPair(doc, 18, cursor + 22, 80, "Date", "");
  fieldPair(doc, 108, cursor + 22, 84, "Name", "");
  cursor += 34;
  room(30);

  drawSignCard(doc, 14, cursor, cardW, "CEO approval", [
    { label: "Date", value: "" },
    { label: "Signature", value: "" },
  ]);
  drawSignCard(doc, 108, cursor, cardW, "GCFO approval", [
    { label: "Date", value: "" },
    { label: "Signature", value: "" },
  ]);
}

export async function downloadMaterialRequestPdf(input) {
  const items = (Array.isArray(input) ? input : [input]).filter(Boolean);
  if (!items.length) return;

  const preview = window.open("", "_blank");
  try {
    const letterhead = await loadLetterhead();
    const logo = letterhead.logoData || (await loadBrandLogo());
    const records = items.map((item) => item.record || item);
    const signatures = await loadSignatures(records.flatMap((record) => [record.createdById, record.assignedToId]));
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    items.forEach((item, index) => {
      if (index > 0) doc.addPage();
      const record = item.record || item;
      const departmentName = item.departmentName || record.department || "";
      drawRequest(doc, record, departmentName, logo, letterhead, signatures);
    });

    const pageCount = doc.getNumberOfPages();
    const footerName = letterhead.companyName || "ServHub";
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(0.4);
      doc.line(14, 284, 196, 284);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE);
      doc.text(footerName, 14, 289);
      doc.text(`Page ${page} of ${pageCount}`, 196, 289, { align: "right" });
    }

    const first = items[0].record || items[0];
    const filename = items.length === 1 ? `${first.id || first.mrNo || "material-request"}.pdf` : "material-requests.pdf";
    const file = new File([doc.output("blob")], filename, { type: "application/pdf" });
    const url = URL.createObjectURL(file);
    const target = preview && !preview.closed ? preview : window.open("", "_blank");
    if (target) target.location.href = url;
  } catch (error) {
    if (preview && !preview.closed) preview.close();
    throw error;
  }
}
