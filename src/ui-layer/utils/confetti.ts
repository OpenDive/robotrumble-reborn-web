import confetti from 'canvas-confetti';

export const triggerNeonConfetti = () => {
  // Create two confetti bursts with neon colors
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    spread: 360,
    ticks: 100,
    gravity: 0.8,
    decay: 0.94,
    startVelocity: 30,
  };

  // First burst with primary neon colors
  confetti({
    ...defaults,
    particleCount: count,
    colors: ['#4C9EFF', '#B24BF3', '#00FF95'],
    shapes: ['circle', 'square'],
  });

  // Second burst with racing colors
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: count,
      colors: ['#FF4C4C', '#4C9EFF', '#FFD700', '#50C878'],
      shapes: ['circle', 'square'],
    });
  }, 300);

  // Final smaller burst
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 50,
      spread: 100,
      colors: ['#B24BF3', '#00FF95'],
      shapes: ['circle'],
    });
  }, 600);
};
