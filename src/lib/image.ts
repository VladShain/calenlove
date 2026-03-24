export interface CompressedImageResult {
  dataUrl: string;
  originalName: string;
}

export const compressImageFile = async (
  file: File,
  maxWidth = 1600,
  quality = 0.78
): Promise<CompressedImageResult> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const ratio = image.width > maxWidth ? maxWidth / image.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");

  if (!context) {
    return { dataUrl, originalName: file.name };
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = canvas.toDataURL("image/jpeg", quality);

  return {
    dataUrl: compressed,
    originalName: file.name
  };
};


export const readImageFromClipboard = async (): Promise<CompressedImageResult | null> => {
  if (typeof navigator === "undefined" || !navigator.clipboard || !("read" in navigator.clipboard)) {
    return null;
  }

  try {
    const clipboardItems = await (navigator.clipboard as Clipboard & { read: () => Promise<ClipboardItem[]> }).read();

    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) {
        continue;
      }

      const blob = await item.getType(imageType);
      const extension = imageType.split("/")[1] || "png";
      const file = new File([blob], `clipboard-image.${extension}`, { type: imageType });
      return compressImageFile(file, 1800, 0.82);
    }
  } catch (error) {
    console.warn("Не удалось прочитать изображение из буфера.", error);
  }

  return null;
};
