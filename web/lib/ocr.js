'use client';

/**
 * Reading text off a payment screenshot, in the browser.
 *
 * Done here rather than on the server so the customer's message goes
 * nowhere new — not to an outside service, not through a library the
 * shop's shared hosting would not have. The reader (Tesseract) and its
 * English data are fetched the first time and cached by the browser,
 * so the first screenshot of the day is a few seconds slower than the
 * rest.
 *
 * Loaded only when a picture is attached: most payments are cash, and
 * a cashier taking cash should not download a text reader for it.
 */

let workerPromise = null;
let report = () => {};

function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) =>
        createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') report('reading', m.progress);
            else if (/load|initializ/i.test(m.status)) report('preparing', m.progress);
          },
        })
      )
      .catch((e) => {
        // A failed load (offline, blocked CDN) must not stick: the next
        // picture gets a fresh attempt.
        workerPromise = null;
        throw e;
      });
  }
  return workerPromise;
}

/**
 * @param {Blob} image
 * @param {(stage: 'preparing'|'reading', progress: number) => void} onProgress
 * @returns {Promise<string>} The text on the picture.
 */
export async function readImageText(image, onProgress = () => {}) {
  report = onProgress;
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  report = () => {};
  return data.text || '';
}

/**
 * Make a phone photo a sensible size.
 *
 * A camera picture of a receipt can be 6 MB. Shrunk to 1600px on the
 * long side it is a few hundred KB, still sharp enough to read, quicker
 * over a mobile connection, and quicker to read text from. Screenshots
 * already under that are sent as they are — re-encoding a PNG of text
 * as JPEG only blurs it.
 */
export async function shrinkImage(file, max = 1600) {
  if (!file.type.startsWith('image/')) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file could not be opened as a picture.'));
      i.src = url;
    });

    const long = Math.max(img.naturalWidth, img.naturalHeight);
    if (long <= max && file.size <= 1.5 * 1024 * 1024) return file;

    const scale = Math.min(1, max / long);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // a transparent PNG would otherwise go black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
    return blob
      ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
      : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
