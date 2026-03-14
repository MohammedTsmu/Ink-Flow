import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AddPrinterModal from './components/AddPrinterModal';
import EditPrinterModal from './components/EditPrinterModal';
import { PrinterWithStatus } from './types';

export default function App() {
  const [printers, setPrinters] = useState<PrinterWithStatus[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterWithStatus | null>(null);

  const loadPrinters = async () => {
    const data = await window.api.getPrintersWithStatus();
    setPrinters(data);
  };

  useEffect(() => {
    loadPrinters();
    const interval = setInterval(loadPrinters, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      <Dashboard
        printers={printers}
        onAddPrinter={() => setShowAddModal(true)}
        onEditPrinter={(p) => setEditingPrinter(p)}
        onRefresh={loadPrinters}
      />
      {showAddModal && (
        <AddPrinterModal
          onClose={() => setShowAddModal(false)}
          onSave={loadPrinters}
        />
      )}
      {editingPrinter && (
        <EditPrinterModal
          printer={editingPrinter}
          onClose={() => setEditingPrinter(null)}
          onSave={loadPrinters}
        />
      )}
    </Layout>
  );
}
