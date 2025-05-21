import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RouteTransitionProps {
  children: React.ReactNode;
  route: string;
}

export const RouteTransition: React.FC<RouteTransitionProps> = ({ children, route }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={route}
        initial={{ 
          opacity: 0,
          scale: 1.1,
          filter: 'brightness(1.5) blur(10px)'
        }}
        animate={{ 
          opacity: 1,
          scale: 1,
          filter: 'brightness(1) blur(0px)'
        }}
        exit={{ 
          opacity: 0,
          scale: 0.95,
          filter: 'brightness(0.5) blur(10px)'
        }}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1]
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
