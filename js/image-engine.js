/**
 * MaarstOn Craft — Image Compression Engine
 * Dedicated client-side image processing and compression
 * 100% In-Browser • Zero Server Upload • High Performance & Memory Safe
 */

class ImageEngine {
  constructor() {
    this.sourceCanvas = document.createElement('canvas');
    this.sourceCtx = this.sourceCanvas.getContext('2d');
    this.workingCanvas = document.createElement('canvas');
    this.workingCtx = this.workingCanvas.getContext('2d');

    this.compressedImage = null;
    this.compressedBlob = null;
    this.compressedBlobUrl = null;
    this.originalBlobUrl = null;
    this.originalImage = null;

    this.fileInfo = {
      file: null,
      name: '',
      size: 0,
      type: '',
      width: 0,
      height: 0,
      aspectRatio: '1:1',
      hasAlpha: false,
      orientation: 1
    };

    this.settings = {
      quality: 0.8,
      format: 'image/webp',
      resizeWidth: 0,
      resizeHeight: 0,
      maintainAspect: true
    };
  }

  /**
   * Fast binary EXIF orientation tag parser (tags 0x0112 in IFD0)
   * Handles big-endian (MM) and little-endian (II) TIFF headers inside JPEG APP1 marker
   * @param {ArrayBuffer} buffer 
   * @returns {number} 1 to 8 (1 = normal)
   */
  static parseExifOrientation(buffer) {
    try {
      const view = new DataView(buffer);
      if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
        return 1; // Not a JPEG
      }
      let offset = 2;
      const length = view.byteLength;
      while (offset < length - 2) {
        if (view.getUint8(offset) !== 0xFF) return 1;
        const marker = view.getUint8(offset + 1);
        if (marker === 0xE1) { // APP1 Marker
          const app1Length = view.getUint16(offset + 2, false);
          const exifHeaderOffset = offset + 4;
          // Check for 'Exif\0\0' (0x45786966, 0x0000)
          if (
            exifHeaderOffset + 6 <= length &&
            view.getUint32(exifHeaderOffset, false) === 0x45786966 &&
            view.getUint16(exifHeaderOffset + 4, false) === 0x0000
          ) {
            const tiffOffset = exifHeaderOffset + 6;
            if (tiffOffset + 8 > length) return 1;
            const endianness = view.getUint16(tiffOffset, false);
            const littleEndian = endianness === 0x4949; // 'II'
            if (!littleEndian && endianness !== 0x4D4D) return 1; // Invalid endianness
            if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x002A) return 1; // 42
            const firstIFDOffset = view.getUint32(tiffOffset + 4, littleEndian);
            if (firstIFDOffset < 8) return 1;
            const dirOffset = tiffOffset + firstIFDOffset;
            if (dirOffset + 2 > length) return 1;
            const entries = view.getUint16(dirOffset, littleEndian);
            for (let i = 0; i < entries; i++) {
              const entryOffset = dirOffset + 2 + (i * 12);
              if (entryOffset + 12 > length) return 1;
              const tag = view.getUint16(entryOffset, littleEndian);
              if (tag === 0x0112) { // Orientation tag
                const orientationVal = view.getUint16(entryOffset + 8, littleEndian);
                if (orientationVal >= 1 && orientationVal <= 8) {
                  return orientationVal;
                }
                return 1;
              }
            }
          }
          offset += 2 + app1Length;
        } else if ((marker & 0xFF00) !== 0xFF00 && marker !== 0xD8 && marker !== 0xD9) {
          if (offset + 4 > length) break;
          const markerLength = view.getUint16(offset + 2, false);
          offset += 2 + markerLength;
        } else {
          offset += 2;
        }
      }
      return 1;
    } catch (_) {
      return 1;
    }
  }

  /**
   * Apply affine canvas transformation according to EXIF orientation tag (1-8)
   */
  static applyOrientationTransform(ctx, orientation, rawWidth, rawHeight) {
    switch (orientation) {
      case 2: // Flip horizontal
        ctx.translate(rawWidth, 0);
        ctx.scale(-1, 1);
        break;
      case 3: // Rotate 180°
        ctx.translate(rawWidth, rawHeight);
        ctx.rotate(Math.PI);
        break;
      case 4: // Flip vertical
        ctx.translate(0, rawHeight);
        ctx.scale(1, -1);
        break;
      case 5: // Flip horizontal & rotate 270° CW
        ctx.rotate(0.5 * Math.PI);
        ctx.scale(1, -1);
        break;
      case 6: // Rotate 90° CW
        ctx.translate(rawHeight, 0);
        ctx.rotate(0.5 * Math.PI);
        break;
      case 7: // Flip horizontal & rotate 90° CW
        ctx.rotate(0.5 * Math.PI);
        ctx.translate(rawWidth, -rawHeight);
        ctx.scale(-1, 1);
        break;
      case 8: // Rotate 270° CW (90° CCW)
        ctx.translate(0, rawWidth);
        ctx.rotate(1.5 * Math.PI);
        break;
      case 1:
      default:
        // Normal orientation, no transform needed
        break;
    }
  }

  /**
   * Load an image file into memory and extract complete metadata
   * Uses modern createImageBitmap({ imageOrientation: 'from-image' }) with robust
   * binary EXIF parser fallback to ensure photos are ALWAYS oriented right side up.
   * @param {File} file 
   * @returns {Promise<Object>} fileInfo
   */
  async loadImage(file) {
    if (!file) {
      throw new Error('No image file was provided.');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Selected file is not a supported image. Please select a JPG, PNG, or WebP file.');
    }
    if (file.size > 75 * 1024 * 1024) {
      throw new Error('File exceeds 75MB. Please choose an image under 75MB for optimal browser performance.');
    }

    this.cleanupMemory();

    this.fileInfo.file = file;
    this.fileInfo.name = file.name;
    this.fileInfo.size = file.size;
    this.fileInfo.type = file.type;

    let orientation = 1;
    if (file.type === 'image/jpeg' || file.name.match(/\.jpe?g$/i)) {
      try {
        const headerSlice = await file.slice(0, 128 * 1024).arrayBuffer();
        orientation = ImageEngine.parseExifOrientation(headerSlice);
      } catch (_) {
        orientation = 1;
      }
    }
    this.fileInfo.orientation = orientation;

    // Strategy A: Modern createImageBitmap with imageOrientation 'from-image'
    let loadedViaBitmap = false;
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        this.sourceCanvas.width = bitmap.width;
        this.sourceCanvas.height = bitmap.height;
        this.sourceCtx.clearRect(0, 0, bitmap.width, bitmap.height);
        this.sourceCtx.drawImage(bitmap, 0, 0);
        // Free GPU memory immediately
        if (typeof bitmap.close === 'function') {
          bitmap.close();
        }
        loadedViaBitmap = true;
      } catch (_) {
        loadedViaBitmap = false;
      }
    }

    // Strategy B: Fallback to HTMLImageElement + manual EXIF canvas transform
    if (!loadedViaBitmap) {
      await new Promise((resolve, reject) => {
        const tempUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const rawW = img.naturalWidth;
          const rawH = img.naturalHeight;
          const isRotated90 = orientation >= 5 && orientation <= 8;
          const finalW = isRotated90 ? rawH : rawW;
          const finalH = isRotated90 ? rawW : rawH;

          this.sourceCanvas.width = finalW;
          this.sourceCanvas.height = finalH;
          this.sourceCtx.clearRect(0, 0, finalW, finalH);

          if (orientation > 1) {
            this.sourceCtx.save();
            ImageEngine.applyOrientationTransform(this.sourceCtx, orientation, rawW, rawH);
            this.sourceCtx.drawImage(img, 0, 0);
            this.sourceCtx.restore();
          } else {
            this.sourceCtx.drawImage(img, 0, 0);
          }

          URL.revokeObjectURL(tempUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          reject(new Error('Unable to decode this image. The file may be corrupted or in an unsupported format.'));
        };
        img.src = tempUrl;
      });
    }

    // Store intrinsic oriented pixel dimensions
    const width = this.sourceCanvas.width;
    const height = this.sourceCanvas.height;
    this.fileInfo.width = width;
    this.fileInfo.height = height;
    this.fileInfo.aspectRatio = this.calculateRatio(width, height);

    this.settings.resizeWidth = width;
    this.settings.resizeHeight = height;

    // Detect transparency in PNG/WebP files
    this.fileInfo.hasAlpha = this.detectAlphaChannel();

    // Default to WebP for modern efficiency, or retain original format
    if (file.type === 'image/jpeg' || file.name.match(/\.jpe?g$/i)) {
      this.settings.format = 'image/jpeg';
    } else if (file.type === 'image/png') {
      this.settings.format = this.fileInfo.hasAlpha ? 'image/webp' : 'image/jpeg';
    } else if (file.type === 'image/webp') {
      this.settings.format = 'image/webp';
    } else {
      this.settings.format = 'image/webp';
    }

    // Create an upright original preview Blob URL
    // If orientation was > 1, create blob from upright sourceCanvas so DOM preview is right side up!
    if (orientation > 1) {
      await new Promise((resolve) => {
        this.sourceCanvas.toBlob((blob) => {
          if (blob) {
            this.originalBlobUrl = URL.createObjectURL(blob);
          } else {
            this.originalBlobUrl = URL.createObjectURL(file);
          }
          resolve();
        }, file.type || 'image/jpeg', 0.95);
      });
    } else {
      this.originalBlobUrl = URL.createObjectURL(file);
    }

    // Cache an Image element of the original for fast split slider rendering
    await new Promise((resolve) => {
      const previewImg = new Image();
      previewImg.onload = () => {
        this.originalImage = previewImg;
        resolve();
      };
      previewImg.onerror = () => {
        this.originalImage = null;
        resolve();
      };
      previewImg.src = this.originalBlobUrl;
    });

    return this.fileInfo;
  }

  /**
   * Fast alpha transparency detector
   * Samples pixels across a downscaled canvas to identify transparent areas
   */
  detectAlphaChannel() {
    if (this.fileInfo.type === 'image/jpeg') return false;
    try {
      const maxDim = 80;
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = maxDim;
      sampleCanvas.height = maxDim;
      const ctx = sampleCanvas.getContext('2d');
      ctx.drawImage(this.sourceCanvas, 0, 0, maxDim, maxDim);
      const data = ctx.getImageData(0, 0, maxDim, maxDim).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /**
   * Memory safety check for oversized phone photos (> 3840px / 4K)
   */
  downscaleIfExceeds(maxDimension = 3840) {
    const { width, height } = this.fileInfo;
    if (width <= maxDimension && height <= maxDimension) return null;

    const scale = Math.min(maxDimension / width, maxDimension / height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    return {
      oldW: width,
      oldH: height,
      newW,
      newH,
      scale: Math.round(scale * 100)
    };
  }

  /**
   * Returns human-readable quality status, badge colors, and technical explanation
   */
  getQualityStatus(quality) {
    const q = Math.round(quality * 100);

    if (q >= 90) {
      return {
        level: 'very-light',
        badge: 'Very Light Compression',
        color: '#10B981', // Emerald
        bgColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        description: 'Maximum visual fidelity. Negligible quality difference; file size reduction will be modest.'
      };
    } else if (q >= 75) {
      return {
        level: 'recommended',
        badge: 'Recommended (Balanced)',
        color: '#FACC15', // Vibrant Brand Yellow
        bgColor: 'rgba(250, 204, 21, 0.12)',
        borderColor: 'rgba(250, 204, 21, 0.35)',
        description: 'Optimal sweet spot. Substantial file size reduction (50%–75%) with visually lossless quality.'
      };
    } else if (q >= 50) {
      return {
        level: 'moderate',
        badge: 'Strong Compression',
        color: '#F59E0B', // Amber
        bgColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.35)',
        description: 'Noticeable compression applied. High byte savings suitable for fast web loading and email attachments. Minor artifacts may appear.'
      };
    } else {
      return {
        level: 'aggressive',
        badge: 'Aggressive Compression',
        color: '#F43F5E', // Rose / Red
        bgColor: 'rgba(244, 63, 94, 0.12)',
        borderColor: 'rgba(244, 63, 94, 0.35)',
        description: 'Warning: Strong compression applied. Visible artifacts, banding, or blur may occur. Only use if file size is the top priority.'
      };
    }
  }

  /**
   * Real in-browser image compression with native canvas toBlob
   * Computes exact byte sizes, signed difference, savings or increase percentage
   */
  async compress(quality = 0.8, format = 'image/webp', targetWidth = null, targetHeight = null) {
    return new Promise((resolve, reject) => {
      if (!this.sourceCanvas.width || !this.sourceCanvas.height) {
        return reject(new Error('No image loaded to compress.'));
      }

      try {
        const safeQuality = Math.min(1, Math.max(0.05, parseFloat(quality)));
        const outFormat = format || this.settings.format || 'image/webp';

        const finalWidth = Math.round(targetWidth || this.fileInfo.width);
        const finalHeight = Math.round(targetHeight || this.fileInfo.height);

        // Prepare working canvas
        this.workingCanvas.width = finalWidth;
        this.workingCanvas.height = finalHeight;
        this.workingCtx.clearRect(0, 0, finalWidth, finalHeight);

        // If target is JPEG and has transparency, fill with clean white background to prevent dark black pixels
        if (outFormat === 'image/jpeg' && this.fileInfo.hasAlpha) {
          this.workingCtx.fillStyle = '#ffffff';
          this.workingCtx.fillRect(0, 0, finalWidth, finalHeight);
        }

        // Draw from upright sourceCanvas scaled to target dimensions
        this.workingCtx.imageSmoothingEnabled = true;
        this.workingCtx.imageSmoothingQuality = 'high';
        this.workingCtx.drawImage(this.sourceCanvas, 0, 0, finalWidth, finalHeight);

        // Perform real native compression
        this.workingCanvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error('Browser failed to encode image into the requested format.'));
          }

          // Cleanup previous compressed blob URL
          if (this.compressedBlobUrl) {
            URL.revokeObjectURL(this.compressedBlobUrl);
          }

          this.compressedBlob = blob;
          this.compressedBlobUrl = URL.createObjectURL(blob);

          const originalSize = this.fileInfo.size;
          const compressedSize = blob.size;
          const diff = originalSize - compressedSize; // positive = saved, negative = increased
          const isLarger = compressedSize > originalSize;

          const changePct = originalSize > 0 
            ? Math.round((Math.abs(diff) / originalSize) * 1000) / 10 
            : 0;

          const savedBytes = diff > 0 ? diff : 0;
          const increasedBytes = diff < 0 ? Math.abs(diff) : 0;
          const reductionPct = diff > 0 ? changePct : 0;
          const increasePct = diff < 0 ? changePct : 0;

          const status = this.getQualityStatus(safeQuality);

          // Cache compressed image element for side-by-side & split slider comparison
          const compImg = new Image();
          const completeResult = () => {
            this.compressedImage = compImg;
            resolve({
              blob,
              blobUrl: this.compressedBlobUrl,
              originalSize,
              compressedSize,
              diff,
              isLarger,
              savedBytes,
              increasedBytes,
              reductionPct,
              increasePct,
              status,
              format: outFormat,
              quality: safeQuality,
              qualityPct: Math.round(safeQuality * 100),
              width: finalWidth,
              height: finalHeight
            });
          };

          compImg.onload = completeResult;
          compImg.onerror = completeResult;
          compImg.src = this.compressedBlobUrl;

        }, outFormat, safeQuality);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Render interactive split-view comparison on a canvas
   */
  renderSplitComparison(targetCanvas, splitRatio = 0.5) {
    if (!targetCanvas || !this.sourceCanvas.width) return;
    const ctx = targetCanvas.getContext('2d');
    const w = targetCanvas.width;
    const h = targetCanvas.height;

    ctx.clearRect(0, 0, w, h);
    const splitX = Math.round(w * splitRatio);

    // 1. Draw Original on Left Side
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, h);
    ctx.clip();
    const leftSource = this.originalImage || this.sourceCanvas;
    ctx.drawImage(leftSource, 0, 0, w, h);
    ctx.restore();

    // 2. Draw Compressed on Right Side
    const rightSource = this.compressedImage || this.workingCanvas;
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, w - splitX, h);
    ctx.clip();
    ctx.drawImage(rightSource, 0, 0, w, h);
    ctx.restore();

    // 3. Draw Split Line & Center Knob in Brand Yellow
    ctx.save();
    ctx.strokeStyle = '#FACC15'; // Brand Yellow
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();

    const handleY = h / 2;
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(splitX, handleY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090A0F';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Knob Arrow symbol
    ctx.fillStyle = '#090A0F';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬌', splitX, handleY);

    // Badges: "ORIGINAL" vs "COMPRESSED"
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(9, 10, 15, 0.88)';
    ctx.fillRect(12, 12, 84, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText('ORIGINAL', 20, 28);

    ctx.fillStyle = 'rgba(9, 10, 15, 0.88)';
    ctx.fillRect(w - 116, 12, 104, 24);
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'right';
    ctx.fillText('COMPRESSED', w - 18, 28);

    ctx.restore();
  }

  /**
   * Trigger browser file download of the actual compressed blob
   */
  download(customFilename = '') {
    if (!this.compressedBlob) {
      throw new Error('No compressed image available to download.');
    }

    const ext = this.settings.format === 'image/png' 
      ? 'png' 
      : (this.settings.format === 'image/jpeg' ? 'jpg' : 'webp');

    let baseName = customFilename || this.fileInfo.name.replace(/\.[^/.]+$/, '');
    if (!baseName.endsWith('-compressed')) {
      baseName = `${baseName}-compressed`;
    }
    const finalName = `${baseName}.${ext}`;

    const url = URL.createObjectURL(this.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Reset engine state and release all object URLs and canvas contexts
   */
  cleanupMemory() {
    if (this.compressedBlobUrl) {
      URL.revokeObjectURL(this.compressedBlobUrl);
      this.compressedBlobUrl = null;
    }
    if (this.originalBlobUrl) {
      URL.revokeObjectURL(this.originalBlobUrl);
      this.originalBlobUrl = null;
    }
    this.originalImage = null;
    this.compressedImage = null;
    this.compressedBlob = null;

    this.sourceCanvas.width = 0;
    this.sourceCanvas.height = 0;
    this.workingCanvas.width = 0;
    this.workingCanvas.height = 0;

    this.fileInfo = {
      file: null,
      name: '',
      size: 0,
      type: '',
      width: 0,
      height: 0,
      aspectRatio: '1:1',
      hasAlpha: false,
      orientation: 1
    };
  }

  /**
   * Byte formatting helper
   */
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  /**
   * Aspect ratio solver
   */
  calculateRatio(w, h) {
    if (!w || !h) return '1:1';
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const d = gcd(w, h);
    return `${Math.round(w / d)}:${Math.round(h / d)}`;
  }
}

window.ImageEngine = ImageEngine;
