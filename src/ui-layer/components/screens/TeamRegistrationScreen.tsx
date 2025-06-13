import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaUsers, FaCrown, FaLock, FaStar } from 'react-icons/fa';
import { Button } from '../shared/Button';
import SuiWalletConnect from '../shared/SuiWalletConnect';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { Transaction } from '@mysten/sui/transactions';

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  maxMembers: number;
  createdAt: Date;
  leaderAddress: string;
}

interface TeamMember {
  address: string;
  username: string;
  email: string;
  joinedAt: Date;
  isLeader: boolean;
}

interface TeamRegistrationScreenProps {
  onBack: () => void;
  onRegistrationComplete: (teamId: string, memberData: TeamMember) => void;
}

export const TeamRegistrationScreen: React.FC<TeamRegistrationScreenProps> = ({ 
  onBack, 
  onRegistrationComplete 
}) => {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  
  // Authentication (wallet or Enoki)
  const { user } = useAuth();

  // State management
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    teamName: '' // For creating new team
  });

  // Mock teams data (in production, this would come from your backend)
  useEffect(() => {
    // Simulate loading teams from backend
    const mockTeams: Team[] = [
      {
        id: 'team-1',
        name: 'Neon Racers',
        members: [
          { address: '0x123...abc', username: 'SpeedDemon', email: 'speed@demo.com', joinedAt: new Date(), isLeader: true }
        ],
        maxMembers: 30,
        createdAt: new Date(),
        leaderAddress: '0x123...abc'
      },
      {
        id: 'team-2', 
        name: 'Circuit Breakers',
        members: [
          { address: '0x456...def', username: 'ElectricEagle', email: 'eagle@demo.com', joinedAt: new Date(), isLeader: true },
          { address: '0x789...ghi', username: 'VoltViper', email: 'viper@demo.com', joinedAt: new Date(), isLeader: false }
        ],
        maxMembers: 30,
        createdAt: new Date(),
        leaderAddress: '0x456...def'
      },
      {
        id: 'team-3',
        name: 'Cyber Nomads',
        members: Array.from({ length: 28 }, (_, i) => ({
          address: `0x${i}...xyz`,
          username: `Nomad${i + 1}`,
          email: `nomad${i + 1}@demo.com`,
          joinedAt: new Date(),
          isLeader: i === 0
        })),
        maxMembers: 30,
        createdAt: new Date(),
        leaderAddress: '0x0...xyz'
      }
    ];
    setTeams(mockTeams);
  }, []);

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email is required');
      return false;
    }
    if (showCreateTeam && !formData.teamName.trim()) {
      setError('Team name is required');
      return false;
    }
    return true;
  };

  const stakeTokens = async (): Promise<string> => {
    if (!currentAccount || !signAndExecuteTransaction) {
      throw new Error('Wallet not connected');
    }

    // Create transaction to stake 1 SUI
    const transaction = new Transaction();
    
    // Split coins for exact payment (1 SUI = 1,000,000,000 MIST)
    const stakingAmount = 1_000_000_000; // 1 SUI in MIST
    
    const [coin] = transaction.splitCoins(transaction.gas, [stakingAmount]);
    
    // For demo purposes, we'll just transfer to a demo address
    // In production, this would go to your staking contract
    const STAKING_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    transaction.transferObjects([coin], STAKING_ADDRESS);
    
    // Execute transaction
    return new Promise((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction },
        {
          onSuccess: (result) => {
            console.log('✅ Staking transaction successful:', result);
            resolve(result.digest);
          },
          onError: (error) => {
            console.error('❌ Staking transaction failed:', error);
            reject(error);
          }
        }
      );
    });
  };

  const handleRegistration = async () => {
    if (!validateForm()) return;
    
    // Check for both traditional wallet and Enoki users
    if (!currentAccount && !user) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For now, only traditional wallet transactions are supported  
      // Enoki transactions would need additional implementation
      if (!currentAccount) {
        throw new Error('Please connect a traditional wallet to participate in staking');
      }
      
      // Execute staking transaction
      const txDigest = await stakeTokens();
      console.log('Staking successful, transaction:', txDigest);

      // Get user address (traditional wallet or Enoki)
      const userAddress = currentAccount?.address || user?.suiAddress;
      if (!userAddress) {
        throw new Error('No user address available');
      }

      // Create member data
      const memberData: TeamMember = {
        address: userAddress,
        username: formData.username,
        email: formData.email,
        joinedAt: new Date(),
        isLeader: showCreateTeam
      };

      let targetTeamId: string;

      if (showCreateTeam) {
        // Create new team
        const newTeam: Team = {
          id: `team-${Date.now()}`,
          name: formData.teamName,
          members: [memberData],
          maxMembers: 30,
          createdAt: new Date(),
          leaderAddress: currentAccount.address
        };
        
        setTeams(prev => [...prev, newTeam]);
        targetTeamId = newTeam.id;
      } else if (selectedTeam) {
        // Join existing team
        const updatedTeams = teams.map(team => 
          team.id === selectedTeam.id 
            ? { ...team, members: [...team.members, memberData] }
            : team
        );
        setTeams(updatedTeams);
        targetTeamId = selectedTeam.id;
      } else {
        throw new Error('No team selected');
      }

      // Show success
      setSuccess(true);
      
      // Call completion callback after delay
      setTimeout(() => {
        onRegistrationComplete(targetTeamId, memberData);
      }, 2000);

    } catch (error) {
      console.error('Registration failed:', error);
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTeam(null);
    setShowCreateTeam(false);
    setShowJoinForm(false);
    setFormData({ username: '', email: '', teamName: '' });
    setError(null);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B1A] relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2">
          <div 
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: `
                linear-gradient(to right, #B24BF3 1px, transparent 1px),
                linear-gradient(to bottom, #B24BF3 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
              transform: 'perspective(1000px) rotateX(60deg)',
              transformOrigin: 'center center',
            }}
          />
        </div>

        {/* Success message */}
        <div className="relative max-w-md w-full space-y-8 p-8 bg-black/40 backdrop-blur-md rounded-3xl border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.3)] animate-float z-10">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <FaStar className="text-green-400 text-2xl" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Registration Successful!</h1>
            <p className="text-white/80 mb-4">
              You've successfully staked 1 SUI and joined the game program.
            </p>
            <p className="text-sm text-white/60">
              Redirecting to the stream selection...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B1A] relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2">
        <div 
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `
              linear-gradient(to right, #B24BF3 1px, transparent 1px),
              linear-gradient(to bottom, #B24BF3 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(1000px) rotateX(60deg)',
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* Animated glow overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, #B24BF3 0%, transparent 50%),
            radial-gradient(circle at 0% 0%, #4C9EFF 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, #FFD700 0%, transparent 40%)
          `
        }}
      />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/90 to-[#0B0B1A]"/>
      
      {/* Main container */}
      <div className="relative max-w-2xl w-full space-y-6 p-8 bg-black/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-[0_0_50px_rgba(178,75,243,0.3)] animate-float z-10 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="text-center relative">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">
            GAME PASS
          </h1>
          <div className="h-1 w-32 mx-auto bg-racing-yellow rounded-full mt-4 relative">
            <div className="absolute inset-0 animate-pulse-slow bg-racing-yellow blur-md opacity-50" />
          </div>
          <p className="mt-4 text-white/70">
            Stake 1 SUI to join a team and become a game participant with camera & microphone privileges
          </p>
        </div>

        {/* Wallet Connect */}
        <div className="mb-6">
          <SuiWalletConnect />
        </div>

        {!currentAccount && !user ? (
          <div className="text-center p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <p className="text-yellow-400">Please connect your wallet to continue</p>
          </div>
        ) : !showJoinForm && !showCreateTeam ? (
          /* Team Selection View */
          <>
            {/* Teams List */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">Available Teams</h2>
              
              {teams.map(team => (
                <div 
                  key={team.id}
                  onClick={() => team.members.length < team.maxMembers && setSelectedTeam(team)}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                    team.members.length >= team.maxMembers 
                      ? 'bg-gray-800/40 border-gray-600/30 opacity-50 cursor-not-allowed'
                      : selectedTeam?.id === team.id
                        ? 'bg-blue-500/20 border-blue-400/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <FaUsers className="text-white text-sm" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{team.name}</h3>
                        <p className="text-white/60 text-sm">
                          {team.members.length}/{team.maxMembers} members
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {team.members.length >= team.maxMembers && (
                        <FaLock className="text-gray-400" />
                      )}
                      <div className="text-right">
                        <div className="text-white/80 text-sm">
                          Leader: {team.members.find(m => m.isLeader)?.username || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button
                variant="primary"
                size="large"
                className="w-full"
                disabled={!selectedTeam || selectedTeam.members.length >= selectedTeam.maxMembers}
                onClick={() => setShowJoinForm(true)}
              >
                Join Selected Team
              </Button>

              <Button
                variant="secondary"
                size="large"
                className="w-full"
                onClick={() => setShowCreateTeam(true)}
              >
                Create New Team
              </Button>
            </div>
          </>
        ) : (
          /* Registration Form */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {showCreateTeam ? 'Create New Team' : `Join ${selectedTeam?.name}`}
              </h2>
              <button
                onClick={resetForm}
                className="text-white/60 hover:text-white transition-colors"
              >
                <FaChevronLeft />
              </button>
            </div>

            {showCreateTeam && (
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={formData.teamName}
                  onChange={(e) => handleFormChange('teamName', e.target.value)}
                  className="w-full px-4 py-3 text-white bg-black/40 border border-white/20 rounded-xl focus:outline-none focus:border-blue-400 transition-colors"
                  placeholder="Enter team name"
                />
              </div>
            )}

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleFormChange('username', e.target.value)}
                className="w-full px-4 py-3 text-white bg-black/40 border border-white/20 rounded-xl focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                className="w-full px-4 py-3 text-white bg-black/40 border border-white/20 rounded-xl focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="Enter your email"
              />
            </div>

            {/* Staking info */}
            <div className="p-4 bg-blue-500/10 border border-blue-400/30 rounded-xl">
              <h3 className="text-blue-400 font-semibold mb-2">Staking Requirements</h3>
              <p className="text-white/80 text-sm">
                • Stake 1 SUI to secure your game participant spot<br />
                • Gain camera and microphone privileges<br />
                • Participate in team-based competitions<br />
                • Stake is refundable after the event
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              variant="primary"
              size="large"
              className="w-full"
              onClick={handleRegistration}
              disabled={loading}
            >
              {loading ? 'Processing Stake...' : 'Stake 1 SUI & Join'}
            </Button>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={onBack}
          className="group flex items-center text-sm font-medium text-white/60 hover:text-white transition-colors duration-300"
        >
          <FaChevronLeft className="mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
          Back
        </button>
      </div>
    </div>
  );
}; 