import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface ClearPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearPageModal: React.FC<ClearPageModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 31000 }}>
      <div 
        className="tool-popover" 
        style={{ 
          width: '340px', 
          padding: '24px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          textAlign: 'center',
          gap: '20px'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-icon-wrapper" style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          backgroundColor: 'rgba(255, 59, 48, 0.1)', 
          color: '#ff3b30', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Trash2 size={32} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Sayfayı Temizle</h3>
          <p style={{ fontSize: '14px', opacity: 0.7, margin: 0 }}>
            Bu sayfadaki tüm çizim, yazı ve görseller silinecektir. Bu işlem geri alınamaz.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button 
            className="pattern-btn" 
            style={{ flex: 1, height: '44px', borderRadius: '12px', fontWeight: 600 }}
            onClick={onClose}
          >
            Vazgeç
          </button>
          <button 
            className="pattern-btn" 
            style={{ 
              flex: 1, 
              height: '44px', 
              borderRadius: '12px', 
              backgroundColor: '#ff3b30', 
              color: 'white', 
              border: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(255, 59, 48, 0.3)'
            }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Temizle
          </button>
        </div>

        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '16px', 
            right: '16px', 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-color)', 
            opacity: 0.5, 
            cursor: 'pointer' 
          }}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};
