import React, { useState } from 'react';

interface AddPrinterModalProps {
  onClose: () => void;
  onSave: () => void;
}

export default function AddPrinterModal({ onClose, onSave }: AddPrinterModalProps) {
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [inkType, setInkType] = useState('');
  const [maxIdleDays, setMaxIdleDays] = useState(7);
  const [warningDays, setWarningDays] = useState(3);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await window.api.addPrinter({
        name: name.trim(),
        model: model.trim(),
        inkType: inkType.trim(),
        maxIdleDays,
        warningDays: Math.min(warningDays, maxIdleDays),
      });
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-5">Add Printer</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Printer Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="e.g., HP OfficeJet Pro"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="e.g., 8035e"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Ink Type</label>
            <input
              type="text"
              value={inkType}
              onChange={(e) => setInkType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="e.g., Dye-based, Pigment"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Idle Days *</label>
              <input
                type="number"
                value={maxIdleDays}
                onChange={(e) => setMaxIdleDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Days before maintenance is needed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Warning Days</label>
              <input
                type="number"
                value={warningDays}
                onChange={(e) => setWarningDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">Days before deadline to start warning</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Printer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
