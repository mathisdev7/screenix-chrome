interface DocumentPictureInPicture extends EventTarget {
  readonly window: Window | null;
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

interface Window {
  readonly documentPictureInPicture?: DocumentPictureInPicture;
}
