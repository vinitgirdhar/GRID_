"""Step 1 - Data Pipeline: Load, clean, merge all 4 sources, save features."""
import pandas as pd
import numpy as np
import requests
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

print('=== LOADING ALL DATA SOURCES ===')

# --- 1. LOAD TAXI DATA ---
RAW_DIR = Path('data/raw')
parquet_files = sorted(RAW_DIR.glob('yellow_tripdata_*.parquet'))
dfs = []
for f in parquet_files:
    df_temp = pd.read_parquet(f)
    dfs.append(df_temp)
    print(f'  Loaded {f.name}: {len(df_temp):,} rows')

taxi_raw = pd.concat(dfs, ignore_index=True)
print(f'Total raw taxi records: {len(taxi_raw):,}')

# --- 2. CLEAN TAXI DATA ---
keep_cols = ['tpep_pickup_datetime', 'tpep_dropoff_datetime',
             'passenger_count', 'trip_distance',
             'PULocationID', 'DOLocationID',
             'fare_amount', 'total_amount', 'tip_amount', 'payment_type']
keep_cols = [c for c in keep_cols if c in taxi_raw.columns]
taxi = taxi_raw[keep_cols].copy()
del taxi_raw, dfs

taxi = taxi.dropna(subset=['tpep_pickup_datetime'])
taxi['tpep_pickup_datetime'] = pd.to_datetime(taxi['tpep_pickup_datetime'], errors='coerce')
taxi['tpep_dropoff_datetime'] = pd.to_datetime(taxi['tpep_dropoff_datetime'], errors='coerce')
taxi = taxi.dropna(subset=['tpep_pickup_datetime', 'tpep_dropoff_datetime'])
taxi = taxi[(taxi['tpep_pickup_datetime'] >= '2025-06-01') & (taxi['tpep_pickup_datetime'] < '2025-12-01')]
if 'trip_distance' in taxi.columns:
    taxi = taxi[taxi['trip_distance'] > 0.1]
if 'fare_amount' in taxi.columns:
    taxi = taxi[(taxi['fare_amount'] >= 2.5) & (taxi['fare_amount'] <= 500)]
taxi = taxi[(taxi['PULocationID'] >= 1) & (taxi['PULocationID'] <= 263)]
taxi = taxi[(taxi['DOLocationID'] >= 1) & (taxi['DOLocationID'] <= 263)]
taxi['trip_duration_min'] = (taxi['tpep_dropoff_datetime'] - taxi['tpep_pickup_datetime']).dt.total_seconds() / 60
taxi = taxi[(taxi['trip_duration_min'] > 0.5) & (taxi['trip_duration_min'] <= 180)]

taxi['pickup_date'] = taxi['tpep_pickup_datetime'].dt.date
taxi['pickup_hour'] = taxi['tpep_pickup_datetime'].dt.hour
taxi['day_of_week'] = taxi['tpep_pickup_datetime'].dt.dayofweek
taxi['month'] = taxi['tpep_pickup_datetime'].dt.month
taxi['is_weekend'] = taxi['day_of_week'].isin([5, 6]).astype(int)
taxi['week_of_year'] = taxi['tpep_pickup_datetime'].dt.isocalendar().week.astype(int)

print(f'After cleaning: {len(taxi):,} trips')

# --- 3. AGGREGATE DEMAND ---
demand = taxi.groupby(['pickup_date', 'pickup_hour', 'PULocationID']).agg(
    trip_count=('tpep_pickup_datetime', 'count'),
    avg_fare=('fare_amount', 'mean'),
    avg_distance=('trip_distance', 'mean'),
    avg_duration=('trip_duration_min', 'mean'),
).reset_index()
del taxi

