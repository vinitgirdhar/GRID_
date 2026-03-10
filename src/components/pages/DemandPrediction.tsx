import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, Sparkles, AlertCircle, Cloud, Zap, BrainCircuit } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getActiveHotspotPeriod, getHotspots, getPrediction } from '../../services/apiService';
import { HotspotZone, PredictionResponse } from '../../types';

function getDefaultDate() {
  return new Date().toISOString().split('T')[0];
}

export default function DemandPrediction() {
  const [isLoading, setIsLoading] = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [topZones, setTopZones] = useState<HotspotZone[]>([]);
  const [selectedDate, setSelectedDate] = useState(getDefaultDate());
  const [selectedHour, setSelectedHour] = useState(String(new Date().getHours()));
  const [selectedZoneId, setSelectedZoneId] = useState('');

  useEffect(() => {
    let cancelled = false;

    getHotspots()
      .then((hotspotResponse) => {
        if (cancelled) {
          return;
        }

        const activeZones = getActiveHotspotPeriod(hotspotResponse).zones;
        setTopZones(activeZones);
        setSelectedZoneId(activeZones[0]?.zone_id ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load live hotspot zones. Start the FastAPI backend on port 8000 and refresh.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedZone = topZones.find((zone) => zone.zone_id === selectedZoneId);

  const handlePredict = async () => {
    if (!selectedZoneId) {
      return;
    }

    setIsPredicting(true);
    setPrediction(null);
    setError(null);

    try {
      const response = await getPrediction({
        zoneId: selectedZoneId,
        predictionTime: `${selectedDate}T${selectedHour.padStart(2, '0')}:00:00`,
      });
      setPrediction(response);
    } catch {
      setError('Prediction request failed. Verify the backend is running and try again.');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Demand Prediction</h1>
        <p className="text-[var(--text-secondary)] mt-1">Generate live XGBoost forecasts by target time and zone</p>
      </div>

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Panel: Input */}
        <div className="lg:col-span-5">
          <div className="glass-card p-8 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-primary w-5 h-5" />
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Forecast Parameters</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Target Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Hour of Day</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                  <select
                    value={selectedHour}
                    onChange={(event) => setSelectedHour(event.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none text-[var(--text-primary)]"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i)}>{`${i}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Target Zone</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                  <select
                    value={selectedZoneId}
                    onChange={(event) => setSelectedZoneId(event.target.value)}
                    disabled={isLoading}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none text-[var(--text-primary)]"
                  >
                    {topZones.map((zone) => (
                      <option key={zone.zone_id} value={zone.zone_id}>{`${zone.zone_name} (${zone.borough})`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Top Live Zones</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {topZones.slice(0, 4).map((zone) => (
                  <button
                    key={zone.zone_id}
                    onClick={() => setSelectedZoneId(zone.zone_id)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left transition-colors',
                      selectedZoneId === zone.zone_id
                        ? 'border-primary bg-primary/10 text-[var(--text-primary)]'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:border-primary/40'
                    )}
                  >
                    <p className="text-sm font-semibold">{zone.zone_name}</p>
                    <p className="text-xs">{zone.predicted_demand.toFixed(1)} trips/hr</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePredict}
              disabled={isPredicting || isLoading || !selectedZoneId}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isPredicting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Calculating...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Generate Forecast
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="lg:col-span-7">
          <div className="glass-card p-8 h-full flex flex-col items-center justify-center relative overflow-hidden">
            <AnimatePresence mode="wait">
              {!prediction && !isPredicting && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center space-y-4"
                >
                  <div className="w-20 h-20 bg-[var(--background)] rounded-full flex items-center justify-center mx-auto">
                    <BrainCircuit className="w-10 h-10 text-[var(--text-secondary)] opacity-30" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">Ready for Prediction</h3>
                    <p className="text-[var(--text-secondary)] text-sm max-w-xs mx-auto">
                      {selectedZone
                        ? `Generate a live forecast for ${selectedZone.zone_name}.`
                        : 'Wait for the hotspot list to load, then select a zone and generate a forecast.'}
                    </p>
                  </div>
                </motion.div>
              )}

              {isPredicting && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-6"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold animate-pulse text-[var(--text-primary)]">Processing XGBoost Inference</p>
                    <p className="text-[var(--text-secondary)] text-sm">Scoring the selected zone using the preloaded backend model...</p>
                  </div>
                </motion.div>
              )}

              {prediction && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full space-y-8"
                >
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-2">Predicted Demand</p>
                    <div className="text-7xl font-bold text-primary tracking-tighter">
                      {prediction.predicted_demand.toLocaleString()}
                      <span className="text-2xl font-medium text-[var(--text-secondary)] ml-2">Trips</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <AlertCircle className="w-5 h-5 text-warning mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Demand Level</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{prediction.demand_level}</p>
                    </div>
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <MapPin className="w-5 h-5 text-secondary mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Zone</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{prediction.zone_name}</p>
                    </div>
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <Cloud className="w-5 h-5 text-primary mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Window</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] capitalize">{prediction.active_period}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Model Confidence</span>
                      <span className="font-bold text-success">{(prediction.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--background)] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.confidence * 100}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full bg-success"
                      />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Serving <span className="text-[var(--text-primary)] font-semibold">{prediction.model_label}</span> for {prediction.borough} at {selectedHour.padStart(2, '0')}:00.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
