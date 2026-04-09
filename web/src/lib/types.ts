export interface ViewNode {
  class_name: string;
  frame: { x: number; y: number; width: number; height: number };
  text: string | null;
  children: ViewNode[] | null;
}

export interface WireframeFile {
  screenName: string;   // normalized key, e.g. "splitview"
  rawFileName: string;
  capturedAt: number;   // unix epoch from filename
  rootNode: ViewNode;
  screenshotBase64?: string;  // low-res JPEG, base64-encoded
}

export interface FlowyEvent {
  action: 'SCREEN' | 'TAP' | 'SECURE_TAP' | 'SCROLL' | 'ERROR' | 'SUCCESS' | 'USER_FEEDBACK';
  ocr_text?: string;
  screen_name?: string;
  coordinates?: { x: number; y: number };
  comment?: string;
  timestamp: number;
  device_info?: { model: string; os_version: string };
  // legacy fields
  type?: string;
  name?: string;
  screenName?: string;
  elementId?: string;
  elementText?: string;
  parameters?: Record<string, string>;
}

export interface SessionData {
  id: string;
  uploadedAt: string;
  isApproved: boolean;
  tags: string[];
  events: FlowyEvent[];
  deviceInfo: any;
  report?: any;
  wireframes?: WireframeFile[];
}
