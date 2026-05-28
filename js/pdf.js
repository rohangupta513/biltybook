// pdf.js - PDF Generation module using jsPDF and jsPDF AutoTable

export function generateInvoicePDF(client, transaction) {
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

  // 1. Plain Header Title (No colored banners or branding)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('INVOICE', 15, 18);

  // Single solid horizontal rule under title
  doc.setLineWidth(0.4);
  doc.line(15, 22, pageWidth - 15, 22);

  // 2. Client Details (Left side) and Date (Right side)
  let currentY = 30;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${client.name}`, 15, currentY + 6);
  doc.text(`Place: ${client.place}`, 15, currentY + 11);
  if (client.phone) {
    doc.text(`Phone: ${client.phone}`, 15, currentY + 16);
  }

  // Right-aligned Bill Date (Only printing date)
  doc.setFont('helvetica', 'bold');
  doc.text(`Date: ${transaction.dateOfBill || transaction.date}`, pageWidth - 15, currentY, { align: 'right' });

  // Adjust vertical positioning
  currentY += client.phone ? 26 : 20;

  // 3. Items Sold Table (Printed BEFORE Bilty Details)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Items Sold', 15, currentY);
  currentY += 4;

  const itemHeaders = [['Sl No', 'Item Description', 'Cartons', 'Qty / Carton', 'Rate / Pcs', 'Total (Rs.)']];
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
      fontSize: 9.5,
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
      fontSize: 9 
    },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2.5 }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // 4. Bilty Details Section (Printed AFTER Items Sold Table)
  if (transaction.biltys && transaction.biltys.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
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
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: { 
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        fontSize: 8.5 
      },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 }
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  // 5. Grand Total (No border box or horizontal dividers around it)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Grand Total:', pageWidth - 70, currentY);
  doc.text(`Rs. ${Number(transaction.amount).toFixed(2)}`, pageWidth - 15, currentY, { align: 'right' });

  // Save the PDF
  const filename = `Invoice_${client.name.replace(/\s+/g, '_')}_${transaction.date}.pdf`;
  doc.save(filename);
}

// Generate receipt PDF for Payment made by client
export function generatePaymentPDF(client, transaction) {
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

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PAYMENT RECEIPT', 10, 14);

  // Horizontal line under title
  doc.setLineWidth(0.4);
  doc.line(10, 17, pageWidth - 10, 17);

  // Receipt Content
  let currentY = 24;
  doc.setFontSize(9.5);
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
    doc.setFontSize(8.5);
    doc.text(`Description / Note: ${transaction.description}`, 10, currentY + 16);
  }

  const filename = `Receipt_${client.name.replace(/\s+/g, '_')}_${transaction.date}.pdf`;
  doc.save(filename);
}
