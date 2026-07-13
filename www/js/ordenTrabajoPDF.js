// ============================================================
//  ordenTrabajoPDF.js
//  Orden de trabajo con la misma base visual de presupuestos
// ============================================================

async function generarOrdenTrabajoPDF(orden) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210, H = 297;
  const ML = 14, MR = W - 14, ANCHO = MR - ML;
  const LEGAL_Y = H - 14;

  const ROJO_OSC = [185, 28, 28];  // #b91c1c
  const ROJO_MED = [192, 57, 43];
  const ROJO_LIG = [253, 235, 235];
  const GRIS_FILA = [245, 237, 237];
  const NEGRO = [26, 26, 26];
  const GRIS_SEP = [204, 204, 204];
  const GRIS_MED = [120, 120, 120];
  const GRIS_LEG = [85, 85, 85];
  const BLANCO = [255, 255, 255];

  const SECTION_HEADER_H = 8;
  const BODY_LINE_H = 4.8; // 9 pt * 1.5 aprox.
  const CELL_LINE_H = 4.8;
  const PAD_X = 4;
  const PAD_Y = 4;

  const emisor = orden.emisor || {};
  const cliente = orden.cliente || {};

  const setFill = rgb => doc.setFillColor(...rgb);
  const setStroke = rgb => doc.setDrawColor(...rgb);
  const setColor = rgb => doc.setTextColor(...rgb);
  const clean = value => String(value || '').trim();
  const setCharSpace = value => {
    if (typeof doc.setCharSpace === 'function') doc.setCharSpace(value);
  };

  function rect(x, y, w, h, fill) {
    setFill(fill);
    doc.setLineWidth(0);
    doc.setDrawColor(255, 255, 255);
    doc.rect(x, y, w, h, 'F');
  }

  function hline(x1, x2, y, w = 0.3, rgb = GRIS_SEP) {
    setStroke(rgb);
    doc.setLineWidth(w);
    doc.line(x1, y, x2, y);
  }

  function vline(x, y1, y2, w = 0.25, rgb = GRIS_SEP) {
    setStroke(rgb);
    doc.setLineWidth(w);
    doc.line(x, y1, x, y2);
  }

  function drawCabecera(numPag = 1) {
    let y = 16;
    rect(0, 0, W, 8, ROJO_OSC);

    setColor(ROJO_OSC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    setCharSpace(0);
    doc.text('ORDEN DE TRABAJO', W / 2, y + 6, { align: 'center' });

    const dotY = y + 8;
    setFill(ROJO_OSC);
    doc.setDrawColor(...ROJO_OSC);
    for (let dotX = ML; dotX <= MR; dotX += 2.2) {
      doc.circle(dotX, dotY, 0.55, 'F');
    }

    y += 16;
    const col2 = ML + ANCHO / 2;
    setColor(NEGRO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('FECHA:', ML, y);
    setColor(GRIS_MED);
    doc.setFont('helvetica', 'normal');
    doc.text(orden.fecha || '', ML + 18, y);

    setColor(NEGRO);
    doc.setFont('helvetica', 'bold');
    doc.text('N° ORDEN:', col2, y);
    setColor(GRIS_MED);
    doc.setFont('helvetica', 'normal');
    doc.text(orden.numero || orden.referencia || '', col2 + 28, y);

    y += 5;
    setColor(NEGRO);
    doc.setFont('helvetica', 'bold');
    doc.text('D.O.I:', ML, y);
    setColor(GRIS_MED);
    doc.setFont('helvetica', 'normal');
    doc.text(emisor.doi || '', ML + 18, y);

    if (numPag > 1) {
      setColor(GRIS_LEG);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Pág. ${numPag}`, MR, 12, { align: 'right' });
    }

    return y + 8;
  }

  function drawBloques(y0) {
    let y = y0;
    const mitad = ML + ANCHO / 2;
    const paso = 4.8;
    rect(ML, y - 2, ANCHO / 2 - 2, 5 + 4 * paso, ROJO_LIG);
    rect(mitad, y - 2, ANCHO / 2 - 2, 5 + 4 * paso, [245, 245, 245]);

    setColor(ROJO_OSC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('EMISOR', ML + 3, y + 2);
    doc.text('CLIENTE', mitad + 3, y + 2);
    y += 6;

    const eCampos = [
      emisor.nombre || '',
      emisor.direccion || '',
      emisor.cp_ciudad || '',
      `D.O.I: ${emisor.doi || ''}`,
    ];
    const cCampos = [
      cliente.nombre || '',
      cliente.direccion || '',
      cliente.cp_ciudad || '',
      `N.I.F.: ${cliente.nif || ''}`,
    ];

    setCharSpace(0.3);
    for (let i = 0; i < eCampos.length; i++) {
      const fy = y + i * paso;
      const bold = i === 0;
      setColor(NEGRO);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 8.5 : 8);
      doc.text(eCampos[i], ML + 3, fy);
      doc.text(cCampos[i], mitad + 3, fy);
    }
    setCharSpace(0);

    return y + (eCampos.length - 1) * paso + 8;
  }

  function drawLegal() {
    const texto =
      'Este documento constituye una orden de trabajo técnica. Los datos personales se tratarán únicamente para la gestión administrativa, ejecución del servicio y contacto relacionado.';
    setColor(GRIS_LEG);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const lineas = doc.splitTextToSize(texto, ANCHO);
    hline(ML, MR, LEGAL_Y - 3, 0.3, GRIS_SEP);
    for (let i = 0; i < Math.min(lineas.length, 3); i++) {
      doc.text(lineas[i], W / 2, LEGAL_Y + i * 3.8, { align: 'center' });
    }
  }

  function ensurePage(y, needed) {
    if (y + needed <= LEGAL_Y - 8) return y;
    doc.addPage();
    return drawCabecera(doc.internal.getNumberOfPages()) + 4;
  }

  function drawTextSection(title, text, y) {
    const value = clean(text) || '—';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(value, ANCHO - PAD_X * 2);
    const bodyH = Math.max(14, PAD_Y * 2 + lines.length * BODY_LINE_H);
    const totalH = SECTION_HEADER_H + bodyH + 4;

    y = ensurePage(y, totalH);
    rect(ML, y, ANCHO, SECTION_HEADER_H, ROJO_LIG);
    setColor(ROJO_OSC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setCharSpace(0.3);
    doc.text(title.toUpperCase(), ML + PAD_X, y + 5.6);
    setCharSpace(0);
    y += SECTION_HEADER_H;

    rect(ML, y, ANCHO, bodyH, BLANCO);
    setStroke(GRIS_SEP);
    doc.setLineWidth(0.25);
    doc.rect(ML, y, ANCHO, bodyH);

    setColor(NEGRO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setCharSpace(0.3);
    lines.forEach((line, idx) => {
      doc.text(line, ML + PAD_X, y + PAD_Y + 3 + idx * BODY_LINE_H);
    });
    setCharSpace(0);

    return y + bodyH + 4;
  }

  function drawWorkTable(puntos, y) {
    const colPunto = 28;
    const xDesc = ML + colPunto;
    const rows = (Array.isArray(puntos) && puntos.length)
      ? puntos.map((p, idx) => ({
          numero: clean(p.numero) || String(idx + 1),
          descripcion: clean(p.descripcion) || '—',
        }))
      : [{ numero: '—', descripcion: 'Sin intervenciones registradas' }];

    while (rows.length < 3) rows.push({ numero: '', descripcion: '' });

    y = ensurePage(y, 19);
    rect(ML, y, ANCHO, 6, ROJO_MED);
    setColor(BLANCO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DESCRIPCIÓN DE LOS TRABAJOS', ML + 2.5, y + 4.1);
    y += 6;

    rect(ML, y, ANCHO, 7, ROJO_OSC);
    setColor(BLANCO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Punto', ML + colPunto / 2, y + 4.7, { align: 'center' });
    doc.text('Descripción de los trabajos', xDesc + (ANCHO - colPunto) / 2, y + 4.7, { align: 'center' });
    vline(xDesc, y, y + 7, 0.3, BLANCO);
    y += 7;

    rows.forEach((row, idx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const descLines = row.descripcion
        ? doc.splitTextToSize(row.descripcion, ANCHO - colPunto - PAD_X * 2)
        : [''];
      const rowH = Math.max(14, PAD_Y * 2 + descLines.length * CELL_LINE_H);

      y = ensurePage(y, rowH + 1);
      rect(ML, y, ANCHO, rowH, idx % 2 === 1 ? GRIS_FILA : BLANCO);
      vline(xDesc, y, y + rowH, 0.25, GRIS_SEP);
      hline(ML, MR, y + rowH, 0.25, GRIS_SEP);

      setColor(ROJO_OSC);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setCharSpace(0.3);
      if (row.numero) doc.text(row.numero, ML + colPunto / 2, y + rowH / 2 + 1.6, { align: 'center' });

      setColor(NEGRO);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      descLines.forEach((line, lineIdx) => {
        doc.text(line, xDesc + PAD_X, y + PAD_Y + 3 + lineIdx * CELL_LINE_H);
      });
      setCharSpace(0);

      y += rowH;
    });

    hline(ML, MR, y, 0.8, ROJO_OSC);
    return y + 4;
  }

  let y = drawCabecera(1);
  y = drawBloques(y);
  y = drawTextSection('Trabajo a realizar', orden.trabajoRealizar, y);
  y = drawWorkTable(orden.puntos || [], y);
  y = drawTextSection('Recomendaciones Técnicas', orden.recomendaciones, y);

  if (clean(orden.observacionesPrev)) y = drawTextSection('Observaciones previas', orden.observacionesPrev, y);
  if (clean(orden.otrosPrev)) y = drawTextSection('Otros', orden.otrosPrev, y);
  if (clean(orden.notasSeg)) y = drawTextSection('Notas y observaciones de seguridad', orden.notasSeg, y);
  if (clean(orden.observacionesPost)) y = drawTextSection('Observaciones finales', orden.observacionesPost, y);
  if (clean(orden.otrosPost)) y = drawTextSection('Otros (finalización)', orden.otrosPost, y);

  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    drawLegal();
    if (totalPages > 1) {
      setColor(GRIS_LEG);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Pág. ${page}/${totalPages}`, MR, 12, { align: 'right' });
    }
  }

  const ref = (orden.numero || orden.referencia || orden.fecha || 'orden').replace(/[/\\:*?"<>|]/g, '-');
  const nombre = `Orden_Trabajo_${ref}.pdf`;
  const dataUri = doc.output('datauristring');
  const base64Data = dataUri.split(',')[1];
  const blob = doc.output('blob');
  return { blob, base64Data, nombre };
}
