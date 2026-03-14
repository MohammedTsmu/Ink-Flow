import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AddPrinterModal from './components/AddPrinterModal';
import EditPrinterModal from './components/EditPrinterModal';
import DetectPrintersModal from './components/DetectPrintersModal';
import HistoryPanel from './components/HistoryPanel';
import SettingsPanel from './components/SettingsPanel';
import StatisticsPanel from './components/StatisticsPanel';
import { PrinterWithStatus } from './types';

export default function App() {
  const [printers, setPrinters] = useState<PrinterWithStatus[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterWithStatus | null>(null);
  const [showDetect, setShowDetect] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyPrinterId, setHistoryPrinterId] = useState<number | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const loadPrinters = async () => {
    const data = await window.api.getPrintersWithStatus();
    setPrinters(data);
  };

  useEffect(() => {
    loadPrinters();
    const interval = setInterval(loadPrinters, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleShowPrinterHistory = (printerId: number) => {
    setHistoryPrinterId(printerId);
    setShowHistory(true);
  };

  const handleShowHistory = () => {
    setHistoryPrinterId(undefined);
    setShowHistory(true);
  };

  return (
    <Layout>
      <Dashboard
        printers={printers}
        onAddPrinter={() => setShowAddModal(true)}
        onEditPrinter={(p) => setEditingPrinter(p)}
        onRefresh={loadPrinters}
        onDetectPrinters={() => setShowDetect(true)}
        onShowHistory={handleShowHistory}
        onShowSettings={() => setShowSettings(true)}
        onShowStats={() => setShowStats(true)}
        onShowPrinterHistory={handleShowPrinterHistory}
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
      {showDetect && (
        <DetectPrintersModal
          onClose={() => setShowDetect(false)}
          onSave={loadPrinters}
        />
      )}
      {showHistory && (
        <HistoryPanel
          printerId={historyPrinterId}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}
      {showStats && (
        <StatisticsPanel
          onClose={() => setShowStats(false)}
        />
      )}
    </Layout>
  );
}
