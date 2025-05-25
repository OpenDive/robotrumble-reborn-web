import React, { useRef, useEffect } from 'react';

interface RobotLocation {
  name: string;
  x: number; // X position as percentage (0-100)
  y: number; // Y position as percentage (0-100)
  color: string;
  number: number;
}

interface WorldGlobeProps {
  className?: string;
}

export const WorldGlobe: React.FC<WorldGlobeProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Robot locations on flat world map (approximate positions for standard world map projection)
  const robotLocations: RobotLocation[] = [
    { name: 'Ohio', x: 22, y: 38, color: '#B24BF3', number: 2 }, // Neon Purple - 2 robots in Ohio (US Midwest)
    { name: 'Miami', x: 23, y: 48, color: '#B24BF3', number: 1 }, // Neon Purple - 1 robot in Miami (Southern Florida)
    { name: 'Singapore', x: 72, y: 58, color: '#B24BF3', number: 2 }, // Neon Purple - 2 robots in Singapore (Southeast Asia)
  ];

  useEffect(() => {
    // Add pulsing animation to pings
    const interval = setInterval(() => {
      const pings = containerRef.current?.querySelectorAll('.ping-dot');
      pings?.forEach((ping, index) => {
        const element = ping as HTMLElement;
        element.style.transform = `scale(${1 + Math.sin(Date.now() * 0.003 + index) * 0.2})`;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-gradient-to-br from-[#0B0B1A] via-[#1a1a2e] to-[#16213e] rounded-lg overflow-hidden border border-neon-purple/20 ${className || ''}`}
      style={{ minHeight: '300px' }}
    >
      {/* Neon glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 via-transparent to-neon-blue/5 rounded-lg" />
      
      {/* World Map Background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg 
          viewBox="0 0 1200 600" 
          className="w-full h-full"
          style={{ 
            filter: 'brightness(1.2) contrast(1.4) saturate(1.1)',
            opacity: 0.9
          }}
        >
          <image 
            href="/assets/worldLow.svg" 
            x="60" 
            y="-60" 
            width="1200" 
            height="800"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      </div>

      {/* Grid Lines Overlay */}
      <div className="absolute inset-0 opacity-15">
        <svg viewBox="0 0 1200 600" className="w-full h-full">
          {/* Latitude lines */}
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <line 
              key={`lat-${i}`}
              x1="0" 
              y1={i * 100} 
              x2="1200" 
              y2={i * 100} 
              stroke="#B24BF3" 
              strokeWidth="0.5"
              opacity="0.6"
            />
          ))}
          {/* Longitude lines */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
            <line 
              key={`lng-${i}`}
              x1={i * 100} 
              y1="0" 
              x2={i * 100} 
              y2="600" 
              stroke="#B24BF3" 
              strokeWidth="0.5"
              opacity="0.6"
            />
          ))}
        </svg>
      </div>

      {/* Robot Location Pings */}
      {robotLocations.map((location) => (
        <div
          key={location.name}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
          style={{
            left: `${location.x}%`,
            top: `${location.y}%`,
          }}
        >
          {/* Pulsing Ring */}
          <div 
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              backgroundColor: location.color,
              width: '50px',
              height: '50px',
              left: '-25px',
              top: '-25px',
              opacity: 0.3,
              boxShadow: `0 0 30px ${location.color}`,
            }}
          />
          
          {/* Secondary Ring */}
          <div 
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              backgroundColor: location.color,
              width: '70px',
              height: '70px',
              left: '-35px',
              top: '-35px',
              opacity: 0.15,
              boxShadow: `0 0 50px ${location.color}`,
            }}
          />
          
          {/* Main Ping Dot */}
          <div
            className="ping-dot relative w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white/80 z-20 backdrop-blur-sm"
            style={{
              backgroundColor: location.color,
              boxShadow: `0 0 25px ${location.color}, 0 0 50px ${location.color}40, inset 0 0 10px rgba(255,255,255,0.2)`,
            }}
          >
            {location.number}
          </div>
          
          {/* Location Label */}
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 text-white text-xs font-medium bg-black/80 px-3 py-1.5 rounded-md whitespace-nowrap backdrop-blur-md border border-neon-purple/30 shadow-lg">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse" 
                style={{ backgroundColor: location.color }}
              />
              {location.name}
            </div>
          </div>
        </div>
      ))}

      {/* Decorative Elements */}
      <div className="absolute top-4 left-4 text-white/90 text-sm font-medium bg-black/60 px-4 py-2 rounded-lg backdrop-blur-md border border-neon-purple/30 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-racing-green animate-pulse" />
          Global Robot Network
        </div>
      </div>

      {/* Connection Lines (optional visual enhancement) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        {robotLocations.map((location, index) => (
          <g key={`connection-${index}`}>
            <circle
              cx={`${location.x}%`}
              cy={`${location.y}%`}
              r="8"
              fill={location.color}
              opacity="0.4"
              className="animate-ping"
              style={{
                filter: `drop-shadow(0 0 10px ${location.color})`,
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};