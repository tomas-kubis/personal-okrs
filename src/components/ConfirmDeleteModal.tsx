import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName: string;
  requireConfirmation?: boolean;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  requireConfirmation = true,
}: ConfirmDeleteModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireConfirmation && !confirmed) {
      return;
    }
    onConfirm();
    handleClose();
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-error-100 dark:bg-error-900/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-error-600 dark:text-error-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            {message}
          </p>

          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-white">
              {itemName}
            </p>
          </div>

          {requireConfirmation && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I understand this action cannot be undone
              </span>
            </label>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={requireConfirmation && !confirmed}
            className="flex-1 px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
