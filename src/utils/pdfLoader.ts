import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using official CDN matching installed version, or fall back safely
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('PDF.js worker could not be set to CDN, falling back to main thread', err);
  }
}

export async function loadPdfDocument(dataUrlOrBytes: string | Uint8Array) {
  let loadingTask;
  if (typeof dataUrlOrBytes === 'string') {
    if (dataUrlOrBytes.startsWith('data:')) {
      const base64 = dataUrlOrBytes.split(',')[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      loadingTask = pdfjsLib.getDocument({ data: bytes });
    } else {
      loadingTask = pdfjsLib.getDocument({ url: dataUrlOrBytes });
    }
  } else {
    loadingTask = pdfjsLib.getDocument({ data: dataUrlOrBytes });
  }

  return await loadingTask.promise;
}

export async function renderPdfPage(
  pdfDoc: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  };

  await page.render(renderContext).promise;
  return { width: viewport.width, height: viewport.height };
}
