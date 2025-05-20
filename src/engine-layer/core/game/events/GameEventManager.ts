import { Vector3 } from 'three';

export enum GameEventType {
  COLLISION = 'collision',
  ITEM_PICKUP = 'item_pickup',
  EFFECT_TRIGGER = 'effect_trigger',
  PHYSICS_UPDATE = 'physics_update',
  MARKER_DETECTED = 'marker_detected',
  PERFORMANCE_ALERT = 'performance_alert'
}

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  position?: Vector3;
  data?: Record<string, unknown>;
}

type EventCallback = (event: GameEvent) => void;

export class GameEventManager {
  private static instance: GameEventManager;
  private eventListeners: Map<GameEventType, Set<EventCallback>>;
  private performanceMetrics: Map<string, number>;

  private constructor() {
    this.eventListeners = new Map();
    this.performanceMetrics = new Map();
  }

  static getInstance(): GameEventManager {
    if (!GameEventManager.instance) {
      GameEventManager.instance = new GameEventManager();
    }
    return GameEventManager.instance;
  }

  emit(event: GameEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }
  }

  on(eventType: GameEventType, callback: EventCallback): void {
    let listeners = this.eventListeners.get(eventType);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(eventType, listeners);
    }
    listeners.add(callback);
  }

  off(eventType: GameEventType, callback: EventCallback): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  // Performance monitoring
  recordMetric(name: string, value: number): void {
    this.performanceMetrics.set(name, value);
    if (value > this.getThreshold(name)) {
      this.emit({
        type: GameEventType.PERFORMANCE_ALERT,
        timestamp: performance.now(),
        data: { metric: name, value }
      });
    }
  }

  private getThreshold(metricName: string): number {
    // Default thresholds for different metrics
    const thresholds: { [key: string]: number } = {
      'fps': 30,
      'particleCount': 1000,
      'physicsTime': 16, // ms
      'renderTime': 16   // ms
    };
    return thresholds[metricName] || Infinity;
  }

  dispose(): void {
    this.eventListeners.clear();
    this.performanceMetrics.clear();
  }
}
