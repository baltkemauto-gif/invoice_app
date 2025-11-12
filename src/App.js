// src/App.js
import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "./fonts/Roboto-Regular-normal";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

function App() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ nosaukums: "", daudzums: 1, cena: 0 });
  const [clientInfo, setClientInfo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Ar maksājuma karti");

  const [invoiceNumber, setInvoiceNumber] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🔹 Nolasīt rēķina numuru no Firebase
  useEffect(() => {
    const fetchInvoiceNumber = async () => {
      const docRef = doc(db, "settings", "invoiceNumber");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setInvoiceNumber(docSnap.data().value);
      } else {
        await setDoc(docRef, { value: 2501 });
        setInvoiceNumber(2501);
      }
      setIsLoading(false);
    };

    fetchInvoiceNumber();
  }, []);

  // 🔹 Saglabā numuru Firebase
  const updateInvoiceNumber = async (newNumber) => {
    setInvoiceNumber(newNumber);
    await setDoc(doc(db, "settings", "invoiceNumber"), { value: newNumber });
  };

  const addItem = () => {
    if (!newItem.nosaukums || newItem.daudzums <= 0 || newItem.cena <= 0) return;
    setItems([...items, { ...newItem }]);
    setNewItem({ nosaukums: "", daudzums: 1, cena: 0 });
  };

  const removeItem = (idx) => {
    const copy = items.slice();
    copy.splice(idx, 1);
    setItems(copy);
  };

  const formatDate = (date) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };

  const createDoc = (invNumber) => {
    const doc = new jsPDF();
    doc.setFont("Roboto-Regular", "normal");

    doc.setFontSize(18);
    doc.text(`Rēķins Nr. ${invNumber}`, 105, 20, { align: "center" });
    doc.setFontSize(12);
    const dateStr = formatDate(new Date());
    doc.text(`Datums: ${dateStr}`, 20, 30);

    const companyInfo = [
      "Baltkem group, SIA",
      "Reģ. nr.: 40103354396",
      "PVN nr.: LV40103354396",
      "Juridiskā adrese: Anniņmuižas bulvāris 60 - 4, Rīga, LV-1029",
      "Faktiskā adrese: Lazdu iela 16D, Rīga, LV-1029",
      "AS “SEB banka”",
      "LV87UNLA0050016410133",
    ];

    let y = 45;
    doc.setLineWidth(0.1);
    doc.setDrawColor(150);
    doc.setLineDash([2, 2], 0);
    doc.line(20, y - 5, 190, y - 5);

    doc.setFontSize(11);
    companyInfo.forEach((line) => {
      doc.text(line, 20, y);
      y += 6.5;
    });

    doc.line(20, y + 2, 190, y + 2);
    doc.setLineDash([]);

    if (clientInfo && clientInfo.trim()) {
      y += 10;
      doc.setFontSize(11);
      doc.text("Pircējs:", 20, y);
      y += 6;
      const splitClient = doc.splitTextToSize(clientInfo, 170);
      doc.text(splitClient, 20, y);
      y += splitClient.length * 6.5;
    }

    y += 8;
    doc.setFontSize(11);
    doc.text(`Apmaksas kārtība: ${paymentMethod}`, 20, y);

    const body = items.map((it) => {
      const cenaArPVN = Number(it.cena) || 0;
      const summaArPVN = cenaArPVN * (Number(it.daudzums) || 1);
      return [
        it.nosaukums,
        String(it.daudzums),
        cenaArPVN.toFixed(2),
        summaArPVN.toFixed(2),
      ];
    });

    autoTable(doc, {
      startY: y + 8,
      head: [["Pakalpojums/Prece", "Daudzums", "Cena ar PVN (€)", "Summa ar PVN (€)"]],
      body: body,
      styles: { font: "Roboto-Regular", fontSize: 10 },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: [255, 255, 255],
        font: "Roboto-Regular",
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: "center", cellWidth: 20 },
        2: { halign: "right", cellWidth: 40 },
        3: { halign: "right", cellWidth: 40 },
      },
    });

    const totalArPVN = items.reduce(
      (s, it) => s + (Number(it.cena) || 0) * (Number(it.daudzums) || 1),
      0
    );
    const totalBezPVN = totalArPVN / 1.21;
    const totalPVN = totalArPVN - totalBezPVN;

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : y + 40;
    doc.setFontSize(11);
    doc.text(`Summa bez PVN: ${totalBezPVN.toFixed(2)} €`, 140, finalY);
    doc.text(`PVN 21%: ${totalPVN.toFixed(2)} €`, 140, finalY + 7);
    doc.text(`Kopā (ar PVN): ${totalArPVN.toFixed(2)} €`, 140, finalY + 14);

    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      "Rēķins sagatavots elektroniski un ir derīgs bez paraksta.",
      105,
      pageHeight - 10,
      { align: "center" }
    );

    return doc;
  };

  const handleGenerateAndDownload = async () => {
    if (items.length === 0) {
      alert("Pievieno vismaz vienu pakalpojumu, lai ģenerētu rēķinu.");
      return;
    }
    const doc = createDoc(invoiceNumber);
    doc.save(`rekins_${invoiceNumber}.pdf`);
    const next = invoiceNumber + 1;
    await updateInvoiceNumber(next);
  };

  const handleShare = async () => {
    if (items.length === 0) {
      alert("Pievieno vismaz vienu pakalpojumu, lai kopīgotu rēķinu.");
      return;
    }
    const doc = createDoc(invoiceNumber);
    const blob = doc.output("blob");
    const file = new File([blob], `rekins_${invoiceNumber}.pdf`, { type: "application/pdf" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Rēķins Nr. ${invoiceNumber}`,
          text: `Rēķins Nr. ${invoiceNumber}`,
        });
        const next = invoiceNumber + 1;
        await updateInvoiceNumber(next);
      } catch (err) {
        console.error("Share failed:", err);
        alert("Dalīšanās atcelta vai neizdevās.");
      }
    } else {
      alert("Dalīšanās ar failiem nav atbalstīta šajā ierīcē/pārlūkā.");
    }
  };

  const handleManualChange = async () => {
    const newNumber = prompt("Ievadi jaunu rēķina numuru:", invoiceNumber);
    if (newNumber && !isNaN(Number(newNumber))) {
      await updateInvoiceNumber(Number(newNumber));
      alert(`Rēķina numurs mainīts uz ${newNumber}`);
    }
  };

  if (isLoading) return <div style={{ padding: 20 }}>Notiek ielāde...</div>;

  const previewTotalArPVN = items.reduce(
    (s, it) => s + (Number(it.cena) || 0) * (Number(it.daudzums) || 1),
    0
  );
  const previewTotalBezPVN = previewTotalArPVN / 1.21;
  const previewPVN = previewTotalArPVN - previewTotalBezPVN;

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Rēķinu ģenerators</h1>

      <div style={{ marginBottom: 12 }}>
        <strong>Rēķina Nr.:</strong> {invoiceNumber} &nbsp;&nbsp;
        <button onClick={handleManualChange}>✎ Mainīt</button> &nbsp;&nbsp;
        <strong>Datums:</strong> {formatDate(new Date())}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label><strong>Pircējs (ja nepieciešams):</strong></label><br />
        <textarea
          placeholder="Ieraksti pircēja datus šeit..."
          value={clientInfo}
          onChange={(e) => setClientInfo(e.target.value)}
          rows={3}
          style={{ width: "100%", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label><strong>Apmaksas kārtība:</strong></label><br />
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={{ width: "100%", padding: 6 }}
        >
          <option>Ar maksājuma karti</option>
          <option>Ar bankas pārskaitījumu</option>
          <option>Skaidra nauda</option>
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Pakalpojums/Prece"
          value={newItem.nosaukums}
          onChange={(e) => setNewItem({ ...newItem, nosaukums: e.target.value })}
          style={{ marginRight: 8, width: "48%" }}
        />
        <input
          type="number"
          placeholder="Daudzums"
          value={newItem.daudzums}
          onChange={(e) => setNewItem({ ...newItem, daudzums: Number(e.target.value) })}
          style={{ marginRight: 8, width: 100 }}
        />
        <input
          type="number"
          placeholder="Cena ar PVN (€)"
          value={newItem.cena}
          onChange={(e) => setNewItem({ ...newItem, cena: Number(e.target.value) })}
          style={{ marginRight: 8, width: 140 }}
        />
        <button onClick={addItem}>Pievienot</button>
      </div>

      <table
        border="1"
        cellPadding="6"
        style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}
      >
        <thead style={{ background: "#333", color: "#fff" }}>
          <tr>
            <th>Pakalpojums/Prece</th>
            <th>Daudzums</th>
            <th>Cena ar PVN (€)</th>
            <th>Summa ar PVN (€)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const cenaArPVN = Number(it.cena) || 0;
            const summa = cenaArPVN * (Number(it.daudzums) || 1);
            return (
              <tr key={idx}>
                <td>{it.nosaukums}</td>
                <td style={{ textAlign: "center" }}>{it.daudzums}</td>
                <td style={{ textAlign: "right" }}>{cenaArPVN.toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{summa.toFixed(2)}</td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => removeItem(idx)}>Dzēst</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginBottom: 12, textAlign: "right" }}>
        <div>Summa bez PVN: {previewTotalBezPVN.toFixed(2)} €</div>
        <div>PVN 21%: {previewPVN.toFixed(2)} €</div>
        <div>
          <strong>Kopā (ar PVN): {previewTotalArPVN.toFixed(2)} €</strong>
        </div>
      </div>

      <div>
        <button onClick={handleGenerateAndDownload} style={{ marginRight: 8 }}>
          Lejupielādēt rēķinu (PDF)
        </button>
        <button onClick={handleShare} style={{ marginRight: 8 }}>
          Dalīties (WhatsApp / Share)
        </button>
      </div>
    </div>
  );
}

export default App;
