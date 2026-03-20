import React, { useState } from 'react';
import { Plus, Trash2, Edit3, ChevronLeft, ChevronRight, FileText, Calendar, Book } from 'lucide-react';
import type { NoteMetadata } from '../utils/storage';

interface SidebarProps {
  notes: NoteMetadata[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onNewNotebook: () => void;
  onDeleteNote: (id: string) => void;
  onRenameNote: (id: string, newTitle: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onNewNotebook,
  onDeleteNote,
  onRenameNote,
  isOpen,
  setIsOpen
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleRenameSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameNote(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      <button 
        className={`sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Menüyü Kapat' : 'Menüyü Aç'}
      >
        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Notlarım</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="new-note-btn" onClick={onNewNotebook} title="Yeni Defter" style={{ backgroundColor: 'var(--text-color)' }}>
              <Book size={18} />
            </button>
            <button className="new-note-btn" onClick={onNewNote} title="Yeni Not">
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="sidebar-list">
          {notes.length === 0 && (
            <div className="empty-state">Henüz not yok</div>
          )}
          {notes.map(note => {
            const isNotebook = note.type === 'notebook';
            return (
              <div 
                key={note.id} 
                className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
                onClick={() => onSelectNote(note.id)}
                style={{
                  borderLeft: isNotebook && note.coverColor ? `4px solid ${note.coverColor}` : undefined
                }}
              >
                <div className="note-icon" style={{ 
                  backgroundColor: isNotebook && note.coverColor ? `${note.coverColor}20` : undefined,
                  color: isNotebook && note.coverColor ? note.coverColor : undefined
                }}>
                  {isNotebook ? <Book size={18} /> : <FileText size={18} />}
                </div>
                
                <div className="note-info">
                  {editingId === note.id ? (
                    <form onSubmit={(e) => handleRenameSubmit(e, note.id)} onClick={e => e.stopPropagation()}>
                      <input 
                        autoFocus
                        className="rename-input"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={(e) => handleRenameSubmit(e as any, note.id)}
                      />
                    </form>
                  ) : (
                    <span className="note-title">{note.title}</span>
                  )}
                  <span className="note-date">
                    <Calendar size={10} />
                    {new Date(note.updatedAt).toLocaleDateString('tr-TR')}
                  </span>
                </div>

                <div className="note-actions">
                  <button 
                    className="action-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(note.id);
                      setEditTitle(note.title);
                    }}
                    title="Yeniden Adlandır"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    className="action-btn delete" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(note.id);
                    }}
                    title="Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
