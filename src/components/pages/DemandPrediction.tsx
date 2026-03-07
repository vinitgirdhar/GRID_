import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, Sparkles, AlertCircle, Cloud, Zap, BrainCircuit } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPredictionData } from '../../services/predictionService';

export default function DemandPrediction() {
  const [isPredicting, setIsPredicting] = useState(false);
  const [prediction, setPrediction] = useState<null | {
    value: number;
    intensity: 'Low' | 'Medium' | 'High';
    weather: string;
    category: 'Low' | 'Medium' | 'High';
  }>(null);

  const handlePredict = () => {
    setIsPredicting(true);
    setPrediction(null);

    // Simulate API call using the unified service
    setTimeout(() => {
      const unifiedData = getPredictionData();
      setIsPredicting(false);
      setPrediction({
        value: unifiedData.nextHourDemand + Math.floor(Math.random() * 1000),
        intensity: unifiedData.events[0]?.intensity || 'Medium',
        weather: unifiedData.weather.condition,
        category: unifiedData.currentDemand
      });
    }, 1500);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Demand Prediction</h1>
        <p className="text-[var(--text-secondary)] mt-1">Generate real-time forecasts for specific times and locations</p>
      </div>

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
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors text-[var(--text-primary)]"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Hour of Day</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                  <select className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none text-[var(--text-primary)]">
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{`${i}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Borough</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                  <select className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none text-[var(--text-primary)]">
                    <option>Manhattan</option>
                    <option>Brooklyn</option>
                    <option>Queens</option>
                    <option>Bronx</option>
                    <option>Staten Island</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handlePredict}
              disabled={isPredicting}
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
                    <p className="text-[var(--text-secondary)] text-sm max-w-xs mx-auto">Select parameters and click generate to see the AI-powered demand forecast.</p>
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
                    <p className="text-lg font-semibold animate-pulse text-[var(--text-primary)]">Processing ML Model</p>
                    <p className="text-[var(--text-secondary)] text-sm">Analyzing historical trends & weather data...</p>
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
                      {prediction.value.toLocaleString()}
                      <span className="text-2xl font-medium text-[var(--text-secondary)] ml-2">Rides</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <AlertCircle className="w-5 h-5 text-warning mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Event Intensity</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{prediction.intensity}</p>
                    </div>
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <Cloud className="w-5 h-5 text-secondary mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Weather</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{prediction.weather}</p>
                    </div>
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <div className={cn(
                        "w-2 h-2 rounded-full mx-auto mb-3",
                        prediction.category === 'High' ? 'bg-danger shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                          prediction.category === 'Medium' ? 'bg-warning' : 'bg-success'
                      )}></div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Category</p>
                      <p className={cn(
                        "text-sm font-bold",
                        prediction.category === 'High' ? 'text-danger' :
                          prediction.category === 'Medium' ? 'text-warning' : 'text-success'
                      )}>{prediction.category}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Model Confidence</span>
                      <span className="font-bold text-success">94.2%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--background)] rounded-full mt-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '94.2%' }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full bg-success"
                      />
                    </div>
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
