/**
 * 跨路由传递：相机拍完的照片在被用户选择「加入恋爱日记」时，
 * 先暂存在这里（同一 SPA 会话内的内存单例），然后跳转到 /love，
 * LovePanel 挂载时消费它，预填到日记图片里。
 *
 * 实时摄像头画面永远不会经过这里，这里只放用户「明确选择」的照片 dataURL。
 */

let pendingPhoto: string | null = null;

export function setPendingCameraPhoto(dataUrl: string): void {
  pendingPhoto = dataUrl;
}

/** 读取并清空暂存照片。 */
export function consumePendingCameraPhoto(): string | null {
  const photo = pendingPhoto;
  pendingPhoto = null;
  return photo;
}

export function hasPendingCameraPhoto(): boolean {
  return pendingPhoto !== null;
}