demand['pickup_date'] = pd.to_datetime(demand['pickup_date'])
demand['day_of_week'] = demand['pickup_date'].dt.dayofweek
demand['month'] = demand['pickup_date'].dt.month
demand['is_weekend'] = demand['day_of_week'].isin([5, 6]).astype(int)
demand['week_of_year'] = demand['pickup_date'].dt.isocalendar().week.astype(int)
demand['hour_sin'] = np.sin(2 * np.pi * demand['pickup_hour'] / 24)
demand['hour_cos'] = np.cos(2 * np.pi * demand['pickup_hour'] / 24)
demand['dow_sin'] = np.sin(2 * np.pi * demand['day_of_week'] / 7)
demand['dow_cos'] = np.cos(2 * np.pi * demand['day_of_week'] / 7)
demand['is_morning_rush'] = demand['pickup_hour'].between(7, 9).astype(int)
demand['is_evening_rush'] = demand['pickup_hour'].between(16, 19).astype(int)
demand['is_rush_hour'] = (demand['is_morning_rush'] | demand['is_evening_rush']).astype(int)
demand['is_night'] = demand['pickup_hour'].isin([0,1,2,3,4,5,22,23]).astype(int)

print(f'Demand table: {len(demand):,} rows')

# --- 4. BOROUGH MAPPING ---
MANHATTAN = {4,12,13,24,41,42,43,45,48,50,68,74,75,79,87,88,90,100,107,113,114,
             125,127,128,137,140,141,142,143,144,148,151,152,153,158,161,162,163,
             164,166,170,186,194,202,209,211,224,229,230,231,232,233,234,236,237,
             239,243,244,246,249,261,262,263}
BROOKLYN = {11,14,15,16,17,21,22,25,26,29,33,34,35,36,37,39,40,52,54,55,60,61,
            62,63,65,66,67,69,71,72,76,77,80,85,89,97,106,108,111,112,123,149,
            150,154,155,165,177,178,179,181,188,189,190,195,210,217,218,219,225,
            227,228,240,241,242,248,252,255,256,257}
QUEENS = {2,7,8,9,10,15,19,20,27,28,30,31,35,38,56,57,64,70,73,82,83,86,93,
          94,95,98,99,117,121,122,129,130,131,132,133,134,135,138,139,145,146,
          155,156,157,160,171,175,176,179,180,196,197,200,201,203,204,215,216,
          223,253,258,259,260}
BRONX = {3,18,31,46,47,59,69,78,81,94,119,120,126,136,147,159,167,168,169,174,
         182,184,199,208,212,213,220,235,240,247,250,254}
STATEN = {5,6,23,44,78,84,109,110,115,116,118,156,172,176,187,204,205,214,245,251}

def zone_to_borough(zid):
    if zid in MANHATTAN: return 'Manhattan'
    if zid in BROOKLYN: return 'Brooklyn'
    if zid in QUEENS: return 'Queens'
    if zid in BRONX: return 'Bronx'
    if zid in STATEN: return 'Staten Island'
    return 'Unknown'

demand['borough'] = demand['PULocationID'].apply(zone_to_borough)
boro_counts = demand['borough'].value_counts().to_dict()
print(f'Borough distribution: {boro_counts}')

# --- 5. TRANSIT FEATURES ---
transit = pd.read_csv('data/external/transit_data.csv')
def extract_borough(stop_name):
    if pd.isna(stop_name): return 'Unknown'
    s = str(stop_name)
    for b in ['Manhattan','Brooklyn','Queens','Bronx']:
        if b in s: return b
    if 'Staten' in s: return 'Staten Island'
    if 'Long' in s: return 'Queens'
    return 'Unknown'

transit['borough'] = transit['stop_name'].apply(extract_borough)
transit_features = transit.groupby('borough').agg(
    transit_stop_count=('stop_id', 'nunique'),
    transit_route_count=('route_id', 'nunique'),
    transit_trip_count=('trip_id', 'nunique'),
).reset_index()
transit_features['transit_score'] = (
    transit_features['transit_stop_count'] * 0.3 +
    transit_features['transit_route_count'] * 0.3 +
    transit_features['transit_trip_count'] * 0.4
)
max_score = transit_features['transit_score'].max()
if max_score > 0:
    transit_features['transit_score'] = (transit_features['transit_score'] / max_score * 100).round(1)

