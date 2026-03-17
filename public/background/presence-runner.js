self.addEventListener('driverPresenceTick', async (event) => {
  const payload = event?.detail ?? {};
  console.log('[GRID BackgroundRunner] presence tick', payload);
});
