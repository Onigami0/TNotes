import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import './App.css';
import {
  Palette,
  Type,
  Square,
  Circle,
  Highlighter,
  Eraser,
  Download,
  Share2,
  Sun,
  Moon,
  MousePointer2,
  Sparkles,
  RotateCw,
  PenTool,
  Image as ImageIcon,
  FileDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Grid,
  CalendarDays,
  ListTodo,
  CalendarCheck,
  FileSpreadsheet,
  GripHorizontal,
  RotateCcw,
  LayoutDashboard,
  X
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { storage } from './utils/storage';
import type { NoteMetadata, NoteData } from './utils/storage';
import { Sidebar } from './components/Sidebar';
import { CanvasBoard } from './components/CanvasBoard';
import { TextTool } from './components/TextTool';
import type { TextElement } from './components/TextTool';
import { SelectionOverlay } from './components/SelectionOverlay';
import { ImageTool } from './components/ImageTool';
import type { ImageElement } from './components/ImageTool';
import { Minimap } from './components/Minimap';
import type { PenType, Stroke } from './types';
import { patterns } from './utils/patterns';
import { recognizeHandwriting } from './utils/htr';
import { isStrokeInRect } from './utils/drawing';
import { DeleteModal } from './components/DeleteModal';
import { PageNavigation } from './components/PageNavigation';
import { ClearPageModal } from './components/ClearPageModal';
import type { PageData } from './utils/storage';

// Standard Paper Sizes (in pixels at 96 DPI approx)
const PAPER_SIZES = {
  'A2': { width: 1588, height: 2246, label: 'A2' }, // Exactly 2x A4
  'A3': { width: 1123, height: 1588, label: 'A3' }, // Approx sqrt(2)x
  'A4': { width: 794, height: 1123, label: 'A4' },
  'A5': { width: 561, height: 794, label: 'A5' }, // Exactly 1/2 A3 width
};

type PageSizeKey = keyof typeof PAPER_SIZES | 'infinity';

// Extended Pen Colors
const COLORS = [
  '#1c1c1e', // Siyah / Koyu Gri
  '#ff3b30', // Kırmızı
  '#ff9500', // Turuncu
  '#ffcc00', // Sarı
  '#34c759', // Yeşil
  '#00c7be', // Turkuaz
  '#007aff', // Mavi
  '#5856d6', // Mor
  '#ff2d55', // Pembe
  '#8e8e93', // Gri
];

const EXTENDED_COLORS = [
  '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#6c757d', '#495057', '#343a40', '#212529', '#000000',
  '#fff5f5', '#ffc9c9', '#fa5252', '#e03131', '#c92a2a',
  '#fff0f6', '#fcc2d7', '#f06595', '#d6336c', '#a61e4d',
  '#f8f0fc', '#eebefa', '#da77f2', '#ae3ec9', '#862e9c',
  '#f3f0ff', '#d0bfff', '#7950f2', '#5f3dc4', '#4521b0',
  '#edf2ff', '#bac8ff', '#4c6ef5', '#364fc7', '#2b3991',
  '#e7f5ff', '#a5d8ff', '#228be6', '#1971c2', '#1864ab',
  '#e3fafc', '#99e9f2', '#15aabf', '#0c8599', '#0b7285',
  '#e6fcf5', '#96f2d7', '#12b886', '#099268', '#087f5b',
  '#ebfbee', '#b2f2bb', '#40c057', '#2f9e44', '#2b8a3e',
  '#f4fce3', '#d8f5a2', '#82c91e', '#66a80f', '#5c940d',
  '#fff9db', '#ffec99', '#fab005', '#f59f00', '#f08c00',
  '#fff4e6', '#ffd8a8', '#fd7e14', '#e8590c', '#d9480f',
];

// Extended Page Background Colors
const PAGE_COLORS = [
  'var(--bg-color)', // Temaya göre değişen varsayılan
  '#ffffff', // Bembeyaz kağıt
  '#f5f5f5', // Açık Gri
  '#f5e6d3', // Sıcak / Sepya / Saman Kağıdı
  '#fff9c4', // Açık Sarı (Sarı Kağıt)
  '#e3f2fd', // Açık Mavi (Buz mavisi)
  '#fce4ec', // Açık Pembe 
  '#2a2a2a', // Koyu Gri / Karatahta
  '#1a1c23', // Derin Lacivert / Koyu Gece
];


function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTool, setActiveTool] = useState<PenType>('ballpoint');
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [strokeSize, setStrokeSize] = useState(4);

  // Persistence State
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Camera State for Pan & Zoom
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing History
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  // Text Elements
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [activeFontFamily, setActiveFontFamily] = useState("'Inter', sans-serif");
  const [activeIsBold, setActiveIsBold] = useState(false);
  const [activeIsItalic, setActiveIsItalic] = useState(false);
  const [activeTextAlign, setActiveTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [activeFontSize, setActiveFontSize] = useState(20);

  // Image Elements
  const [imageElements, setImageElements] = useState<ImageElement[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  // Smart Pen (HTR)
  const [isSmartPenActive, setIsSmartPenActive] = useState(false);
  const [isHtrProcessing, setIsHtrProcessing] = useState(false);
  const [htrLanguage, setHtrLanguage] = useState('tr');
  const [, setHtrStrokesBuffer] = useState<Stroke[]>([]);
  const htrTimeoutRef = useRef<any>(null);

  // Page Settings
  const [pagePattern, setPagePattern] = useState('grid');
  const [pageColor, setPageColor] = useState('var(--bg-color)');
  const [pageSize, setPageSize] = useState<PageSizeKey>('A4');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Multi-page State
  const [pages, setPages] = useState<PageData[]>([{ strokes: [], textElements: [], imageElements: [] }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string, title: string } | null>(null);

  const [isNoteColorPickerOpen, setIsNoteColorPickerOpen] = useState(false);
  const [isClearPageModalOpen, setIsClearPageModalOpen] = useState(false);
  
  // Storage operations
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  // Load notes on mount
  useEffect(() => {
    const initStorage = async () => {
      const allNotes = await storage.getAllNotes();
      setNotes(allNotes);

      if (allNotes.length > 0) {
        setActiveNoteId(allNotes[0].id);
      } else {
        // Create first note
        const newId = Date.now().toString();
        const firstNote: NoteMetadata = {
          id: newId,
          title: 'Başlıksız Not',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        const emptyNote: NoteData = {
          pages: [{ strokes: [], textElements: [], imageElements: [] }],
          currentPageIndex: 0,
          pageSettings: { pageSize: 'A4', pagePattern: 'grid', pageColor: 'var(--bg-color)' }
        };
        await storage.saveNote(newId, firstNote, emptyNote);
        setNotes([{ ...firstNote, type: 'note' }]);
        setActiveNoteId(newId);
      }
      setIsInitialLoad(false);
    };
    initStorage();
  }, []);

  // Load active note content
  useEffect(() => {
    if (!activeNoteId || isInitialLoad) return;

    const loadContent = async () => {
      const data = await storage.getNoteContent(activeNoteId);
      if (data) {
        // Migration & Loading
        let loadedPages: PageData[] = [];
        let loadedIndex = data.currentPageIndex || 0;

        if (data.pages && data.pages.length > 0) {
          loadedPages = data.pages;
        } else {
          // Migrate legacy single-page note
          loadedPages = [{
            strokes: data.strokes || [],
            textElements: data.textElements || [],
            imageElements: data.imageElements || []
          }];
          loadedIndex = 0;
        }

        setPages(loadedPages);
        setCurrentPageIndex(loadedIndex);

        // Load active page into state
        const activePage = loadedPages[loadedIndex] || loadedPages[0];
        setStrokes(activePage.strokes || []);
        setTextElements(activePage.textElements || []);
        setImageElements(activePage.imageElements || []);
        
        // Load per-page settings or fallback to global settings
        const settings = activePage.pageSettings || data.pageSettings;
        setPageSize(settings?.pageSize as PageSizeKey || 'A4');
        setPagePattern(settings?.pagePattern || 'grid');
        setPageColor(settings?.pageColor || 'var(--bg-color)');
        setRedoStack([]);
      }
    };
    loadContent();
  }, [activeNoteId, isInitialLoad]);

  // Auto-save debounced
  useEffect(() => {
    if (!activeNoteId || isInitialLoad) return;

    const timeout = setTimeout(async () => {
      // Sync current state to pages array before saving
      const updatedPages = [...pages];
      updatedPages[currentPageIndex] = {
        strokes: [...strokes],
        textElements: [...textElements],
        imageElements: [...imageElements],
        pageSettings: { pageSize, pagePattern, pageColor }
      };

      await storage.saveNote(activeNoteId, {}, {
        pages: updatedPages,
        currentPageIndex,
        pageSettings: { pageSize, pagePattern, pageColor } // Keep as fallback
      });
      setPages(updatedPages);
      // Update updated_at in local state
      setNotes(prev => prev.map(n => n.id === activeNoteId ? { ...n, updatedAt: Date.now() } : n));
    }, 1500);

    return () => clearTimeout(timeout);
  }, [strokes, textElements, imageElements, pageSize, pagePattern, pageColor, activeNoteId, isInitialLoad]);

  const handleNewNote = async () => {
    const newId = Date.now().toString();
    const newNote: NoteMetadata = {
      id: newId,
      title: 'Yeni Not',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const emptyNote: NoteData = {
      pages: [{ strokes: [], textElements: [], imageElements: [] }],
      currentPageIndex: 0,
      pageSettings: { pageSize: 'A4', pagePattern: 'grid', pageColor: 'var(--bg-color)' }
    };

    await storage.saveNote(newId, newNote, emptyNote);

    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newId);
  };

  const handleNewNotebook = async (color: string) => {
    const newId = Date.now().toString();
    const newNote: NoteMetadata = {
      id: newId,
      title: 'Yeni Defter',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type: 'notebook',
      coverColor: color
    };

    const emptyNotebook: NoteData = {
      pages: [{ strokes: [], textElements: [], imageElements: [] }],
      currentPageIndex: 0,
      pageSettings: { pageSize: 'A4', pagePattern: 'grid', pageColor: 'var(--bg-color)' }
    };

    await storage.saveNote(newId, newNote, emptyNotebook);

    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newId);
    setIsNoteColorPickerOpen(false);
  };

  const handleDeleteRequest = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      setNoteToDelete({ id, title: note.title });
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;

    await storage.deleteNote(noteToDelete.id);
    const updatedNotes = notes.filter(n => n.id !== noteToDelete.id);
    setNotes(updatedNotes);

    if (activeNoteId === noteToDelete.id) {
      if (updatedNotes.length > 0) {
        setActiveNoteId(updatedNotes[0].id);
      } else {
        handleNewNote();
      }
    }
    setNoteToDelete(null);
  };

  // Page Management
  const handlePageChange = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= pages.length) return;

    // 1. Sync current state to current page in the pages array
    const updatedPages = [...pages];
    updatedPages[currentPageIndex] = {
      strokes: [...strokes],
      textElements: [...textElements],
      imageElements: [...imageElements],
      pageSettings: { pageSize, pagePattern, pageColor }
    };

    // 2. Load the target page's state
    const targetPage = updatedPages[newIndex];
    setStrokes(targetPage.strokes || []);
    setTextElements(targetPage.textElements || []);
    setImageElements(targetPage.imageElements || []);
    
    // Load target page settings
    const settings = targetPage.pageSettings || updatedPages[0].pageSettings;
    if (settings) {
      setPageSize(settings.pageSize as PageSizeKey);
      setPagePattern(settings.pagePattern);
      setPageColor(settings.pageColor);
    }

    // 3. Update state
    setPages(updatedPages);
    setCurrentPageIndex(newIndex);
    setSelectedElements({ strokes: [], texts: [] });
    setRedoStack([]);
  };

  const handleAddPage = () => {
    // 1. Sync current state to current page
    const updatedPages = [...pages];
    updatedPages[currentPageIndex] = {
      strokes: [...strokes],
      textElements: [...textElements],
      imageElements: [...imageElements],
      pageSettings: { pageSize, pagePattern, pageColor }
    };

    // 2. Add a new blank page with current settings inherited
    const newPage: PageData = { 
      strokes: [], 
      textElements: [], 
      imageElements: [],
      pageSettings: { pageSize, pagePattern, pageColor }
    };
    const newPages = [...updatedPages, newPage];
    const newIndex = newPages.length - 1;

    // 3. Set state to the new page
    setPages(newPages);
    setCurrentPageIndex(newIndex);
    setStrokes([]);
    setTextElements([]);
    setImageElements([]);
    setSelectedElements({ strokes: [], texts: [] });
    setRedoStack([]);
  };

  const handleRenameNote = async (id: string, newTitle: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title: newTitle, updatedAt: Date.now() } : n));
    // Content is preserved, only metadata changes
    const content = await storage.getNoteContent(id);
    if (content) {
      await storage.saveNote(id, { title: newTitle }, content);
    }
  };

  // UI States
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // Internal canvas coords
  // Mathematical Grid & Line Spacing (A4 Standards: ~5mm squares, ~30 lines)
  const GRID_SIZE = 28;
  const LINE_SPACING = 37.4; // 1123 / 30 = 37.4

  // Selection
  const [selectedElements, setSelectedElements] = useState<{ strokes: string[], texts: string[] }>({ strokes: [], texts: [] });

  // Toolbar State
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  // Default centered near top
  const [menuBarPosition, setMenuBarPosition] = useState({ x: window.innerWidth / 2 - 24, y: 20 });
  const [activePopover, setActivePopover] = useState<string | null>(null);

  // Dragging logic for menu bar
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  const handleMenuBarPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartPosRef.current = {
      x: e.clientX - menuBarPosition.x,
      y: e.clientY - menuBarPosition.y
    };
  };

  const handleMenuBarPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    setMenuBarPosition({
      x: e.clientX - dragStartPosRef.current.x,
      y: e.clientY - dragStartPosRef.current.y
    });
  };

  const handleMenuBarPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
  };

  // Sync active text settings from selected text
  useEffect(() => {
    if (selectedElements.texts.length === 1) {
      const selected = textElements.find(t => t.id === selectedElements.texts[0]);
      if (selected) {
        setActiveFontFamily(selected.fontFamily);
        setActiveFontSize(selected.fontSize);
        setActiveIsBold(selected.isBold || false);
        setActiveIsItalic(selected.isItalic || false);
        setActiveTextAlign(selected.textAlign || 'left');
      }
    }
  }, [selectedElements.texts, textElements]);

  // Update selected text elements when active text settings change
  useEffect(() => {
    if (selectedElements.texts.length > 0) {
      setTextElements(prev => prev.map(t => {
        if (selectedElements.texts.includes(t.id)) {
          return {
            ...t,
            fontFamily: activeFontFamily,
            fontSize: activeFontSize,
            isBold: activeIsBold,
            isItalic: activeIsItalic,
            textAlign: activeTextAlign,
            color: activeColor === 'var(--bg-color)' ? (isDarkMode ? '#ffffff' : '#000000') : activeColor
          };
        }
        return t;
      }));
    }
  }, [activeFontFamily, activeFontSize, activeIsBold, activeIsItalic, activeTextAlign, activeColor, isDarkMode, selectedElements.texts]);

  // Initialize theme from system preference or local storage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.classList.add('dark-theme');
    } else if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.body.classList.remove('dark-theme');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.body.classList.add('dark-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const handleStrokeComplete = (stroke: Stroke) => {
    setStrokes(prev => [...prev, stroke]);
    setRedoStack([]); // New drawing clears redo stack

    if (isSmartPenActive) {
      // Clear previous timeout and add to buffer
      if (htrTimeoutRef.current) clearTimeout(htrTimeoutRef.current);

      setHtrStrokesBuffer(prev => {
        const newBuffer = [...prev, stroke];

        // Process HTR after inactivity
        htrTimeoutRef.current = setTimeout(async () => {
          setIsHtrProcessing(true);
          const text = await recognizeHandwriting(newBuffer, htrLanguage);
          if (text) {
            // Calculate starting point (left-most point of strokes)
            let minX = Infinity, minY = Infinity;
            newBuffer.forEach(s => s.points.forEach(p => {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
            }));

            // Snapping logic for HTR - Match manual text tool
            const currentYSpacing = pagePattern === 'lines' ? LINE_SPACING : GRID_SIZE;
            const snappedY = Math.ceil(minY / currentYSpacing) * currentYSpacing;

            const newText: TextElement = {
              id: Date.now().toString(),
              text: text,
              x: minX,
              y: snappedY,
              fontSize: 24,
              fontFamily: activeFontFamily,
              color: activeColor === 'var(--bg-color)' ? (isDarkMode ? '#ffffff' : '#000000') : activeColor
            };
            setTextElements(te => [...te, newText]);

            // AUTOMATICALLY REMOVE STROKES
            const bufferIds = new Set(newBuffer.map(s => s.id));
            setStrokes(prevStrokes => prevStrokes.filter(s => !bufferIds.has(s.id)));
          }
          setIsHtrProcessing(false);
          setHtrStrokesBuffer([]);
        }, 1200);

        return newBuffer;
      });
    }
  };

  const handleConvertStrokesToText = async (strokeIds: string[]) => {
    if (strokeIds.length === 0) return;

    const targetStrokes = strokes.filter(s => strokeIds.includes(s.id));
    if (targetStrokes.length === 0) return;

    setIsHtrProcessing(true);
    const text = await recognizeHandwriting(targetStrokes, htrLanguage);
    if (text) {
      let minX = Infinity, minY = Infinity;
      targetStrokes.forEach(s => s.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
      }));

      const currentYSpacing = pagePattern === 'lines' ? LINE_SPACING : GRID_SIZE;
      const snappedY = Math.ceil(minY / currentYSpacing) * currentYSpacing;
      const newText: TextElement = {
        id: Date.now().toString(),
        text,
        x: minX,
        y: snappedY,
        fontSize: 24,
        fontFamily: activeFontFamily,
        color: activeColor === 'var(--bg-color)' ? (isDarkMode ? '#ffffff' : '#000000') : activeColor
      };
      setTextElements(prev => [...prev, newText]);
      setStrokes(prev => prev.filter(s => !strokeIds.includes(s.id)));
      setSelectedElements({ strokes: [], texts: [] });
    }
    setIsHtrProcessing(false);
  };

  const undo = React.useCallback(() => {
    if (strokes.length === 0) return;
    setStrokes(prev => {
      const newStrokes = [...prev];
      const undoneStroke = newStrokes.pop();
      if (undoneStroke) {
        setRedoStack(redo => [...redo, undoneStroke]);
      }
      return newStrokes;
    });
  }, [strokes.length]);

  const redo = React.useCallback(() => {
    if (redoStack.length === 0) return;
    setRedoStack(prev => {
      const newRedoStack = [...prev];
      const redoneStroke = newRedoStack.pop();
      if (redoneStroke) {
        setStrokes(s => [...s, redoneStroke]);
      }
      return newRedoStack;
    });
  }, [redoStack.length]);

  const addTextElement = (x?: number, y?: number) => {
    // If x,y provided (from click), use them. Otherwise center.
    const rawX = x !== undefined ? x : (window.innerWidth / 2 - camera.x) / camera.z;
    const rawY = y !== undefined ? y : (window.innerHeight / 2 - camera.y) / camera.z;

    const newText: TextElement = {
      id: Date.now().toString(),
      text: '',
      x: rawX,
      y: rawY,
      fontSize: activeFontSize,
      fontFamily: activeFontFamily,
      isBold: activeIsBold,
      isItalic: activeIsItalic,
      textAlign: activeTextAlign,
      color: activeColor === 'var(--bg-color)' ? (isDarkMode ? '#ffffff' : '#000000') : activeColor
    };
    setTextElements(prev => [...prev, newText]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        const maxWidth = 400;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;

        const rawX = (window.innerWidth / 2 - camera.x) / camera.z - (img.width * scale) / 2;
        const rawY = (window.innerHeight / 2 - camera.y) / camera.z - (img.height * scale) / 2;

        const newImage: ImageElement = {
          id: Date.now().toString(),
          src,
          x: rawX > 0 ? rawX : 0,
          y: rawY > 0 ? rawY : 0,
          width: img.width * scale,
          height: img.height * scale
        };
        setImageElements(prev => [...prev, newImage]);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to get safe filename
  const getSafeFileName = (extension: string, prefix: string = 'tnotes') => {
    const activeNote = notes.find(n => n.id === activeNoteId);
    let title = activeNote?.title || 'not';
    // Remove non-ASCII and special chars, replace spaces with underscores
    const safeTitle = title.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9-_]/gi, "");
    const date = new Date().toISOString().slice(0, 10);
    return `${prefix}-${safeTitle || 'export'}-${date}.${extension}`;
  };

  const handleExport = async () => {
    if (!containerRef.current) return;

    try {
      const previousSelection = selectedElements;
      setSelectedElements({ strokes: [], texts: [] });
      await new Promise(resolve => setTimeout(resolve, 50));

      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: pageColor !== 'var(--bg-color)' ? pageColor : (isDarkMode ? '#000000' : '#ffffff'),
        scale: 2,
        useCORS: true,
        ignoreElements: (element) => {
          return element.classList.contains('toolbar') || element.classList.contains('settings-panel') || element.classList.contains('sidebar');
        }
      });

      setSelectedElements(previousSelection);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = getSafeFileName('png', 'export');
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handlePdfExport = async () => {
    if (!containerRef.current || pages.length === 0) return;

    try {
      setIsExporting(true);
      setExportProgress({ current: 0, total: pages.length });
      
      const originalIndex = currentPageIndex;
      const format = pageSize === 'infinity' ? 'a4' : pageSize.toLowerCase();
      const pdf = new jsPDF({
        orientation: pageSize !== 'infinity' && PAPER_SIZES[pageSize].width > PAPER_SIZES[pageSize].height ? 'l' : 'p',
        unit: 'px',
        format: format as any
      });

      const previousSelection = selectedElements;
      setSelectedElements({ strokes: [], texts: [] });

      for (let i = 0; i < pages.length; i++) {
        setExportProgress({ current: i + 1, total: pages.length });
        
        // Switch page
        handlePageChange(i);
        // Wait for rendering and image loading
        await new Promise(resolve => setTimeout(resolve, 300));

        const canvas = await html2canvas(containerRef.current, {
          backgroundColor: pageColor !== 'var(--bg-color)' ? pageColor : (isDarkMode ? '#000000' : '#ffffff'),
          scale: 2,
          useCORS: true,
          ignoreElements: (element) => {
            return (
              element.classList.contains('toolbar') || 
              element.classList.contains('settings-panel') || 
              element.classList.contains('sidebar') ||
              element.classList.contains('page-navigation-container')
            );
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const orientation = pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight() ? 'l' : 'p';
        if (i > 0) pdf.addPage(format as any, orientation);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      setSelectedElements(previousSelection);
      // Restore original page
      handlePageChange(originalIndex);

      pdf.save(getSafeFileName('pdf'));
    } catch (error) {
      console.error('PDF export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWordExport = async () => {
    if (!containerRef.current || pages.length === 0) return;
    try {
      setIsExporting(true);
      setExportProgress({ current: 0, total: pages.length });
      
      const originalIndex = currentPageIndex;
      const images: Uint8Array[] = [];
      const dimensions = PAPER_SIZES[pageSize === 'infinity' ? 'A4' : pageSize];
      const previousSelection = selectedElements;
      setSelectedElements({ strokes: [], texts: [] });

      for (let i = 0; i < pages.length; i++) {
        setExportProgress({ current: i + 1, total: pages.length });
        handlePageChange(i);
        await new Promise(resolve => setTimeout(resolve, 300));

        const canvasImage = await html2canvas(containerRef.current, {
          backgroundColor: pageColor !== 'var(--bg-color)' ? pageColor : (isDarkMode ? '#000000' : '#ffffff'),
          scale: 2,
          useCORS: true,
          ignoreElements: (element) => {
            return (
              element.classList.contains('toolbar') || 
              element.classList.contains('settings-panel') || 
              element.classList.contains('sidebar') ||
              element.classList.contains('page-navigation-container')
            );
          }
        });

        const imgData = canvasImage.toDataURL('image/png');
        const base64Data = imgData.split(',')[1];
        images.push(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)));
      }

      setSelectedElements(previousSelection);
      handlePageChange(originalIndex);

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: notes.find(n => n.id === activeNoteId)?.title || "TNotes",
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            ...images.map(binaryData => new Paragraph({
              children: [
                new ImageRun({
                  data: binaryData,
                  transformation: {
                    width: 600,
                    height: (600 * dimensions.height) / dimensions.width,
                  },
                  type: 'png'
                } as any),
              ],
            })),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, getSafeFileName('docx'));
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleJsonExport = () => {
    // Sync current state to pages array before export
    const updatedPages = [...pages];
    updatedPages[currentPageIndex] = {
      strokes: [...strokes],
      textElements: [...textElements],
      imageElements: [...imageElements]
    };

    const data: NoteData = {
      pages: updatedPages,
      currentPageIndex,
      pageSettings: { pageSize, pagePattern, pageColor }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, getSafeFileName('json', 'backup'));
  };

  // Calculate paper scale factor relative to A4 (794px width)
  const getPaperScale = () => {
    if (pageSize === 'infinity') return 1;
    return PAPER_SIZES[pageSize].width / 794;
  };
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });

  // Update container offset on resize or sidebar toggle
  useLayoutEffect(() => {
    const updateOffset = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerOffset({ x: rect.left, y: rect.top });
      }
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, [isSidebarOpen]);

  const paperScale = getPaperScale();


  const handleCanvasClick = (e: React.PointerEvent) => {
    if (activeTool !== 'text') return;
    if (!(e.target as HTMLElement).classList.contains('canvas-view')) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate logical x,y directly to avoid stale mousePos
    let x, y;
    if (pageSize !== 'infinity') {
      x = (e.clientX - rect.left) / (camera.z * paperScale);
      y = (e.clientY - rect.top) / (camera.z * paperScale);
    } else {
      x = (e.clientX - rect.left - camera.x) / camera.z;
      y = (e.clientY - rect.top - camera.y) / camera.z;
    }

    // Snapping in world coordinates
    const currentYSpacing = pagePattern === 'lines' ? LINE_SPACING : GRID_SIZE;
    const snappedY = Math.ceil(y / currentYSpacing) * currentYSpacing;
    const snappedX = pagePattern === 'grid'
      ? Math.round(x / GRID_SIZE) * GRID_SIZE
      : x;

    addTextElement(snappedX, snappedY);
  };

  const handleSelection = (bounds: { x: number, y: number, width: number, height: number } | null) => {
    if (!bounds) {
      setSelectedElements({ strokes: [], texts: [] });
      return;
    }

    // Find strokes in rect
    const selectedStrokes = strokes.filter(s => isStrokeInRect(s, bounds)).map(s => s.id);

    // Find text elements whose (x,y) overlaps the rect
    // Simple point check since text bounding boxes are variable before render
    const selectedTexts = textElements.filter(t => {
      return t.x >= bounds.x && t.x <= bounds.x + bounds.width &&
        t.y >= bounds.y && t.y <= bounds.y + bounds.height;
    }).map(t => t.id);

    setSelectedElements({ strokes: selectedStrokes, texts: selectedTexts });
  };

  const handleSelectedMove = (dx: number, dy: number) => {
    // Update strokes
    setStrokes(prev => prev.map(s => {
      if (selectedElements.strokes.includes(s.id)) {
        return {
          ...s,
          points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))
        };
      }
      return s;
    }));

    // Update text elements
    setTextElements(prev => prev.map(t => {
      if (selectedElements.texts.includes(t.id)) {
        return { ...t, x: t.x + dx, y: t.y + dy };
      }
      return t;
    }));
  };

  const handleSelectedScale = (sx: number, sy: number, originX: number, originY: number) => {
    // Update strokes
    setStrokes(prev => prev.map(s => {
      if (selectedElements.strokes.includes(s.id)) {
        return {
          ...s,
          points: s.points.map(p => ({
            ...p,
            x: originX + (p.x - originX) * sx,
            y: originY + (p.y - originY) * sy
          }))
        };
      }
      return s;
    }));

    // Update text elements
    setTextElements(prev => prev.map(t => {
      if (selectedElements.texts.includes(t.id)) {
        return {
          ...t,
          x: originX + (t.x - originX) * sx,
          y: originY + (t.y - originY) * sy,
          fontSize: Math.max(8, t.fontSize * ((sx + sy) / 2))
        };
      }
      return t;
    }));
  };

  const handleSelectedDelete = () => {
    setStrokes(prev => prev.filter(s => !selectedElements.strokes.includes(s.id)));
    setTextElements(prev => prev.filter(t => !selectedElements.texts.includes(t.id)));
    setSelectedElements({ strokes: [], texts: [] });
  };


  const handleMouseMove = (e: React.PointerEvent) => {
    const { x: cx, y: cy, z: cz } = camera;

    // Exact scale factors relative to A4
    const baseW = PAPER_SIZES['A4'].width;
    const baseH = PAPER_SIZES['A4'].height;
    const currW = pageSize !== 'infinity' ? PAPER_SIZES[pageSize as keyof typeof PAPER_SIZES].width : window.innerWidth;
    const currH = pageSize !== 'infinity' ? PAPER_SIZES[pageSize as keyof typeof PAPER_SIZES].height : (window.innerHeight - 50);

    const scaleX = pageSize !== 'infinity' ? currW / baseW : 1;
    const scaleY = pageSize !== 'infinity' ? currH / baseH : 1;

    let x, y;
    if (pageSize !== 'infinity') {
      // Use camera state as absolute origin
      // cx/cy are the visual screen positions of the paper top-left
      x = (e.clientX - cx) / (cz * scaleX);
      y = (e.clientY - cy) / (cz * scaleY);
    } else {
      // For infinite canvas, cx/cy are panning offsets
      x = (e.clientX - cx) / cz;
      y = (e.clientY - cy) / cz;
    }
    setMousePos({ x, y });
  };

  const updateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteTextElement = (id: string) => {
    setTextElements(prev => prev.filter(el => el.id !== id));
  };

  // Setup Wheel Event for Pan & Zoom
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Zooming with pinch (trackpad) or pressing Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        setCamera(c => {
          // Adjust zoom multiplier for smoothness
          const zoomDelta = Math.exp(-e.deltaY / 200);
          const newZ = Math.min(Math.max(c.z * zoomDelta, 0.1), 10); // Clamped between 0.1x to 10x

          // Better zoom math: zoom towards the mouse cursor
          return {
            x: e.clientX - (e.clientX - c.x) * (newZ / c.z),
            y: e.clientY - (e.clientY - c.y) * (newZ / c.z),
            z: newZ
          };
        });
      } else {
        // Panning (two finger scroll or mouse wheel)
        setCamera(c => ({
          ...c,
          x: c.x - e.deltaX,
          y: c.y - e.deltaY
        }));
      }
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, []);

  // Auto-center planner when layout changes
  useEffect(() => {
    let width = window.innerWidth;
    let height = 50;

    if (pageSize !== 'infinity') {
      width = PAPER_SIZES[pageSize].width;
    } else if (['daily', 'weekly', 'monthly', 'yearly'].includes(pagePattern)) {
      width = pagePattern === 'daily' ? 800 : 1200;
    }

    setCamera({
      x: (window.innerWidth - width) / 2,
      y: height,
      z: 1
    });
  }, [pagePattern, pageSize]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          setActivePopover(null);
        }
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // Undo/Redo
      if (isMod && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if (isMod && e.key.toLowerCase() === 'y') {
        redo();
        e.preventDefault();
      }

      // Tool Switching
      if (!isMod) {
        switch (e.key.toLowerCase()) {
          case 'v': setActiveTool('select'); setActivePopover(null); setIsSmartPenActive(false); break;
          case 'p': setActiveTool('ballpoint'); setActivePopover(null); break;
          case 'h': setActiveTool('highlighter'); setActivePopover(null); break;
          case 'e': setActiveTool('eraser'); setActivePopover(null); break;
          case 't': setActiveTool('text'); setActivePopover(null); break;
          case 'r': setActiveTool('rectangle'); setActivePopover(null); break;
          case 'c': setActiveTool('circle'); setActivePopover(null); break;
          case 'l': setActiveTool('line'); setActivePopover(null); break;
          case 'a': setActiveTool('arrow'); setActivePopover(null); break;
        }
      }

      // Popover Management
      if (e.key === 'Escape') {
        setActivePopover(null);
        setSelectedElements({ strokes: [], texts: [] });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="app-container">
      <Sidebar
        notes={notes}
        activeNoteId={activeNoteId}
        onSelectNote={setActiveNoteId}
        onNewNote={handleNewNote}
        onNewNotebook={() => { setIsNoteColorPickerOpen(true); }}
        onDeleteNote={handleDeleteRequest}
        onRenameNote={handleRenameNote}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      {/* Canvas Area with Pattern Background */}
      <div
        ref={containerRef}
        className={`canvas-container page-layer pattern-${pagePattern} canvas-view`}
        onPointerDown={handleCanvasClick}
        onPointerMove={handleMouseMove}
        style={{
          backgroundColor: pageColor !== 'var(--bg-color)' ? pageColor : 'var(--page-color)',
          width: pageSize !== 'infinity' ? `${PAPER_SIZES[pageSize].width}px` : '100vw',
          height: pageSize !== 'infinity' ? `${PAPER_SIZES[pageSize].height}px` : '100vh',
          position: pageSize === 'infinity' ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          boxShadow: pageSize !== 'infinity' ? '0 0 40px rgba(0,0,0,0.1)' : 'none',
          // ONLY apply container transform for FIXED pages (A4, etc.)
          // Infinite mode stays fixed at 100vw/100vh and handles pan/zoom internally
          transform: pageSize !== 'infinity' ? `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})` : 'none',
          transformOrigin: 'top left',
          margin: 0,
          backgroundImage: (() => {
            const isDarkPage = pageColor === '#2a2a2a' || pageColor === '#1a1c23' || (pageColor === 'var(--bg-color)' && isDarkMode);
            const patternColor = isDarkPage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

            if (pagePattern === 'daily') {
              const [y, m, d] = selectedDate.split('-').map(Number);
              return `url("${patterns.getDaily(new Date(y, m - 1, d), patternColor)}")`;
            }
            if (pagePattern === 'weekly') return `url("${patterns.getWeekly(patternColor)}")`;
            if (pagePattern === 'monthly') return `url("${patterns.getMonthly(patternColor)}")`;
            if (pagePattern === 'yearly') return `url("${patterns.getYearly(patternColor)}")`;

            if (pagePattern === 'grid') {
              return `linear-gradient(to right, ${patternColor} 1px, transparent 1px), linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)`;
            }
            if (pagePattern === 'lines') {
              return `linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)`;
            }
            if (pagePattern === 'dots') {
              return `radial-gradient(${patternColor} 1.5px, transparent 1.5px)`;
            }

            return 'none';
          })(),
          backgroundPosition: (() => {
            if (pageSize === 'infinity') return `${camera.x - containerOffset.x}px ${camera.y - containerOffset.y}px`;
            if (['daily', 'weekly', 'monthly', 'yearly'].includes(pagePattern)) return 'center';
            return '0 0';
          })(),
          backgroundSize: (() => {
            if (['daily', 'weekly', 'monthly', 'yearly'].includes(pagePattern)) {
              return 'contain';
            }
            // SCALE THE PATTERN BY PAPERSCALE TO MATCH A4 DENSITY
            const s = pageSize !== 'infinity' ? paperScale : camera.z;
            const gx = GRID_SIZE * s;
            const gy = (pagePattern === 'lines' ? LINE_SPACING : GRID_SIZE) * s;
            return `${gx}px ${gy}px`;
          })(),
          backgroundRepeat: ['daily', 'weekly', 'monthly', 'yearly'].includes(pagePattern) ? 'no-repeat' : 'repeat',
          zIndex: 1,
          touchAction: 'none'
        } as React.CSSProperties}>
        {/* Snap Ghost Cursor for Text Tool */}
        {activeTool === 'text' && (() => {
          // Snap in logical coordinates
          // Use Math.ceil so clicking in a row targets the line BELOW (the writing line)
          const currentYSpacing = pagePattern === 'lines' ? LINE_SPACING : GRID_SIZE;
          const sx = (pagePattern === 'grid' ? Math.round(mousePos.x / GRID_SIZE) * GRID_SIZE : mousePos.x);
          const sy = Math.ceil(mousePos.y / currentYSpacing) * currentYSpacing;

          // Position relative to the container (which already handles camera offsets via transform)
          const isFixed = pageSize !== 'infinity';
          const left = isFixed ? (sx * paperScale) : (sx * camera.z + (camera.x - containerOffset.x));
          // Match TextTool's fixed pixel offset for stable baseline
          const top = isFixed
            ? ((sy * paperScale) - (27 * paperScale))
            : ((sy * camera.z + (camera.y - containerOffset.y)) - (27 * camera.z));

          // Coordinate height exactly with TextTool line-height
          const h = 40 * (isFixed ? paperScale : camera.z);

          return (
            <div style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: '2px',
              height: `${h}px`,
              backgroundColor: 'var(--accent-color)',
              opacity: 0.6,
              pointerEvents: 'none',
              transform: 'none',
              boxShadow: '0 0 8px var(--accent-color)',
              zIndex: 10
            }} />
          );
        })()}

        <CanvasBoard
          tool={activeTool}
          color={activeColor}
          size={strokeSize}
          camera={camera}
          paperScale={paperScale}
          isFixed={pageSize !== 'infinity'}
          paperWidth={pageSize !== 'infinity' ? PAPER_SIZES[pageSize as keyof typeof PAPER_SIZES].width : undefined}
          paperHeight={pageSize !== 'infinity' ? PAPER_SIZES[pageSize as keyof typeof PAPER_SIZES].height : undefined}
          strokes={strokes}
          onStrokeComplete={handleStrokeComplete}
          onSelection={handleSelection}
        />
        <TextTool
          elements={textElements}
          onUpdate={updateTextElement}
          onDelete={deleteTextElement}
          camera={camera}
          paperScale={paperScale}
          containerOffset={containerOffset}
          isFixed={pageSize !== 'infinity'}
        />
        <ImageTool
          elements={imageElements}
          onUpdate={(id, updates) => setImageElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))}
          onDelete={(id) => setImageElements(prev => prev.filter(el => el.id !== id))}
          camera={camera}
          paperScale={paperScale}
          containerOffset={containerOffset}
          isFixed={pageSize !== 'infinity'}
        />
        {(selectedElements.strokes.length > 0 || selectedElements.texts.length > 0) && (
          <SelectionOverlay
            selectedStrokes={selectedElements.strokes}
            selectedTexts={selectedElements.texts}
            strokes={strokes}
            textElements={textElements}
            camera={camera}
            paperScale={paperScale}
            onMove={handleSelectedMove}
            onScale={handleSelectedScale}
            onDelete={handleSelectedDelete}
            onConvertToText={handleConvertStrokesToText}
            onClearSelection={() => {
              setSelectedElements({ strokes: [], texts: [] });
            }}
            containerOffset={containerOffset}
            isFixed={pageSize !== 'infinity'}
          />
        )}
      </div>

      {/* Minimap Widget */}
      <Minimap
        camera={camera}
        setCamera={setCamera}
        strokes={strokes}
        isFixed={pageSize !== 'infinity'}
        paperSize={pageSize !== 'infinity' ? PAPER_SIZES[pageSize as keyof typeof PAPER_SIZES] : undefined}
      />

      {/* DRAGGABLE MENU BAR WITH HIDDEN TOOLBAR */}
      <div
        className="menu-bar-container"
        style={{
          left: `${menuBarPosition.x}px`,
          top: `${menuBarPosition.y}px`,
        }}
      >
        {/* Drag Handle & Toggle */}
        <div
          className="draggable-handle"
          onPointerDown={handleMenuBarPointerDown}
          onPointerMove={handleMenuBarPointerMove}
          onPointerUp={handleMenuBarPointerUp}
          onPointerCancel={handleMenuBarPointerUp}
          onClick={() => setIsToolbarOpen(!isToolbarOpen)}
        >
          <GripHorizontal size={22} strokeWidth={2.5} />
        </div>

        {/* Toolbar */}
        <div className={`toolbar ${!isToolbarOpen ? 'hidden' : ''}`}>

          {/* Page & Layout Settings Popover */}
          <div className="tool-btn-wrapper">
            <button className={`tool-btn ${activePopover === 'page' ? 'active' : ''}`} title="Sayfa Ayarları" onClick={() => setActivePopover(activePopover === 'page' ? null : 'page')}>
              <LayoutDashboard size={22} strokeWidth={2.5} />
            </button>
          </div>

          <div className="divider" />
          <button className="tool-btn" onClick={undo} disabled={strokes.length === 0}>
            <RotateCcw size={22} strokeWidth={2.5} />
          </button>
          <button className="tool-btn" onClick={redo} disabled={redoStack.length === 0}>
            <RotateCw size={22} strokeWidth={2.5} />
          </button>

          <div className="divider" />

          {/* Drawing Tools Group */}
          <button className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} title="Seçim (V)" onClick={() => { setActiveTool('select'); setIsSmartPenActive(false); setActivePopover(null); }}>
            <MousePointer2 size={22} strokeWidth={2.5} />
          </button>
          <button className={`tool-btn ${activeTool === 'ballpoint' ? 'active' : ''}`} title="Tükenmez Kalem (P)" onClick={() => { setActiveTool('ballpoint'); setActivePopover(null); }}>
            <PenTool size={22} strokeWidth={2.5} />
          </button>
          <button className={`tool-btn ${activeTool === 'highlighter' ? 'active' : ''}`} title="Fosforlu Kalem (H)" onClick={() => { setActiveTool('highlighter'); setActivePopover(null); }}>
            <Highlighter size={22} strokeWidth={1.5} />
          </button>
          <button className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`} title="Silgi (E)" onClick={() => { setActiveTool('eraser'); setActivePopover(null); }}>
            <Eraser size={22} strokeWidth={2.5} />
          </button>

          {/* Text Tool & Popover */}
          <div className="tool-btn-wrapper">
            <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} title="Yazı (Tekrar tıklayarak ayarları açın)" onClick={() => {
              if (activeTool === 'text') {
                setActivePopover(activePopover === 'text' ? null : 'text');
              } else {
                setActiveTool('text');
                addTextElement();
                setActivePopover(null);
              }
            }}>
              <Type size={22} strokeWidth={2.5} />
            </button>
          </div>

          {/* Shapes Tool & Popover */}
          <div className="tool-btn-wrapper">
            <button className={`tool-btn ${['rectangle', 'circle', 'line', 'arrow'].includes(activeTool) ? 'active' : ''}`} title="Şekiller" onClick={() => setActivePopover(activePopover === 'shapes' ? null : 'shapes')}>
              <Square size={20} strokeWidth={2.5} />
            </button>
          </div>

          <button className="tool-btn" title="Resim Ekle" onClick={() => { fileInputRef.current?.click(); setActivePopover(null); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
          </button>
          <button className={`tool-btn ${isSmartPenActive ? 'active' : ''}`} title="Akıllı Kalem (El Yazısı Tanıma)" onClick={() => { setIsSmartPenActive(!isSmartPenActive); if (!isSmartPenActive) setActiveTool('ballpoint'); setActivePopover(null); }}>
            <Sparkles size={22} strokeWidth={2.5} className={isHtrProcessing ? 'spin-slow' : ''} />
          </button>

          <div className="divider" />

          {/* Popover for Colors */}
          <div className="tool-btn-wrapper">
              <button
                className={`tool-btn ${activePopover === 'color' ? 'active' : ''}`}
                title="Renk Seçimi"
                onClick={() => setActivePopover(activePopover === 'color' ? null : 'color')}
              >
                <Palette size={22} strokeWidth={2.5} />
              </button>
          </div>

          <div className="divider" />

          {/* Popover for Stroke Size */}
          <div className="tool-btn-wrapper">
              <button
                className={`tool-btn ${activePopover === 'size' ? 'active' : ''}`}
                title="Kalınlık Ayarı"
                onClick={() => setActivePopover(activePopover === 'size' ? null : 'size')}
              >
                <div style={{ width: strokeSize + 2, height: strokeSize + 2, borderRadius: '50%', backgroundColor: 'currentColor' }} />
              </button>
          </div>

          <div className="divider" />

          {/* System Group */}
          <button className="tool-btn" title={isDarkMode ? 'Açık Tema' : 'Koyu Tema'} onClick={() => { toggleTheme(); setActivePopover(null); }}>
            {isDarkMode ? <Sun size={22} strokeWidth={2.5} /> : <Moon size={22} strokeWidth={2.5} />}
          </button>
          <button
            className={`tool-btn ${activePopover === 'export' ? 'active' : ''}`}
            title="Dışa Aktar"
            onClick={() => setActivePopover(activePopover === 'export' ? null : 'export')}
          >
            <Share2 size={22} strokeWidth={2.5} />
          </button>

          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
        </div>
      </div>
      {/* POPOVERS (Rendered outside tracking context so position: fixed works properly) */}
      {/* POPOVERS (Rendered outside tracking context so position: fixed works properly) */}
      {activePopover && (
        <div className="modal-backdrop" onClick={() => setActivePopover(null)}>
          {/* 1. Page/Layout Popover */}
          {activePopover === 'page' && (
            <div className="tool-popover" style={{ padding: '20px', gap: '20px', width: '320px' }} onClick={(e) => e.stopPropagation()}>
              {/* Kağıt Boyutu */}
              <div className="settings-section">
                <span className="settings-title">Kağıt Boyutu</span>
                <div className="pattern-selector">
                  <button className={`pattern-btn ${pageSize === 'A2' ? 'active' : ''}`} onClick={() => setPageSize('A2')}>A2</button>
                  <button className={`pattern-btn ${pageSize === 'A3' ? 'active' : ''}`} onClick={() => setPageSize('A3')}>A3</button>
                  <button className={`pattern-btn ${pageSize === 'A4' ? 'active' : ''}`} onClick={() => setPageSize('A4')}>A4</button>
                  <button className={`pattern-btn ${pageSize === 'A5' ? 'active' : ''}`} onClick={() => setPageSize('A5')}>A5</button>
                  <button className={`pattern-btn ${pageSize === 'infinity' ? 'active' : ''}`} onClick={() => setPageSize('infinity')} style={{ height: '36px', borderRadius: '10px', display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}><Square size={14} /> <span>Sonsuz</span></button>
                </div>
              </div>
              {/* Desen */}
              <div className="settings-section">
                <span className="settings-title">Desen</span>
                <div className="pattern-selector" style={{ display: 'flex', gap: '4px' }}>
                  <button className={`pattern-btn ${pagePattern === 'grid' ? 'active' : ''}`} onClick={() => setPagePattern('grid')} style={{ height: '40px', borderRadius: '10px', flex: 1 }}><Grid size={22} strokeWidth={2.5} /></button>
                  <button className={`pattern-btn ${pagePattern === 'lines' ? 'active' : ''}`} onClick={() => setPagePattern('lines')} style={{ height: '40px', borderRadius: '10px', flex: 1 }}><AlignJustify size={22} strokeWidth={2.5} /></button>
                  <button className={`pattern-btn ${pagePattern === 'dots' ? 'active' : ''}`} onClick={() => setPagePattern('dots')} style={{ height: '40px', borderRadius: '10px', flex: 1 }}><Circle size={22} strokeWidth={2.5} /></button>
                  <button className={`pattern-btn ${pagePattern === 'blank' ? 'active' : ''}`} onClick={() => setPagePattern('blank')} style={{ height: '40px', borderRadius: '10px', flex: 1 }}><Square size={22} strokeWidth={2.5} /></button>
                </div>
              </div>

              <div className="divider" style={{ width: '100%', height: '1px' }} />

              <button 
                className="pattern-btn" 
                style={{ 
                  width: '100%', 
                  height: '44px', 
                  borderRadius: '12px', 
                  color: '#ff3b30', 
                  backgroundColor: 'rgba(255, 59, 48, 0.05)',
                  border: '1px solid rgba(255, 59, 48, 0.1)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onClick={() => {
                  setIsClearPageModalOpen(true);
                  setActivePopover(null);
                }}
              >
                <Eraser size={18} />
                Sayfayı Temizle
              </button>

              {/* Arka Plan Rengi */}
              <div className="settings-section">
                <span className="settings-title">Arka Plan Rengi</span>
                <div className="color-selector">
                  {PAGE_COLORS.map(color => (
                    <button
                      key={color}
                      className={`color-btn ${pageColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setPageColor(color)}
                    />
                  ))}
                </div>
              </div>
              {/* Planlayıcı */}
              <div className="settings-section">
                <span className="settings-title">Planlayıcı</span>
                <div className="pattern-selector" style={{ display: 'flex', gap: '4px' }}>
                  <button className={`pattern-btn ${pagePattern === 'daily' ? 'active' : ''}`} onClick={() => setPagePattern('daily')} style={{ flex: 1, height: '40px', borderRadius: '10px' }}><CalendarDays size={22} strokeWidth={2.5} /></button>
                  <button className={`pattern-btn ${pagePattern === 'weekly' ? 'active' : ''}`} onClick={() => setPagePattern('weekly')} style={{ flex: 1, height: '40px', borderRadius: '10px' }}><ListTodo size={22} strokeWidth={2.5} /></button>
                  <button className={`pattern-btn ${pagePattern === 'monthly' ? 'active' : ''}`} onClick={() => setPagePattern('monthly')} style={{ flex: 1, height: '40px', borderRadius: '10px' }}><CalendarCheck size={22} strokeWidth={2.5} /></button>
                  <button className={`pattern-btn ${pagePattern === 'yearly' ? 'active' : ''}`} onClick={() => setPagePattern('yearly')} style={{ flex: 1, height: '40px', borderRadius: '10px' }}><FileSpreadsheet size={22} strokeWidth={2.5} /></button>
                </div>
                {pagePattern === 'daily' && (
                  <input type="date" className="date-picker-input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ marginTop: '8px' }} />
                )}
              </div>
            </div>
          )}

          {/* 2. Text Popover */}
          {activePopover === 'text' && activeTool === 'text' && (
            <div className="tool-popover" style={{ padding: '16px', gap: '16px', minWidth: '220px' }} onClick={(e) => e.stopPropagation()}>
              <span className="settings-title" style={{ marginBottom: '-8px' }}>Yazı Tipi</span>
              <div className="pattern-selector" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button className={`pattern-btn ${activeFontFamily === "'Inter', sans-serif" ? 'active' : ''}`} style={{ flex: '1 1 40%', height: '32px', fontSize: '12px', fontFamily: 'Inter' }} onClick={() => setActiveFontFamily("'Inter', sans-serif")}>Inter</button>
                <button className={`pattern-btn ${activeFontFamily === "'Gloria Hallelujah', cursive" ? 'active' : ''}`} style={{ flex: '1 1 40%', height: '32px', fontSize: '12px', fontFamily: 'Gloria Hallelujah' }} onClick={() => setActiveFontFamily("'Gloria Hallelujah', cursive")}>Gloria</button>
                <button className={`pattern-btn ${activeFontFamily === "'Cormorant Garamond', serif" ? 'active' : ''}`} style={{ flex: '1 1 40%', height: '32px', fontSize: '12px', fontFamily: 'Cormorant Garamond' }} onClick={() => setActiveFontFamily("'Cormorant Garamond', serif")}>Garamond</button>
                <button className={`pattern-btn ${activeFontFamily === "'Space Grotesk', sans-serif" ? 'active' : ''}`} style={{ flex: '1 1 40%', height: '32px', fontSize: '12px', fontFamily: 'Space Grotesk' }} onClick={() => setActiveFontFamily("'Space Grotesk', sans-serif")}>Space</button>
              </div>

              <span className="settings-title" style={{ marginBottom: '8px' }}>Yazı Boyutu</span>
              <div className="pattern-selector" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[9, 12, 14, 16, 18, 20, 24].map(size => (
                  <button
                    key={size}
                    className={`pattern-btn ${activeFontSize === size ? 'active' : ''}`}
                    style={{ flex: '1 1 30%', height: '32px', fontSize: '12px' }}
                    onClick={() => setActiveFontSize(size)}
                  >
                    {size}px
                  </button>
                ))}
              </div>

              <span className="settings-title" style={{ marginBottom: '8px' }}>Stil & Hizalama</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="switch-container">
                  <span className="switch-label-text">Kalın</span>
                  <label className="switch">
                    <input type="checkbox" checked={activeIsBold} onChange={(e) => setActiveIsBold(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </label>
                <label className="switch-container">
                  <span className="switch-label-text">İtalik</span>
                  <label className="switch">
                    <input type="checkbox" checked={activeIsItalic} onChange={(e) => setActiveIsItalic(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </label>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <button className={`pattern-btn ${activeTextAlign === 'left' ? 'active' : ''}`} style={{ flex: 1, height: '32px', borderRadius: '10px' }} onClick={() => setActiveTextAlign('left')}><AlignLeft size={16} /></button>
                  <button className={`pattern-btn ${activeTextAlign === 'center' ? 'active' : ''}`} style={{ flex: 1, height: '32px', borderRadius: '10px' }} onClick={() => setActiveTextAlign('center')}><AlignCenter size={16} /></button>
                  <button className={`pattern-btn ${activeTextAlign === 'right' ? 'active' : ''}`} style={{ flex: 1, height: '32px', borderRadius: '10px' }} onClick={() => setActiveTextAlign('right')}><AlignRight size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Shapes Popover */}
          {activePopover === 'shapes' && (
            <div className="tool-popover" style={{ padding: '16px', gap: '16px', minWidth: '180px' }} onClick={(e) => e.stopPropagation()}>
              <span className="settings-title">Geometrik Şekiller</span>
              <div className="pattern-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  className={`pattern-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
                  style={{ height: '48px', borderRadius: '12px' }}
                  onClick={() => { setActiveTool('rectangle'); setActivePopover(null); }}
                  title="Dikdörtgen"
                >
                  <Square size={22} strokeWidth={2.5} />
                </button>
                <button
                  className={`pattern-btn ${activeTool === 'circle' ? 'active' : ''}`}
                  style={{ height: '48px', borderRadius: '12px' }}
                  onClick={() => { setActiveTool('circle'); setActivePopover(null); }}
                  title="Daire"
                >
                  <Circle size={22} strokeWidth={2.5} />
                </button>
                <button
                  className={`pattern-btn ${activeTool === 'line' ? 'active' : ''}`}
                  style={{ height: '48px', borderRadius: '12px' }}
                  onClick={() => { setActiveTool('line'); setActivePopover(null); }}
                  title="Çizgi"
                >
                  <GripHorizontal size={22} strokeWidth={2.5} style={{ transform: 'rotate(-45deg)' }} />
                </button>
                <button
                  className={`pattern-btn ${activeTool === 'arrow' ? 'active' : ''}`}
                  style={{ height: '48px', borderRadius: '12px' }}
                  onClick={() => { setActiveTool('arrow'); setActivePopover(null); }}
                  title="Ok"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-45deg)' }}><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* 4. Color Popover */}
          {activePopover === 'color' && (
            <div className="tool-popover" style={{ padding: '16px', gap: '16px', minWidth: '280px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '-8px' }}>
                <span className="settings-title">Renk Seçimi</span>
                <button
                  className="tool-btn"
                  style={{ width: '28px', height: '28px', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  onClick={() => colorPickerRef.current?.click()}
                  title="Özel Renk Seç"
                >
                  <Palette size={16} strokeWidth={2.5} />
                </button>
                <input
                  type="color"
                  ref={colorPickerRef}
                  style={{ display: 'none' }}
                  value={activeColor.startsWith('#') ? activeColor : '#000000'}
                  onChange={(e) => setActiveColor(e.target.value)}
                />
              </div>

              <div className="color-selector" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ width: '100%', fontSize: '11px', opacity: 0.6, marginBottom: '2px' }}>Temel Renkler</div>
                {COLORS.map(color => (
                  <button
                    key={color}
                    className={`color-btn ${activeColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color, width: '24px', height: '24px', borderRadius: '50%' }}
                    onClick={() => setActiveColor(color)}
                  />
                ))}
              </div>

              <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }} />

              <div className="color-selector" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                <div style={{ width: '100%', fontSize: '11px', opacity: 0.6, marginBottom: '2px' }}>Genişletilmiş Palet</div>
                {EXTENDED_COLORS.map(color => (
                  <button
                    key={color}
                    className={`color-btn ${activeColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color, width: '20px', height: '20px', borderRadius: '4px' }}
                    onClick={() => setActiveColor(color)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 4.5 Size Popover */}
          {activePopover === 'size' && (
            <div className="tool-popover" style={{ padding: '16px', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
              <span className="settings-title" style={{ marginBottom: '-8px' }}>Kalem Kalınlığı</span>
              <div className="size-selector">
                {[2, 4, 6, 8, 12].map(s => (
                  <button key={s} className={`size-btn ${strokeSize === s ? 'active' : ''}`} onClick={() => setStrokeSize(s)}>
                    <div style={{ width: s + 4, height: s + 4, borderRadius: '50%', background: activeColor === 'var(--bg-color)' ? 'var(--text-color)' : activeColor }} />
                  </button>
                ))}
              </div>

              {isSmartPenActive && (activeTool === 'ballpoint' || activeTool === 'highlighter') && (
                <>
                  <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }} />
                  <span className="settings-title" style={{ marginBottom: '-8px' }}>HTR Dili</span>
                  <div className="pattern-selector" style={{ display: 'flex', gap: '4px' }}>
                    <button className={`pattern-btn ${htrLanguage === 'tr' ? 'active' : ''}`} style={{ flex: 1, height: '32px', fontSize: '12px' }} onClick={() => setHtrLanguage('tr')}>TR</button>
                    <button className={`pattern-btn ${htrLanguage === 'en' ? 'active' : ''}`} style={{ flex: 1, height: '32px', fontSize: '12px' }} onClick={() => setHtrLanguage('en')}>EN</button>
                    <button className={`pattern-btn ${htrLanguage === 'de' ? 'active' : ''}`} style={{ flex: 1, height: '32px', fontSize: '12px' }} onClick={() => setHtrLanguage('de')}>DE</button>
                  </div>
                </>
              )}
            </div>
          )}
          {/* 5. Export Popover */}
          {activePopover === 'export' && (
            <div className="tool-popover" style={{ padding: '16px', gap: '12px', minWidth: '240px' }} onClick={(e) => e.stopPropagation()}>
              <span className="settings-title" style={{ marginBottom: '4px' }}>Dışa Aktarma Seçenekleri</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="pattern-btn"
                  style={{ height: '48px', borderRadius: '12px', justifyContent: 'flex-start', padding: '0 16px', gap: '12px', width: '100%' }}
                  onClick={() => { handleExport(); setActivePopover(null); }}
                >
                  <ImageIcon size={20} strokeWidth={2} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Resim Olarak</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Yüksek kaliteli PNG dosyası</span>
                  </div>
                </button>
                <button
                  className="pattern-btn"
                  style={{ height: '48px', borderRadius: '12px', justifyContent: 'flex-start', padding: '0 16px', gap: '12px', width: '100%' }}
                  onClick={() => { handlePdfExport(); setActivePopover(null); }}
                >
                  <FileDown size={20} strokeWidth={2} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Belge Olarak (PDF)</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Yazdırılabilir PDF dokümanı</span>
                  </div>
                </button>
                <button
                  className="pattern-btn"
                  style={{ height: '48px', borderRadius: '12px', justifyContent: 'flex-start', padding: '0 16px', gap: '12px', width: '100%' }}
                  onClick={() => { handleWordExport(); setActivePopover(null); }}
                >
                  <FileSpreadsheet size={20} strokeWidth={2} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Word Belgesi (.docx)</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Microsoft Word formatı</span>
                  </div>
                </button>
                <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }} />
                <button
                  className="pattern-btn"
                  style={{ height: '48px', borderRadius: '12px', justifyContent: 'flex-start', padding: '0 16px', gap: '12px', width: '100%' }}
                  onClick={() => { handleJsonExport(); setActivePopover(null); }}
                >
                  <Download size={20} strokeWidth={2} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Yedek Olarak (JSON)</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Not verilerini yedekle</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDeleteNote}
        title={noteToDelete?.title || ""}
      />

      {/* Notebook Color Picker Modal */}
      {isNoteColorPickerOpen && (
        <div className="modal-backdrop" onClick={() => setIsNoteColorPickerOpen(false)} style={{ zIndex: 20000 }}>
          <div className="tool-popover" style={{ padding: '24px', gap: '20px', width: '320px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="settings-title" style={{ margin: 0 }}>Defter Kapak Rengi Seçin</span>
              <button 
                onClick={() => setIsNoteColorPickerOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-color)', opacity: 0.5, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="color-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {COLORS.map(color => (
                <button
                  key={color}
                  className="color-btn"
                  style={{ 
                    backgroundColor: color, 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  onClick={() => handleNewNotebook(color)}
                />
              ))}
            </div>

            <p style={{ fontSize: '12px', opacity: 0.6, margin: 0, textAlign: 'center' }}>
              Defteriniz seçtiğiniz renkteki kapağıyla listelenecektir.
            </p>
          </div>
        </div>
      )}

      {/* Page Navigation Controls */}
      {activeNoteId && (
        <PageNavigation 
          currentPage={currentPageIndex}
          totalPages={pages.length}
          onPageChange={handlePageChange}
          onAddPage={handleAddPage}
        />
      )}

      {/* Clear Page Modal */}
      <ClearPageModal 
        isOpen={isClearPageModalOpen}
        onClose={() => setIsClearPageModalOpen(false)}
        onConfirm={() => {
          setStrokes([]);
          setTextElements([]);
          setImageElements([]);
        }}
      />

      {/* Export Progress Overlay */}
      {isExporting && (
        <div className="modal-backdrop" style={{ zIndex: 30000, backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="tool-popover" style={{ padding: '32px', gap: '20px', width: '300px', alignItems: 'center' }}>
            <div className="loading-spinner" style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid rgba(255,255,255,0.1)', 
              borderTopColor: 'var(--text-color)', 
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ textAlign: 'center' }}>
              <span className="settings-title" style={{ margin: '0 0 8px 0' }}>Dışa Aktarılıyor...</span>
              <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>
                Sayfa {exportProgress.current} / {exportProgress.total} hazırlanıyor
              </p>
            </div>
            <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%`, 
                height: '100%', 
                backgroundColor: 'var(--text-color)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