demand = demand.merge(
    transit_features[['borough','transit_stop_count','transit_route_count','transit_trip_count','transit_score']],
    on='borough', how='left')
for c in ['transit_stop_count','transit_route_count','transit_trip_count','transit_score']:
    demand[c] = demand[c].fillna(0)
print('Transit merged')

# --- 6. EVENTS ---
events = pd.read_csv('data/external/events.csv')
events['event_date'] = pd.to_datetime(events['event_date'])
events_agg = events.groupby(['event_date','borough']).agg(
    event_count=('event_id','count'),
    total_attendance=('estimated_attendance','sum'),
    max_intensity=('event_intensity_score','max'),
    avg_intensity=('event_intensity_score','mean'),
    has_sports=('event_category', lambda x: int(any('Sports' in str(c) for c in x))),
    has_entertainment=('event_category', lambda x: int(any('Entertainment' in str(c) for c in x))),
).reset_index()
max_attend = events_agg['total_attendance'].max()
events_agg['attendance_score'] = (events_agg['total_attendance'] / max_attend * 100).round(1) if max_attend > 0 else 0

demand = demand.merge(events_agg, left_on=['pickup_date','borough'], right_on=['event_date','borough'], how='left')
demand.drop(columns=['event_date'], errors='ignore', inplace=True)
event_fill = ['event_count','total_attendance','max_intensity','avg_intensity','has_sports','has_entertainment','attendance_score']
for c in event_fill:
    demand[c] = demand[c].fillna(0)
print('Events merged')

# --- 7. WEATHER ---
def fetch_weather(start, end):
    url = 'https://archive-api.open-meteo.com/v1/archive'
    params = {'latitude':40.7128,'longitude':-74.006,'start_date':start,'end_date':end,
              'hourly':'temperature_2m,relative_humidity_2m,precipitation,windspeed_10m,weathercode',
              'timezone':'America/New_York'}
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        h = resp.json()['hourly']
        return pd.DataFrame({'datetime':pd.to_datetime(h['time']),'temperature':h['temperature_2m'],
                             'humidity':h['relative_humidity_2m'],'precipitation':h['precipitation'],
                             'windspeed':h['windspeed_10m'],'weathercode':h['weathercode']})
    except Exception as e:
        print(f'  Weather API failed ({e}), using synthetic')
        dates = pd.date_range(start, end, freq='h')
        np.random.seed(42)
        return pd.DataFrame({'datetime':dates,
            'temperature':np.random.normal(22,8,len(dates)).clip(-5,40),
            'humidity':np.random.normal(65,15,len(dates)).clip(20,100),
            'precipitation':np.random.exponential(0.3,len(dates)).clip(0,20),
            'windspeed':np.random.normal(12,5,len(dates)).clip(0,50),
            'weathercode':np.random.choice([0,1,2,3,51,61,63,80],len(dates),p=[.35,.2,.15,.1,.05,.05,.05,.05])})

chunks = []
for s,e in [('2025-06-01','2025-07-31'),('2025-08-01','2025-09-30'),('2025-10-01','2025-11-30')]:
    print(f'  Fetching weather {s} to {e}...')
    chunks.append(fetch_weather(s,e))
weather = pd.concat(chunks, ignore_index=True)
weather['weather_date'] = weather['datetime'].dt.date
weather['weather_hour'] = weather['datetime'].dt.hour
weather['is_rainy'] = (weather['precipitation'] > 0.5).astype(int)
weather['is_hot'] = (weather['temperature'] > 30).astype(int)
weather['is_cold'] = (weather['temperature'] < 5).astype(int)
weather['is_windy'] = (weather['windspeed'] > 25).astype(int)
print(f'Weather data: {len(weather):,} hours')

