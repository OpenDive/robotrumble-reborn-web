import React from 'react';

interface DriversLicenseCardProps {
  animate?: boolean;
  photoData: string;
  playerName: string;
  issueDate: Date;
  licenseType: string;
  className?: string;
}

export const DriversLicenseCard: React.FC<DriversLicenseCardProps> = ({
  photoData,
  animate = false,
  playerName,
  issueDate,
  licenseType,
  className = ''
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div
      className={`relative w-full aspect-[1.75] bg-white rounded-xl overflow-hidden will-change-transform
        ${animate ? 'animate-license-entrance' : ''} ${className}`}>
      {/* Red header */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-racing-red">
        <h1 className="text-2xl font-black text-white p-4">ROBOT RUMBLE LIVE</h1>
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-racing-blue/5 to-transparent animate-pulse-slow" />

      <div className="absolute top-16 inset-x-0 bottom-0 flex p-6 gap-6">
        {/* Photo area */}
        <div className="w-1/3 aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden">
          <img src={photoData} alt="Driver photo" className="w-full h-full object-cover" />
        </div>

        {/* License details */}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-sm font-medium text-game-600">NAME</p>
            <p className="text-xl font-bold text-game-900">{playerName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-game-600">DATE OF ISSUE</p>
            <p className="text-xl font-bold text-game-900">{formatDate(issueDate)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-game-600">TYPE</p>
            <p className="text-xl font-bold text-game-900">{licenseType}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
