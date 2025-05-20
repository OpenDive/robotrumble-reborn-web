import React, { useState } from 'react';
import { debugLogger } from '../../../engine-layer/core/debug/DebugLogger';
import type { DebugCategory } from '../../../engine-layer/core/debug/DebugLogger';

export const DebugCategoriesPanel: React.FC = () => {
  const [categories, setCategories] = useState<Record<DebugCategory, boolean>>({
    general: true,
    ar: true,
    video: true,
    physics: true,
    network: true
  });

  const toggleCategory = (category: DebugCategory) => {
    setCategories(prev => {
      const newState = { ...prev, [category]: !prev[category] };
      if (newState[category]) {
        debugLogger.enableCategory(category);
      } else {
        debugLogger.disableCategory(category);
      }
      return newState;
    });
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg font-mono text-sm">
      <h3 className="font-bold mb-2">Debug Categories</h3>
      <div className="space-y-2">
        {Object.entries(categories).map(([category, enabled]) => (
          <label key={category} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => toggleCategory(category as DebugCategory)}
              className="form-checkbox h-4 w-4"
            />
            <span className="capitalize">{category}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