demand['pickup_date_dt'] = pd.to_datetime(demand['pickup_date'])
weather['weather_date'] = pd.to_datetime(weather['weather_date'])
demand = demand.merge(
    weather[['weather_date','weather_hour','temperature','humidity','precipitation','windspeed','weathercode','is_rainy','is_hot','is_cold','is_windy']],
    left_on=['pickup_date_dt','pickup_hour'], right_on=['weather_date','weather_hour'], how='left')
demand.drop(columns=['weather_date','weather_hour','pickup_date_dt'], errors='ignore', inplace=True)
for c in ['temperature','humidity','precipitation','windspeed','weathercode','is_rainy','is_hot','is_cold','is_windy']:
    if c in demand.columns:
        demand[c] = demand[c].fillna(demand[c].median())
print('Weather merged')

# --- 8. LAG FEATURES ---
demand = demand.sort_values(['PULocationID','pickup_date','pickup_hour']).reset_index(drop=True)
demand['demand_lag_1h'] = demand.groupby('PULocationID')['trip_count'].shift(1)
demand['demand_lag_2h'] = demand.groupby('PULocationID')['trip_count'].shift(2)
demand['demand_lag_24h'] = demand.groupby('PULocationID')['trip_count'].shift(24)
demand['demand_rolling_4h_mean'] = demand.groupby('PULocationID')['trip_count'].transform(lambda x: x.rolling(4, min_periods=1).mean())
demand['demand_rolling_24h_mean'] = demand.groupby('PULocationID')['trip_count'].transform(lambda x: x.rolling(24, min_periods=1).mean())
demand['demand_rolling_7d_mean'] = demand.groupby('PULocationID')['trip_count'].transform(lambda x: x.rolling(24*7, min_periods=1).mean())
for c in ['demand_lag_1h','demand_lag_2h','demand_lag_24h','demand_rolling_4h_mean','demand_rolling_24h_mean','demand_rolling_7d_mean']:
    demand[c] = demand[c].fillna(demand[c].mean())
print('Lag features added')

# --- 9. FINAL FEATURE SET ---
feature_cols = [
    'pickup_hour','day_of_week','month','is_weekend','week_of_year',
    'hour_sin','hour_cos','dow_sin','dow_cos',
    'is_morning_rush','is_evening_rush','is_rush_hour','is_night',
    'PULocationID',
    'transit_stop_count','transit_route_count','transit_trip_count','transit_score',
    'event_count','total_attendance','max_intensity','avg_intensity','has_sports','has_entertainment','attendance_score',
    'temperature','humidity','precipitation','windspeed','weathercode','is_rainy','is_hot','is_cold','is_windy',
    'demand_lag_1h','demand_lag_2h','demand_lag_24h','demand_rolling_4h_mean','demand_rolling_24h_mean','demand_rolling_7d_mean',
]
feature_cols = [c for c in feature_cols if c in demand.columns]

meta_cols = ['pickup_date','pickup_hour','PULocationID','borough']
all_cols = meta_cols + [c for c in feature_cols if c not in meta_cols] + ['trip_count']
features_df = demand[all_cols].copy()
before = len(features_df)
features_df = features_df.dropna(subset=feature_cols + ['trip_count'])
dropped = before - len(features_df)
print(f'Dropped {dropped} NaN rows')
print(f'Final dataset: {len(features_df):,} rows, {len(feature_cols)} features')
print(f'Target stats:')
print(features_df['trip_count'].describe())

# --- 10. SAVE ---
Path('data/processed').mkdir(parents=True, exist_ok=True)
Path('models').mkdir(parents=True, exist_ok=True)

features_df.to_parquet('data/processed/features_for_training.parquet', index=False)
with open('models/feature_names.txt','w') as f:
    f.write('\n'.join(feature_cols))

print(f'Saved features_for_training.parquet ({len(features_df):,} rows)')
print(f'Saved feature_names.txt ({len(feature_cols)} features)')
print('STEP 1 COMPLETE')
