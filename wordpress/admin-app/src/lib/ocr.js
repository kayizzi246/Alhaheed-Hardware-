/**
 * Reading text off a payment screenshot, in the browser.
 *
 * The same reader the staff panel uses, loaded differently: this app
 * is one ES module enqueued by WordPress under a fixed name, and a
 * code-split chunk would be looked for at the wrong path inside
 * wp-admin. So the reader comes from the CDN its own worker and
 * language data are fetched from anyway, and only when a picture is
 * actually attached — a cashier taking cash downloads nothing.
 *
 * The picture is read here and goes nowhere new: not to an outside
 * service, only to the shop's own server with the payment.
 */
const SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

let libPromise = null;
let workerPromise = null;
let report = () => {};

function loadLib() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => { libPromise = null; s.remove(); reject(new Error('The text reader could not be loaded.')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = loadLib()
      .then((T) =>
        T.createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') report('reading', m.progress);
            else if (/load|initializ/i.test(m.status)) report('preparing', m.progress);
          },
        })
      )
      .catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

export async function readImageText(image, onProgress = () => {}) {
  report = onProgress;
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  report = () => {};
  return data.text || '';
}

/** A camera photo shrunk to 1600px; a screenshot already smaller is left alone. */
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
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
