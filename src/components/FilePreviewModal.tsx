import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  File, 
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Printer,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { MaterialFile } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import { getFileFromIndexedDB } from '../lib/fileStorage';

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.0.0'}/build/pdf.worker.min.mjs`;
  } catch {
    // Fallback
  }
}

interface FilePreviewModalProps {
  file: MaterialFile | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [activeDataUrl, setActiveDataUrl] = useState<string>(file?.dataUrl || '');

  useEffect(() => {
    if (!file) return;
    if (file.dataUrl && file.dataUrl.length > 50) {
      setActiveDataUrl(file.dataUrl);
    } else {
      getFileFromIndexedDB(file.id).then((stored) => {
        if (stored?.dataUrl) {
          setActiveDataUrl(stored.dataUrl);
        }
      });
    }
  }, [file]);

  if (!file) return null;

  const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg)$/i.test(file.name);

  // Convert base64 dataUrl to Uint8Array and Blob
  const getPdfData = (): { bytes: Uint8Array; blobUrl: string } | null => {
    try {
      const dataToUse = activeDataUrl || file.dataUrl;
      if (!dataToUse) return null;
      const base64Index = dataToUse.indexOf(';base64,');
      const cleanBase64 = base64Index !== -1 ? dataToUse.substring(base64Index + 8) : dataToUse;
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      return { bytes, blobUrl };
    } catch (e) {
      console.error('Failed to parse PDF bytes:', e);
      return null;
    }
  };

  // Load PDF with PDF.js
  useEffect(() => {
    if (!isPdf) return;

    let isMounted = true;
    setIsLoadingPdf(true);
    setPdfError(null);
    setCurrentPage(1);

    const pdfData = getPdfData();
    if (!pdfData) {
      // If dataUrl is still loading from IndexedDB, wait briefly
      if (!activeDataUrl) return;
      setPdfError('Kunne ikke dekode PDF-filen.');
      setIsLoadingPdf(false);
      return;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: pdfData.bytes,
      useSystemFonts: true,
    });

    loadingTask.promise
      .then((doc) => {
        if (!isMounted) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoadingPdf(false);
      })
      .catch((err) => {
        console.error('PDF.js render error:', err);
        if (!isMounted) return;
        setPdfError('Innebygd visning krever at filen åpnes i ny fane eller lastes ned.');
        setIsLoadingPdf(false);
      });

    return () => {
      isMounted = false;
      if (pdfData.blobUrl) {
        URL.revokeObjectURL(pdfData.blobUrl);
      }
    };
  }, [file.id, file.dataUrl, activeDataUrl, isPdf]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask: any = null;

    pdfDoc.getPage(currentPage).then((page) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      renderTask = page.render(renderContext);
      renderTask.promise.catch((err: any) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Render page error:', err);
        }
      });
    });

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = () => {
    const dataToUse = activeDataUrl || file.dataUrl;
    const a = document.createElement('a');
    a.href = dataToUse;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleOpenNewTab = () => {
    const pdfData = getPdfData();
    if (pdfData?.blobUrl) {
      window.open(pdfData.blobUrl, '_blank');
      return;
    }

    const dataToUse = activeDataUrl || file.dataUrl;
    const win = window.open();
    if (win) {
      if (isPdf) {
        win.document.write(
          `<html><head><title>${file.name}</title></head><body style="margin:0;height:100vh;"><iframe src="${dataToUse}" style="width:100%;height:100%;border:none;"></iframe></body></html>`
        );
      } else if (isImage) {
        win.document.write(
          `<html><head><title>${file.name}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#111;"><img src="${dataToUse}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body></html>`
        );
      } else {
        win.location.href = dataToUse;
      }
    }
  };

  const handlePrint = () => {
    const pdfData = getPdfData();
    if (pdfData?.blobUrl) {
      const printWindow = window.open(pdfData.blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
      return;
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-hidden">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col h-[94vh] max-h-[900px]">
        
        {/* Header with Title and Document Tools */}
        <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
              {isPdf ? <FileText className="w-4 h-4" /> : isImage ? <ImageIcon className="w-4 h-4" /> : <File className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate" title={file.name}>
                {file.name}
              </h3>
              <p className="text-[10px] text-slate-500">
                {formatFileSize(file.size)} • Opplastet {file.uploadedAt}
              </p>
            </div>
          </div>

          {/* PDF Controls (Page Navigation & Zoom) */}
          {isPdf && numPages && numPages > 0 && (
            <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5 shadow-2xs text-xs">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-stone-100 disabled:opacity-30"
                title="Forrige side"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1.5 font-medium text-slate-700 text-[11px] min-w-[55px] text-center">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="p-1 rounded hover:bg-stone-100 disabled:opacity-30"
                title="Neste side"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="h-3.5 w-px bg-stone-200 mx-0.5" />

              <button
                onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                className="p-1 rounded hover:bg-stone-100"
                title="Zoom ut"
              >
                <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
              </button>
              <span className="text-[10px] text-slate-500 font-semibold px-0.5">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.2, s + 0.2))}
                className="p-1 rounded hover:bg-stone-100"
                title="Zoom inn"
              >
                <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 transition-colors"
              title="Skriv ut dokument"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Skriv ut</span>
            </button>
            <button
              onClick={handleOpenNewTab}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 transition-colors"
              title="Åpne i ny fane"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ny fane</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-colors shadow-2xs"
              title="Last ned fil"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Last ned</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors ml-1"
              title="Lukk forhåndsvisning"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Area */}
        <div className="flex-1 bg-stone-200/80 overflow-auto flex flex-col items-center justify-start p-3 sm:p-6 relative">
          
          {/* PDF Canvas Viewer */}
          {isPdf && (
            <div className="flex flex-col items-center justify-center min-h-full w-full">
              {isLoadingPdf && (
                <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-stone-200 my-auto">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">Laster inn PDF-dokument...</p>
                </div>
              )}

              {pdfError && (
                <div className="p-6 text-center bg-white rounded-xl shadow-sm border border-rose-200 max-w-md my-auto space-y-3">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs">Visning i nettleser</h4>
                    <p className="text-xs text-slate-500 mt-1">{pdfError}</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      onClick={handleOpenNewTab}
                      className="px-3 py-1.5 text-xs rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 shadow-2xs"
                    >
                      Åpne i ny fane
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-50"
                    >
                      Last ned fil
                    </button>
                  </div>
                </div>
              )}

              {/* Rendered Canvas */}
              <div className={`transition-opacity duration-200 ${isLoadingPdf || pdfError ? 'hidden' : 'block'}`}>
                <canvas
                  ref={canvasRef}
                  className="rounded-lg bg-white shadow-xl max-w-full border border-stone-300"
                />
              </div>
            </div>
          )}

          {/* Image Viewer */}
          {isImage && (
            <div className="flex items-center justify-center w-full h-full my-auto">
              <img
                src={activeDataUrl || file.dataUrl}
                alt={file.name}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-xl bg-white p-1"
              />
            </div>
          )}

          {/* Unsupported file fallback */}
          {!isPdf && !isImage && (
            <div className="bg-white p-8 rounded-xl border border-stone-200 text-center max-w-sm shadow-md space-y-3 my-auto">
              <File className="w-12 h-12 text-slate-400 mx-auto" />
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">{file.name}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Dette filformatet kan ikke gjengis direkte på lerretet, men du kan laste ned filen eller åpne den i tilknyttet program.
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 text-xs shadow-2xs"
              >
                <Download className="w-4 h-4" />
                Last ned fil
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
