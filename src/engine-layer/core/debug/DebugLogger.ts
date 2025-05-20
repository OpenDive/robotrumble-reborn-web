import { isDebugEnabled } from '../../../shared/config/env';

export type DebugCategory = 'ar' | 'video' | 'physics' | 'network' | 'general';

class DebugLogger {
  private static instance: DebugLogger;
  private enabledCategories: Set<DebugCategory>;

  private constructor() {
    this.enabledCategories = new Set(['general', 'ar', 'video', 'physics', 'network']);
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  private shouldLog(category: DebugCategory): boolean {
    return isDebugEnabled && this.enabledCategories.has(category);
  }

  enableCategory(category: DebugCategory): void {
    this.enabledCategories.add(category);
  }

  disableCategory(category: DebugCategory): void {
    this.enabledCategories.delete(category);
  }

  log(category: DebugCategory, message: string, data?: any): void {
    if (this.shouldLog(category)) {
      console.log(`[${category.toUpperCase()}] ${message}`, data || '');
    }
  }

  warn(category: DebugCategory, message: string, data?: any): void {
    if (this.shouldLog(category)) {
      console.warn(`[${category.toUpperCase()}] ${message}`, data || '');
    }
  }

  error(category: DebugCategory, message: string, error?: any): void {
    if (this.shouldLog(category)) {
      console.error(`[${category.toUpperCase()}] ${message}`, error || '');
    }
  }
}

export const debugLogger = DebugLogger.getInstance();
