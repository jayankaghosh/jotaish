// Shrinks a photo in the browser so uploads stay small and fast.
export async function photoToDataUrl(file: File, maxSide = 1600): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo (JPG or PNG).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That photo could not be opened. Please try another one.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Reads an image as-is (no re-encoding), for things like QR codes that must
// stay sharp.
export function imageToDataUrl(file: File, maxBytes = 2_000_000): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Please choose an image (PNG or JPG).'));
  if (file.size > maxBytes) return Promise.reject(new Error('That image is too large. Please use one under 2 MB.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
}
