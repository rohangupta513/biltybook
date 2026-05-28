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
  
  // Design system colors
  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [16, 185, 129]; // Emerald 500
  const lightGrey = [241, 245, 249]; // Slate 100
  const darkGrey = [100, 116, 139]; // Slate 500

  // 1. Header Banner & Branding
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setFillColor(...accentColor);
  doc.rect(0, 25, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('BILTYBOOK LEDGER', 15, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('INVOICE / BILL OF SUPPLY', pageWidth - 15, 15, { align: 'right' });

  // 2. Metadata Columns (Invoice Details)
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  
  let currentY = 40;
  
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${client.name}`, 15, currentY + 6);
  doc.text(`Place: ${client.place}`, 15, currentY + 11);
  if (client.phone) {
    doc.text(`Phone: ${client.phone}`, 15, currentY + 16);
  }

  // Invoice parameters (Top Right)
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS:', pageWidth - 75, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bill Date: ${transaction.dateOfBill || transaction.date}`, pageWidth - 75, currentY + 6);
  doc.text(`Tx ID: ${transaction.id.substring(2, 10).toUpperCase()}`, pageWidth - 75, currentY + 11);
  doc.text(`Type: Bill Generation`, pageWidth - 75, currentY + 16);

  currentY += 26;

  // 3. Bilty Details Section (If available)
  if (transaction.biltys && transaction.biltys.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text(`Bilty Details (${transaction.numBiltys || transaction.biltys.length} biltys)`, 15, currentY);
    
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
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        halign: 'left'
      },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 }
    });

    currentY = doc.lastAutoTable.finalY + 10;
  }

  // 4. Items Table Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('Items Details', 15, currentY);
  
  currentY += 4;

  const itemHeaders = [['Sl No', 'Item Description', 'Cartons', 'Qty / Carton', 'Rate / Pcs', 'Total Amount']];
  const itemBody = (transaction.items || []).map(item => [
    item.slNo,
    item.item,
    item.numCartons,
    item.qtyPerCarton,
    `Rs. ${Number(item.rate).toFixed(2)}`,
    `Rs. ${Number(item.total).toFixed(2)}`
  ]);

  doc.autoTable({
    startY: currentY,
    head: itemHeaders,
    body: itemBody,
    theme: 'striped',
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
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
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 3 }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // 5. Total Calculations & Footer
  doc.setFillColor(...lightGrey);
  doc.rect(pageWidth - 85, currentY, 70, 16, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('Grand Total:', pageWidth - 80, currentY + 10);
  
  doc.setFontSize(13);
  doc.setTextColor(...accentColor);
  doc.text(`Rs. ${Number(transaction.amount).toFixed(2)}`, pageWidth - 20, currentY + 10, { align: 'right' });

  // Signature lines & Professional sign off
  currentY += 28;
  doc.setDrawColor(...lightGrey);
  doc.line(15, currentY, 75, currentY);
  doc.line(pageWidth - 75, currentY, pageWidth - 15, currentY);
  
  doc.setFontSize(8.5);
  doc.setTextColor(...darkGrey);
  doc.text("Customer's Signature", 45, currentY + 4, { align: 'center' });
  doc.text("Authorized Signatory", pageWidth - 45, currentY + 4, { align: 'center' });

  // Footer Branding
  doc.setFontSize(8);
  doc.text("Thank you for your business!", pageWidth / 2, pageWidth >= 297 ? 200 : 282, { align: 'center' });

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
  
  const primaryColor = [15, 23, 42];
  const accentColor = [16, 185, 129];
  const darkGrey = [100, 116, 139];

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 20, 'F');
  
  doc.setFillColor(...accentColor);
  doc.rect(0, 20, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PAYMENT RECEIPT', 10, 13);

  // Logo branding
  doc.setFontSize(8.5);
  doc.text('BILTYBOOK', pageWidth - 10, 13, { align: 'right' });

  // Receipt Content
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9.5);
  
  let currentY = 32;
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIPT TO:', 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Client Name: ${client.name}`, 10, currentY + 5);
  doc.text(`Place: ${client.place}`, 10, currentY + 10);

  // Receipt metadata
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIPT DETAILS:', pageWidth - 65, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${transaction.date}`, pageWidth - 65, currentY + 5);
  doc.text(`Receipt ID: ${transaction.id.substring(2, 10).toUpperCase()}`, pageWidth - 65, currentY + 10);

  currentY += 22;

  // Receipt box
  doc.setFillColor(241, 245, 249);
  doc.rect(10, currentY, pageWidth - 20, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Amount Received:', 15, currentY + 10);
  
  doc.setFontSize(14);
  doc.setTextColor(...accentColor);
  doc.text(`Rs. ${Number(transaction.amount).toFixed(2)}`, pageWidth - 15, currentY + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkGrey);
  doc.text(`Description: ${transaction.description || 'Payment received and credited to account.'}`, 15, currentY + 18);

  currentY += 40;

  // Signatures
  doc.line(10, currentY, 50, currentY);
  doc.line(pageWidth - 50, currentY, pageWidth - 10, currentY);
  doc.text("Received By", 30, currentY + 4, { align: 'center' });
  doc.text("Customer Signature", pageWidth - 30, currentY + 4, { align: 'center' });

  const filename = `Receipt_${client.name.replace(/\s+/g, '_')}_${transaction.date}.pdf`;
  doc.save(filename);
}
