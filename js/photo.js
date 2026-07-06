// 压缩相机照片：长边 ≤1024px，JPEG 质量 0.7（目标 ~200KB 内）
// 注意：Safari 13.1+ 的 drawImage 自动按 EXIF 方向绘制，勿再手动纠正方向
export function compressImage(file, maxSide = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('图片压缩失败'))),
        'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
    img.src = url;
  });
}
