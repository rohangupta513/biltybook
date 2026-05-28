// pdf.js - PDF Generation module using jsPDF and jsPDF AutoTable

// Helper function to load images asynchronously as promises
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
}

export async function generateInvoicePDF(client, transaction, action = 'save') {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    alert("jsPDF library is not loaded. Please check your internet connection.");
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Set stroke/draw color and text color to black for clean black-and-white print
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // Load Ganesha watermark image asynchronously
  let ganeshImg = null;
  try {
    ganeshImg = await loadImage('assets/ganesh_watermark.png');
  } catch (e) {
    console.warn('Failed to load Ganesha watermark:', e);
  }

  // Draw Ganesha watermark in background with low opacity (8%)
  if (ganeshImg) {
    try {
      doc.saveGraphicsState();
      const gState = new doc.GState({ opacity: 0.08 }); // 8% opacity is a perfect faded watermark
      doc.setGState(gState);
      // Center on page. A4 width is 210mm, height is 297mm. Watermark size is 120mm.
      doc.addImage(ganeshImg, 'PNG', (pageWidth - 120) / 2, (297 - 120) / 2, 120, 120);
      doc.restoreGraphicsState();
    } catch (err) {
      console.warn('Failed to apply faded watermark opacity:', err);
    }
  }

  // 1. Plain Header Title (Increased font size from 18 to 20)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', 15, 18);

  // Single solid horizontal rule under title
  doc.setLineWidth(0.4);
  doc.line(15, 22, pageWidth - 15, 22);

  // 2. Client Details (Left side) and Date (Right side)
  let currentY = 30;
  
  // Increased font sizes from 10 to 12
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${client.name}`, 15, currentY + 6);
  doc.text(`Place: ${client.place}`, 15, currentY + 11);
  if (client.phone) {
    doc.text(`Phone: ${client.phone}`, 15, currentY + 16);
  }

  // Right-aligned Bill Date (Increased font size from 10 to 12)
  doc.setFont('helvetica', 'bold');
  doc.text(`Date: ${transaction.dateOfBill || transaction.date}`, pageWidth - 15, currentY, { align: 'right' });

  // Adjust vertical positioning
  currentY += client.phone ? 26 : 20;

  // 3. Items Sold Table (Printed BEFORE Bilty Details)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12); // Increased font size from 10 to 12
  doc.text('Items Sold', 15, currentY);
  currentY += 4;

  // Renamed columns exactly as requested: Sl.no , Items  , No. of c/n , Qnty. per c/n , Rate , Total
  const itemHeaders = [['Sl.no', 'Items', 'No. of c/n', 'Qnty. per c/n', 'Rate', 'Total']];
  const itemBody = (transaction.items || []).map(item => [
    item.slNo,
    item.item,
    item.numCartons,
    item.qtyPerCarton,
    Number(item.rate).toFixed(2),
    Number(item.total).toFixed(2)
  ]);

  doc.autoTable({
    startY: currentY,
    head: itemHeaders,
    body: itemBody,
    theme: 'grid', // Force clear black outlines
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      fontSize: 11.5, // Increased from 9.5 to 11.5
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    },
    bodyStyles: { 
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      fontSize: 11 // Increased from 9 to 11
    },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2.5 }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // 4. Bilty Details Section (Printed AFTER Items Sold Table)
  if (transaction.biltys && transaction.biltys.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12); // Increased from 10 to 12
    doc.text('Bilty Details', 15, currentY);
    currentY += 4;

    const biltyHeaders = [['Sl No', 'Bilty Number', 'Transport Name', 'Bilty Date']];
    const biltyBody = transaction.biltys.map((b, index) => [
      index + 1,
      b.biltyNo || 'N/A',
      b.transportName || 'N/A',
      b.date || 'N/A'
    ]);

    doc.autoTable({
      startY: currentY,
      head: biltyHeaders,
      body: biltyBody,
      theme: 'grid',
      headStyles: { 
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        fontSize: 11, // Increased from 9 to 11
        fontStyle: 'bold'
      },
      bodyStyles: { 
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        fontSize: 10.5 // Increased from 8.5 to 10.5
      },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 }
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  // 5. Grand Total (No border box or horizontal dividers around it)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13); // Increased from 11 to 13
  doc.text('Grand Total:', pageWidth - 70, currentY);
  doc.text(`Rs. ${Number(transaction.amount).toFixed(2)}`, pageWidth - 15, currentY, { align: 'right' });

  // Save or Print the PDF
  const filename = `Invoice_${client.name.replace(/\s+/g, '_')}_${transaction.date}.pdf`;
  if (action === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    doc.save(filename);
  }
}

// Generate receipt PDF for Payment made by client
export async function generatePaymentPDF(client, transaction, action = 'save') {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    alert("jsPDF library is not loaded.");
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5' // A5 is perfect for payment receipts
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // Load Ganesha watermark image asynchronously
  let ganeshImg = null;
  try {
    ganeshImg = await loadImage('assets/ganesh_watermark.png');
  } catch (e) {
    console.warn('Failed to load Ganesha watermark:', e);
  }

  // Draw Ganesha watermark in background with low opacity (8%)
  if (ganeshImg) {
    try {
      doc.saveGraphicsState();
      const gState = new doc.GState({ opacity: 0.08 });
      doc.setGState(gState);
      // Center on A5 page (148mm x 210mm). Watermark size is 80mm.
      doc.addImage(ganeshImg, 'PNG', (pageWidth - 80) / 2, (210 - 80) / 2, 80, 80);
      doc.restoreGraphicsState();
    } catch (err) {
      console.warn('Failed to apply faded watermark opacity:', err);
    }
  }

  // Title (Increased from 13 to 15)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PAYMENT RECEIPT', 10, 14);

  // Horizontal line under title
  doc.setLineWidth(0.4);
  doc.line(10, 17, pageWidth - 10, 17);

  // Receipt Content (Increased from 9.5 to 11.5)
  let currentY = 24;
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIPT TO:', 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Client Name: ${client.name}`, 10, currentY + 5);
  doc.text(`Place: ${client.place}`, 10, currentY + 10);

  // Right-aligned Date
  doc.setFont('helvetica', 'bold');
  doc.text(`Date: ${transaction.date}`, pageWidth - 10, currentY, { align: 'right' });

  currentY += 20;

  // Simple clean text output for payment amount (No borders)
  doc.setFont('helvetica', 'bold');
  doc.text('Amount Received:', 10, currentY + 6);
  doc.text(`Rs. ${Number(transaction.amount).toFixed(2)}`, pageWidth - 10, currentY + 6, { align: 'right' });

  if (transaction.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5); // Increased from 8.5 to 10.5
    doc.text(`Description / Note: ${transaction.description}`, 10, currentY + 16);
  }

  const filename = `Receipt_${client.name.replace(/\s+/g, '_')}_${transaction.date}.pdf`;
  if (action === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    doc.save(filename);
  }
}
