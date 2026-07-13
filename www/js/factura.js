// ============================================================
//  factura.js — Generación de PDF con jsPDF
//  CORREGIDO: descripciones largas hacen salto de línea
// ============================================================

function generarFacturaPDF(datos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const DOCUMENTO_TITULO = datos.documento_titulo || 'FACTURA';
  const NUMERO_LABEL = datos.numero_label || 'N° FACTURA:';

  const W = 210, H = 297;
  const ML = 14, MR = W - 14, ANCHO = MR - ML;

  const ROJO_OSC  = [139,   0,   0];
  const ROJO_MED  = [192,  57,  43];
  const ROJO_LIG  = [253, 235, 235];
  const GRIS_FILA = [245, 237, 237];
  const NEGRO     = [ 26,  26,  26];
  const GRIS_SEP  = [204, 204, 204];
  const GRIS_MED  = [120, 120, 120];
  const GRIS_LEG  = [ 85,  85,  85];
  const BLANCO    = [255, 255, 255];

  const setFill   = (rgb) => doc.setFillColor(...rgb);
  const setStroke = (rgb) => doc.setDrawColor(...rgb);
  const setColor  = (rgb) => doc.setTextColor(...rgb);

  // ── Layout tabla ─────────────────────────────────────────────
  const COL_CANT = 16, COL_PREC = 24, COL_IMP = 26;
  const COL_DESC = ANCHO - COL_CANT - COL_PREC - COL_IMP;
  const X_CANT = ML;
  const X_DESC = X_CANT + COL_CANT;
  const X_PREC = X_DESC + COL_DESC;
  const X_IMP  = X_PREC + COL_PREC;

  const HDR_H  = 6.5;
  const FILA_H_BASE = 5.8;
  const LINE_H = 3.3;
  const N_MIN  = 6;
  const TOT_H  = 6;
  const LEGAL_Y = H - 14;

  function hline(x1, x2, y, w = 0.3, rgb = GRIS_SEP) {
    setStroke(rgb); doc.setLineWidth(w); doc.line(x1, y, x2, y);
  }
  function vline(x, y1, y2, w = 0.25, rgb = GRIS_SEP) {
    setStroke(rgb); doc.setLineWidth(w); doc.line(x, y1, x, y2);
  }
  function rect(x, y, w, h, fill) {
    setFill(fill);
    doc.setLineWidth(0);
    doc.setDrawColor(255, 255, 255);
    doc.rect(x, y, w, h, 'F');
  }
  function fmt(n) {
    return Number(n).toFixed(2).replace('.', ',') + ' €';
  }

  function drawCabecera(datos, emisor, numPag, totalPag) {
    let y = 16;
    rect(0, 0, W, 8, ROJO_OSC);
    setColor(ROJO_OSC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);

    if (emisor.logo) {
      try {
        doc.addImage(emisor.logo, 'PNG', ML, 3, 22, 22);
        doc.text(DOCUMENTO_TITULO, W / 2, y + 6, { align: 'center' });
      } catch(e) {
        doc.text(DOCUMENTO_TITULO, W / 2, y + 6, { align: 'center' });
      }
    } else {
      doc.text(DOCUMENTO_TITULO, W / 2, y + 6, { align: 'center' });
    }

    // CAMBIO 4: Línea de puntos rojos en lugar de línea sólida
    const dotY    = y + 8;
    const dotGap  = 2.2;   // espacio entre puntos (centro a centro)
    const dotR    = 0.55;  // radio de cada punto
    setFill(ROJO_OSC);
    doc.setDrawColor(...ROJO_OSC);
    let dotX = ML;
    while (dotX <= MR) {
      doc.circle(dotX, dotY, dotR, 'F');
      dotX += dotGap;
    }
    y += 16;
    setColor(NEGRO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const col2 = ML + ANCHO / 2;
    doc.text('FECHA:', ML, y);
    setColor(GRIS_MED);
    doc.setFont('helvetica', 'normal');
    doc.text(datos.fecha || '', ML + 18, y);
    setColor(NEGRO);
    doc.setFont('helvetica', 'bold');
    doc.text(NUMERO_LABEL, col2, y);
    setColor(GRIS_MED);
    doc.setFont('helvetica', 'normal');
    doc.text(datos.num_factura || '', col2 + 28, y);
    y += 5;
    setColor(NEGRO);
    doc.setFont('helvetica', 'bold');
    doc.text('D.O.I:', ML, y);
    setColor(GRIS_MED);
    doc.setFont('helvetica', 'normal');
    doc.text(emisor.doi || '', ML + 18, y);
    y += 8;
    if (numPag > 1) {
      setColor(GRIS_LEG);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Pág. ${numPag}/${totalPag}`, MR, 12, { align: 'right' });
    }
    return y;
  }

  function drawBloques(datos, emisor, y0) {
    let y = y0;
    const mitad = ML + ANCHO / 2;
    const PASO  = 4.8;
    rect(ML,    y - 2, ANCHO / 2 - 2, 5 + 4 * PASO, ROJO_LIG);
    rect(mitad, y - 2, ANCHO / 2 - 2, 5 + 4 * PASO, [245, 245, 245]);
    setColor(ROJO_OSC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('EMISOR',  ML + 3, y + 2);
    doc.text('CLIENTE', mitad + 3, y + 2);
    y += 6;
    const eCampos = [
      emisor.nombre     || '',
      emisor.direccion  || '',
      emisor.cp_ciudad  || '',
      `D.O.I: ${emisor.doi || ''}`,
    ];
    const cCampos = [
      datos.nombre_cliente    || '',
      datos.dir_cliente       || '',
      datos.cp_ciudad_cliente || '',
      `N.I.F.: ${datos.nif_cliente || ''}`,
    ];
    for (let i = 0; i < eCampos.length; i++) {
      const fy = y + i * PASO;
      const bold = i === 0;
      setColor(NEGRO);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 8.5 : 8);
      doc.text(eCampos[i], ML + 3, fy);
      doc.text(cCampos[i], mitad + 3, fy);
    }
    return y + (eCampos.length - 1) * PASO + 8;
  }

  // CORRECCIÓN: calcula líneas y altura considerando fontSize dinámico
  function calcularLineasDescripcion(texto, maxWidth, fontSizeBase) {
    let fs = fontSizeBase;
    let lineas = [];
    while (fs >= 6) {
      doc.setFontSize(fs);
      lineas = doc.splitTextToSize(texto || '', maxWidth);
      // Si alguna línea sigue siendo muy larga (truncada), reducir fontSize
      const algunaTruncada = lineas.some(l => doc.getTextWidth(l) > maxWidth + 1);
      if (!algunaTruncada) break;
      fs -= 0.5;
    }
    return { lineas, fontSize: fs };
  }

  function calcularAlturaFila(item) {
    if (!item || !item.descripcion) return FILA_H_BASE;
    const maxW = COL_DESC - 5;
    const res = calcularLineasDescripcion(item.descripcion, maxW, 8);
    const lineasNecesarias = res.lineas.length;
    return Math.max(FILA_H_BASE, 2.2 + lineasNecesarias * LINE_H);
  }

  function drawTabla(items, y0, label = null) {
    let y = y0;

    if (label) {
      rect(ML, y, ANCHO, 5.5, ROJO_MED);
      setColor(BLANCO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(label, ML + 2, y + 3.8);
      y += 5.5;
    }

    // Cabecera
    rect(ML, y, ANCHO, HDR_H, ROJO_OSC);
    setColor(BLANCO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Cant.',       X_CANT + COL_CANT / 2, y + 4.2, { align: 'center' });
    doc.text('Descripción', X_DESC + COL_DESC / 2, y + 4.2, { align: 'center' });
    doc.text('P. Unit.',    X_PREC + COL_PREC / 2, y + 4.2, { align: 'center' });
    doc.text('Importe',     X_IMP  + COL_IMP  / 2, y + 4.2, { align: 'center' });
    for (const x of [X_DESC, X_PREC, X_IMP]) {
      vline(x, y, y + HDR_H, 0.3, BLANCO);
    }
    y += HDR_H;

    const alturas = [];
    for (let i = 0; i < items.length; i++) {
      alturas.push(calcularAlturaFila(items[i]));
    }

    const nFilas = Math.max(items.length, N_MIN);
    for (let i = 0; i < nFilas; i++) {
      const filaH = i < items.length ? alturas[i] : FILA_H_BASE;
      const fondo = i % 2 === 1 ? GRIS_FILA : BLANCO;
      rect(ML, y, ANCHO, filaH, fondo);
      for (const x of [X_DESC, X_PREC, X_IMP]) {
        vline(x, y, y + filaH, 0.25, GRIS_SEP);
      }
      hline(ML, MR, y + filaH, 0.25);

      if (i < items.length) {
        const item = items[i];
        setColor(NEGRO);
        doc.setFont('helvetica', 'normal');

        var c = Number(item.cantidad) || 0;
        const cant = c % 1 === 0 ? String(Math.round(c)) : c.toFixed(2);
        doc.setFontSize(8);
        doc.text(cant, X_CANT + COL_CANT / 2, y + filaH * 0.55, { align: 'center' });

        // CORRECCIÓN PRINCIPAL: dibujar TODAS las líneas de la descripción centradas verticalmente
        const maxW = COL_DESC - 5;
        const res = calcularLineasDescripcion(item.descripcion, maxW, 8);
        doc.setFontSize(res.fontSize);

        const totalTextH = res.lineas.length * LINE_H;
        const startY = y + (filaH - totalTextH) / 2 + LINE_H * 0.75;

        res.lineas.forEach((linea, idx) => {
          const lineY = startY + idx * LINE_H;
          if (lineY < y + filaH - 0.5) {
            doc.text(linea, X_DESC + 2.5, lineY);
          }
        });

        doc.setFontSize(8);
        doc.text(
          Number(item.precio_unitario).toFixed(2),
          X_PREC + COL_PREC / 2, y + filaH * 0.55, { align: 'center' }
        );
        doc.text(
          Number(item.subtotal_linea).toFixed(2),
          X_IMP + COL_IMP / 2, y + filaH * 0.55, { align: 'center' }
        );
      }
      y += filaH;
    }

    hline(ML, MR, y, 0.8, ROJO_OSC);
    return y;
  }

  function drawTotales(datos, y0) {
    let y = y0 + 2;
    const x0 = X_PREC, xV = X_IMP, xR = MR;
    const wE  = xV - x0, wV = xR - xV;

    function fila(etq, val, opts = {}) {
      const {
        bgE = BLANCO, bgV = BLANCO,
        boldE = false, boldV = false,
        colorE = NEGRO, colorV = NEGRO,
        fs = 8.5, h = TOT_H,
      } = opts;
      rect(x0, y, wE, h, bgE);
      rect(xV, y, wV, h, bgV);
      vline(xV, y, y + h, 0.25, GRIS_SEP);
      hline(x0, xR, y + h, 0.25);
      const bl = y + h * 0.68;
      if (etq) {
        setColor(colorE);
        doc.setFont('helvetica', boldE ? 'bold' : 'normal');
        doc.setFontSize(fs);
        doc.text(etq, xV - 2, bl, { align: 'right' });
      }
      if (val !== undefined && val !== '') {
        setColor(colorV);
        doc.setFont('helvetica', boldV ? 'bold' : 'normal');
        doc.setFontSize(fs);
        doc.text(String(val), xR - 2, bl, { align: 'right' });
      }
      y += h;
    }

    const retencion = datos.retencion || { rate: 0, enabled: false, showInPdf: false, applyToTotal: false };
    const retImp    = Number(datos.retencion_importe) || 0;

    fila('Subtotal',               fmt(datos.subtotal));
    fila(`IVA BI (${datos.iva}%)`, fmt(datos.iva_importe));

    if (retencion.showInPdf) {
      const etqRet = textoRetencionPDF(retencion);
      const valRet = retencion.applyToTotal
        ? `-${fmt(retImp)}`
        : '';
      fila(etqRet, valRet, { colorE: NEGRO, colorV: NEGRO });
    }

    fila('', '');

    const totalH = TOT_H + 2;
    rect(x0, y, wE + wV, totalH, ROJO_OSC);
    const bl = y + totalH * 0.66;
    setColor(BLANCO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', xV - 2, bl, { align: 'right' });
    doc.setFontSize(11);
    doc.text(fmt(datos.total), xR - 2, bl, { align: 'right' });
    y += totalH;

    return y;
  }

  function drawIban(datos, y) {
    setColor(NEGRO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const pre  = 'N° CUENTA BANCARIA:  ';
    const preW = doc.getTextWidth(pre);
    doc.text(pre, ML, y);
    doc.setFont('helvetica', 'bold');
    doc.text(datos.cuenta_bancaria || '', ML + preW, y);
  }

  function drawLegal() {
    const texto =
      'Sus datos personales expuestos en este documento y facilitados por Ud. sólo serán ' +
      'utilizados para el control administrativo, facturación y contacto promocional, ' +
      'estando debidamente protegidos y registrados. Podrá corregir, anular, acceder o ' +
      'cancelarlos dirigiéndose a la dirección arriba indicada mediante escrito al que ' +
      'acompañe fotocopia de su DNI/NIE/CIF.';
    setColor(GRIS_LEG);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const lineas = doc.splitTextToSize(texto, ANCHO);
    for (let i = 0; i < Math.min(lineas.length, 3); i++) {
      doc.text(lineas[i], W / 2, LEGAL_Y + i * 3.8, { align: 'center' });
    }
    hline(ML, MR, LEGAL_Y - 3, 0.3, GRIS_SEP);
  }

  const emisor     = datos.emisor    || {};
  const productos  = datos.productos || [];
  const materiales = datos.materiales || [];

  const ESPACIO_FIJO_P1 = 55 + 35 + 38 + 15;
  const ESPACIO_P1 = H - ESPACIO_FIJO_P1;

  let alturaProductos = 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const p of productos) {
    alturaProductos += calcularAlturaFila(p);
  }
  let alturaMateriales = 0;
  for (const m of materiales) {
    alturaMateriales += calcularAlturaFila(m);
  }

  const alturaTotalTablas = HDR_H + Math.max(alturaProductos, N_MIN * FILA_H_BASE) +
    (materiales.length > 0 ? 5.5 + HDR_H + Math.max(alturaMateriales, N_MIN * FILA_H_BASE) : 0);

  const paginas = [];

  if (alturaTotalTablas <= ESPACIO_P1) {
    paginas.push([...productos]);
  } else {
    let alturaAcum = 0;
    let idxCorte = 0;
    for (let i = 0; i < productos.length; i++) {
      const h = calcularAlturaFila(productos[i]);
      if (alturaAcum + h + HDR_H > ESPACIO_P1 && i > 0) {
        break;
      }
      alturaAcum += h;
      idxCorte = i + 1;
    }
    if (idxCorte === 0) idxCorte = 1;
    paginas.push(productos.slice(0, idxCorte));
    let remaining = productos.slice(idxCorte);
    const ESPACIO_PN = H - 25 - 38 - 15;
    while (remaining.length > 0) {
      alturaAcum = 0;
      idxCorte = 0;
      for (let i = 0; i < remaining.length; i++) {
        const h = calcularAlturaFila(remaining[i]);
        if (alturaAcum + h + HDR_H > ESPACIO_PN && i > 0) {
          break;
        }
        alturaAcum += h;
        idxCorte = i + 1;
      }
      if (idxCorte === 0) idxCorte = 1;
      paginas.push(remaining.slice(0, idxCorte));
      remaining = remaining.slice(idxCorte);
    }
  }

  const totalPags = paginas.length;

  for (let pi = 0; pi < paginas.length; pi++) {
    if (pi > 0) doc.addPage();
    const esPrimera = pi === 0;
    const esUltima  = pi === paginas.length - 1;
    const prods     = paginas[pi];

    let y = drawCabecera(datos, emisor, pi + 1, totalPags);

    if (esPrimera) {
      y = drawBloques(datos, emisor, y);
    } else {
      y += 4;
    }

    y = drawTabla(prods, y);

    if (esUltima && materiales.length > 0) {
      y += 4;
      y = drawTabla(materiales, y, 'MATERIALES');
    }

    if (esUltima) {
      y += 2;
      y = drawTotales(datos, y);
      drawIban(datos, y + 6);
    }

    drawLegal();

    if (DOCUMENTO_TITULO === 'PRESUPUESTO' && esUltima) {
      doc.saveGraphicsState();
      doc.setTextColor(180, 180, 180);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(80);
      doc.setGState(new doc.GState({ opacity: 0.18 }));
      doc.text('PRESUPUESTO', W / 2, H / 2, {
        align: 'center',
        angle: 45
      });
      doc.restoreGraphicsState();
    }
  }

  return doc;
}

async function generarPDFBlob(datos, nombreArchivo) {
  const doc    = generarFacturaPDF(datos);
  const nombre = (nombreArchivo || `Factura_${datos.num_factura}`)
    .replace(/[/\\:*?"<>|]/g, '-') + '.pdf';
  const dataUri    = doc.output('datauristring');
  const base64Data = dataUri.split(',')[1];
  const blob       = doc.output('blob');
  return { blob, base64Data, nombre };
}

async function enviarPDFTelegram(base64Data, nombre, botToken, chatId) {
  if (!botToken || !chatId) throw new Error('Bot Token y Chat ID son obligatorios');
  const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  const form = new FormData();
  form.append('chat_id',  chatId);
  form.append('caption',  `📄 ${nombre}`);
  form.append('document', blob, nombre);
  const resp = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    { method: 'POST', body: form }
  );
  const json = await resp.json();
  if (!json.ok) throw new Error(json.description || 'Error de Telegram');
  return json;
}
