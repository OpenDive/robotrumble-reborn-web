interface MemoryStats {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  lastGCTime: number;
}

export interface Stats {
  lastDetectionTime: number;
  detectionFPS: number;
  markersDetected: number;
  lastProcessedFrame: number;
  totalDetections: number;
  errors: number;
  processingTime: number;
  totalProcessingTime: number;
  frameCount: number;
  avgProcessingTime: number;
  memoryStats: MemoryStats;
}

export class StatsService {
  private static instance: StatsService;
  private stats: Stats;
  private currentFrameCount: number = 0;

  private constructor() {
    this.stats = {
      lastDetectionTime: 0,
      detectionFPS: 0,
      markersDetected: 0,
      lastProcessedFrame: 0,
      totalDetections: 0,
      errors: 0,
      processingTime: 0,
      totalProcessingTime: 0,
      frameCount: 0,
      avgProcessingTime: 0,
      memoryStats: {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
        lastGCTime: 0
      }
    };
  }

  static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }

  // New method to update frame count
  updateFrameCount(frameCount: number): void {
    this.currentFrameCount = frameCount;
    this.stats.frameCount = frameCount;
  }

  // Modified to separate frame counting from marker detection
  updateDetectionStats(markersCount: number): void {
    const now = performance.now();
    if (this.stats.lastDetectionTime > 0) {
      this.stats.detectionFPS = 1000 / (now - this.stats.lastDetectionTime);
    }
    this.stats.lastDetectionTime = now;
    this.stats.lastProcessedFrame = this.currentFrameCount;
    this.stats.markersDetected = markersCount;
    this.stats.totalDetections += markersCount;
  }

  updateMemoryStats(): void {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.stats.memoryStats = {
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
        lastGCTime: performance.now()
      };
    }
  }

  recordError(): void {
    this.stats.errors++;
  }

  getStats(): Stats & { fps: string; frameSkip: number } {
    return {
      ...this.stats,
      fps: this.stats.detectionFPS.toFixed(1),
      frameSkip: this.currentFrameCount - this.stats.lastProcessedFrame
    };
  }

  getFormattedStats(): {
    performance: {
      fps: string;
      currentMarkers: number;
      totalDetections: number;
      errors: number;
      frameSkip: number;
    };
    memory: {
      heapUsed: string;
      heapTotal: string;
      heapLimit: string;
      heapUsage: string;
    };
  } {
    const memStats = this.stats.memoryStats;
    return {
      performance: {
        fps: this.stats.detectionFPS.toFixed(1),
        currentMarkers: this.stats.markersDetected,
        totalDetections: this.stats.totalDetections,
        errors: this.stats.errors,
        frameSkip: this.currentFrameCount - this.stats.lastProcessedFrame
      },
      memory: {
        heapUsed: (memStats.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (memStats.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        heapLimit: (memStats.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
        heapUsage: ((memStats.usedJSHeapSize / memStats.totalJSHeapSize) * 100).toFixed(1) + '%'
      }
    };
  }

  // Remove individual getters/setters as they're no longer needed
} 