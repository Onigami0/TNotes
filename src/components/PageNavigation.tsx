import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (index: number) => void;
  onAddPage: () => void;
}

export const PageNavigation: React.FC<PageNavigationProps> = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  onAddPage 
}) => {
  return (
    <div className="page-navigation-container" style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      backgroundColor: 'rgba(var(--bg-rgb), 0.7)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '20px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      zIndex: 1000,
      userSelect: 'none'
    }}>
      <button 
        className="nav-btn" 
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        title="Önceki Sayfa"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-color)',
          cursor: currentPage === 0 ? 'default' : 'pointer',
          opacity: currentPage === 0 ? 0.3 : 1,
          display: 'flex',
          alignItems: 'center',
          padding: '4px'
        }}
      >
        <ChevronLeft size={20} />
      </button>

      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        minWidth: '60px',
        textAlign: 'center',
        color: 'var(--text-color)'
      }}>
        {currentPage + 1} / {totalPages}
      </div>

      <button 
        className="nav-btn" 
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        title="Sonraki Sayfa"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-color)',
          cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
          opacity: currentPage === totalPages - 1 ? 0.3 : 1,
          display: 'flex',
          alignItems: 'center',
          padding: '4px'
        }}
      >
        <ChevronRight size={20} />
      </button>

      <div style={{
        width: '1px',
        height: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        margin: '0 4px'
      }} />

      <button 
        className="nav-btn add" 
        onClick={onAddPage}
        title="Yeni Sayfa Ekle"
        style={{
          background: 'var(--text-color)',
          border: 'none',
          color: 'var(--bg-color)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          transition: 'transform 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Plus size={18} strokeWidth={3} />
      </button>
    </div>
  );
};
