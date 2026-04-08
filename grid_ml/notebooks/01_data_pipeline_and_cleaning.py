# %% [markdown]
# # 01 — Data Pipeline & Cleaning
# 
# **Grid ML Retraining — Step 1**
# 
# This notebook loads, cleans, and merges all 4 data sources:
# 1. NYC Yellow Taxi trip data (Jun–Nov 2025)
# 2. MTA Transit schedule data
# 3. NYC Events data
# 4. Historical Weather data (Open-Meteo API)
# 
# Output: `data/processed/features_for_training.parquet`

# %% [markdown]
# ## 1. Setup & Imports

# %%
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os
import glob
import requests
import json
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Paths
BASE_DIR = Path("..") 
RAW_DIR = BASE_DIR / "data" / "raw"
EXT_DIR = BASE_DIR / "data" / "external"
PROC_DIR = BASE_DIR / "data" / "processed"
FIG_DIR = BASE_DIR / "outputs" / "figures"

PROC_DIR.mkdir(parents=True, exist_ok=True)
FIG_DIR.mkdir(parents=True, exist_ok=True)

print("✅ Setup complete")

# %% [markdown]
# ## 2. Load NYC Yellow Taxi Data

# %%
parquet_files = sorted(RAW_DIR.glob("yellow_tripdata_*.parquet"))
print(f"Found {len(parquet_files)} parquet files:")
for f in parquet_files:
    size_mb = f.stat().st_size / (1024 * 1024)
    print(f"  {f.name} ({size_mb:.1f} MB)")

# %%
# Load all files
dfs = []
for f in parquet_files:
    df_temp = pd.read_parquet(f)
    dfs.append(df_temp)
    print(f"  Loaded {f.name}: {len(df_temp):,} rows, {df_temp.shape[1]} cols")

taxi_raw = pd.concat(dfs, ignore_index=True)
print(f"\n📊 Total raw taxi records: {len(taxi_raw):,}")
print(f"   Columns: {list(taxi_raw.columns)}")

# %%
# Quick look
taxi_raw.head()

# %%
taxi_raw.info()

# %%
taxi_raw.describe()

# %% [markdown]
# ## 3. Clean Taxi Data

# %%
print(f"Before cleaning: {len(taxi_raw):,} trips")

# Keep only columns we need
keep_cols = [
    'tpep_pickup_datetime', 'tpep_dropoff_datetime',
    'passenger_count', 'trip_distance',
    'PULocationID', 'DOLocationID',
    'fare_amount', 'total_amount', 'tip_amount',
    'payment_type'
]
# Filter to available columns only
keep_cols = [c for c in keep_cols if c in taxi_raw.columns]
taxi = taxi_raw[keep_cols].copy()

# %%
# Apply cleaning filters
initial_count = len(taxi)

# 1. Valid pickup datetime  
taxi = taxi.dropna(subset=['tpep_pickup_datetime'])

# 2. Ensure datetime type
taxi['tpep_pickup_datetime'] = pd.to_datetime(taxi['tpep_pickup_datetime'], errors='coerce')
taxi['tpep_dropoff_datetime'] = pd.to_datetime(taxi['tpep_dropoff_datetime'], errors='coerce')
taxi = taxi.dropna(subset=['tpep_pickup_datetime', 'tpep_dropoff_datetime'])

# 3. Date range filter: Jun-Nov 2025 only
taxi = taxi[
    (taxi['tpep_pickup_datetime'] >= '2025-06-01') &
    (taxi['tpep_pickup_datetime'] < '2025-12-01')
]

# 4. Positive trip distance (> 0.1 miles)
if 'trip_distance' in taxi.columns:
    taxi = taxi[taxi['trip_distance'] > 0.1]

# 5. Reasonable fare (> $2.50 min fare, < $500 max)
if 'fare_amount' in taxi.columns:
    taxi = taxi[(taxi['fare_amount'] >= 2.5) & (taxi['fare_amount'] <= 500)]

# 6. Valid location IDs (1-263 for NYC taxi zones)
taxi = taxi[(taxi['PULocationID'] >= 1) & (taxi['PULocationID'] <= 263)]
taxi = taxi[(taxi['DOLocationID'] >= 1) & (taxi['DOLocationID'] <= 263)]

# 7. Reasonable trip duration (30 sec to 3 hours)
taxi['trip_duration_min'] = (
    taxi['tpep_dropoff_datetime'] - taxi['tpep_pickup_datetime']
).dt.total_seconds() / 60
taxi = taxi[(taxi['trip_duration_min'] > 0.5) & (taxi['trip_duration_min'] <= 180)]

print(f"After cleaning: {len(taxi):,} trips")
print(f"Removed: {initial_count - len(taxi):,} ({(initial_count - len(taxi))/initial_count*100:.1f}%)")

# %%
# Extract temporal features from pickup datetime
taxi['pickup_date'] = taxi['tpep_pickup_datetime'].dt.date
taxi['pickup_hour'] = taxi['tpep_pickup_datetime'].dt.hour
taxi['day_of_week'] = taxi['tpep_pickup_datetime'].dt.dayofweek  # 0=Mon
taxi['month'] = taxi['tpep_pickup_datetime'].dt.month
taxi['is_weekend'] = taxi['day_of_week'].isin([5, 6]).astype(int)
taxi['week_of_year'] = taxi['tpep_pickup_datetime'].dt.isocalendar().week.astype(int)

print("✅ Temporal features extracted")
taxi[['tpep_pickup_datetime', 'pickup_date', 'pickup_hour', 'day_of_week', 'month', 'is_weekend']].head()

# %% [markdown]
# ## 4. Aggregate Demand (Target Variable)

# %%
# Aggregate: trip_count per LocationID per hour
demand = taxi.groupby(
    ['pickup_date', 'pickup_hour', 'PULocationID']
).agg(
    trip_count=('tpep_pickup_datetime', 'count'),
    avg_fare=('fare_amount', 'mean') if 'fare_amount' in taxi.columns else ('tpep_pickup_datetime', 'count'),
    avg_distance=('trip_distance', 'mean') if 'trip_distance' in taxi.columns else ('tpep_pickup_datetime', 'count'),
    avg_duration=('trip_duration_min', 'mean'),
    avg_tip=('tip_amount', 'mean') if 'tip_amount' in taxi.columns else ('tpep_pickup_datetime', 'count'),
).reset_index()

# Convert pickup_date to proper datetime
demand['pickup_date'] = pd.to_datetime(demand['pickup_date'])

# Add temporal features back
demand['day_of_week'] = demand['pickup_date'].dt.dayofweek
demand['month'] = demand['pickup_date'].dt.month
demand['is_weekend'] = demand['day_of_week'].isin([5, 6]).astype(int)
demand['week_of_year'] = demand['pickup_date'].dt.isocalendar().week.astype(int)

# Cyclical time encoding
demand['hour_sin'] = np.sin(2 * np.pi * demand['pickup_hour'] / 24)
demand['hour_cos'] = np.cos(2 * np.pi * demand['pickup_hour'] / 24)
demand['dow_sin'] = np.sin(2 * np.pi * demand['day_of_week'] / 7)
demand['dow_cos'] = np.cos(2 * np.pi * demand['day_of_week'] / 7)

# Rush hour flags
demand['is_morning_rush'] = demand['pickup_hour'].between(7, 9).astype(int)
demand['is_evening_rush'] = demand['pickup_hour'].between(16, 19).astype(int)
demand['is_rush_hour'] = (demand['is_morning_rush'] | demand['is_evening_rush']).astype(int)

# Night flag
demand['is_night'] = demand['pickup_hour'].isin([0,1,2,3,4,5,22,23]).astype(int)

print(f"📊 Demand table: {len(demand):,} rows")
print(f"   Unique dates: {demand['pickup_date'].nunique()}")
print(f"   Unique zones: {demand['PULocationID'].nunique()}")
print(f"   Trip count stats:")
print(demand['trip_count'].describe())

# %%
# Visualize demand distribution
fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# Trip count distribution
axes[0].hist(demand['trip_count'], bins=50, color='#4ECDC4', edgecolor='white')
axes[0].set_title('Trip Count Distribution', fontsize=14, fontweight='bold')
axes[0].set_xlabel('Trips per Zone per Hour')
axes[0].set_ylabel('Frequency')

# Demand by hour
hourly = demand.groupby('pickup_hour')['trip_count'].mean()
axes[1].bar(hourly.index, hourly.values, color='#FF6B6B', edgecolor='white')
axes[1].set_title('Average Demand by Hour', fontsize=14, fontweight='bold')
axes[1].set_xlabel('Hour of Day')
axes[1].set_ylabel('Avg Trips')

# Demand by day of week
daily = demand.groupby('day_of_week')['trip_count'].mean()
days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
axes[2].bar(range(7), daily.values, color='#45B7D1', edgecolor='white', tick_label=days)
axes[2].set_title('Average Demand by Day', fontsize=14, fontweight='bold')
axes[2].set_ylabel('Avg Trips')

plt.tight_layout()
plt.savefig(str(FIG_DIR / 'demand_overview.png'), dpi=150, bbox_inches='tight')
plt.show()
print("✅ Demand overview saved")

# %% [markdown]
# ## 5. Load & Process Transit Data

# %%
transit = pd.read_csv(EXT_DIR / "transit_data.csv")
print(f"📊 Transit data: {len(transit):,} rows, {transit.shape[1]} cols")
print(f"   Columns: {list(transit.columns)}")
transit.head(3)

# %%
# Extract transit features per zone
# Map borough to approximate LocationIDs (using stop_lat/stop_lon proximity)
# For simplicity, we'll create borough-level transit scores

# Borough mapping from stop names
def extract_borough(stop_name):
    if pd.isna(stop_name):
        return 'Unknown'
    stop_name = str(stop_name)
    if 'Manhattan' in stop_name:
        return 'Manhattan'
    elif 'Brooklyn' in stop_name:
        return 'Brooklyn'
    elif 'Queens' in stop_name:
        return 'Queens'
    elif 'Bronx' in stop_name:
        return 'Bronx'
    elif 'Staten' in stop_name:
        return 'Staten Island'
    elif 'Long' in stop_name:
        return 'Queens'  # Long Island stations in Queens
    return 'Unknown'

transit['borough'] = transit['stop_name'].apply(extract_borough)

# Service day columns
service_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

# Transit features per borough
transit_features = transit.groupby('borough').agg(
    transit_stop_count=('stop_id', 'nunique'),
    transit_route_count=('route_id', 'nunique'),
    transit_trip_count=('trip_id', 'nunique'),
    avg_weekday_service=('monday', 'mean'),
    avg_weekend_service=('saturday', 'mean'),
).reset_index()

# Compute transit accessibility score (0-100)
transit_features['transit_score'] = (
    transit_features['transit_stop_count'] * 0.3 +
    transit_features['transit_route_count'] * 0.3 +
    transit_features['transit_trip_count'] * 0.4
)
# Normalize to 0-100
max_score = transit_features['transit_score'].max()
if max_score > 0:
    transit_features['transit_score'] = (transit_features['transit_score'] / max_score * 100).round(1)

print("\n📊 Transit features by borough:")
print(transit_features.to_string(index=False))

# %%
# Map taxi LocationIDs to boroughs (approximate mapping)
# NYC taxi zone borough mapping
BOROUGH_ZONES = {
    'Manhattan': list(range(4, 13)) + list(range(13, 25)) + list(range(24, 52)) + 
                 list(range(50, 75)) + list(range(87, 89)) + list(range(90, 92)) +
                 list(range(100, 105)) + list(range(107, 114)) + list(range(113, 120)) +
                 list(range(125, 128)) + list(range(128, 154)) + list(range(158, 165)) +
                 list(range(166, 170)) + list(range(186, 195)) + list(range(202, 210)) +
                 list(range(211, 215)) + list(range(224, 234)) + list(range(236, 244)) +
                 list(range(246, 250)) + list(range(261, 264)),
    'Brooklyn': list(range(11, 12)) + list(range(14, 18)) + list(range(21, 23)) +
                list(range(25, 27)) + list(range(29, 30)) + list(range(33, 36)) +
                list(range(37, 40)) + list(range(52, 55)) + list(range(60, 67)) +
                list(range(69, 72)) + list(range(76, 78)) + list(range(80, 86)) +
                list(range(89, 90)) + list(range(97, 98)) + list(range(106, 107)) +
                list(range(108, 109)) + list(range(123, 124)) + list(range(149, 150)) +
                list(range(154, 156)) + list(range(165, 166)) + list(range(177, 182)) +
                list(range(183, 186)) + list(range(188, 190)) + list(range(195, 198)) +
                list(range(210, 211)) + list(range(217, 223)) + list(range(225, 228)) +
                list(range(234, 236)) + list(range(240, 243)) + list(range(248, 252)) +
                list(range(254, 258)),
    'Queens': list(range(2, 4)) + list(range(7, 11)) + list(range(15, 16)) +
              list(range(19, 21)) + list(range(27, 28)) + list(range(30, 32)) +
              list(range(35, 37)) + list(range(38, 39)) + list(range(56, 58)) +
              list(range(64, 65)) + list(range(70, 71)) + list(range(73, 74)) +
              list(range(82, 84)) + list(range(86, 87)) + list(range(93, 96)) +
              list(range(98, 100)) + list(range(117, 118)) + list(range(121, 123)) +
              list(range(129, 132)) + list(range(133, 135)) + list(range(138, 140)) +
              list(range(144, 146)) + list(range(155, 158)) + list(range(160, 162)) +
              list(range(171, 173)) + list(range(175, 177)) + list(range(179, 181)) +
              list(range(196, 198)) + list(range(200, 202)) + list(range(203, 205)) +
              list(range(215, 217)) + list(range(219, 221)) + list(range(223, 225)) +
              list(range(229, 231)) + list(range(252, 254)) + list(range(258, 261)),
    'Bronx': list(range(3, 4)) + list(range(18, 19)) + list(range(31, 32)) +
             list(range(46, 48)) + list(range(59, 60)) + list(range(69, 70)) +
             list(range(78, 79)) + list(range(81, 82)) + list(range(94, 95)) +
             list(range(119, 121)) + list(range(126, 127)) + list(range(136, 137)) +
             list(range(147, 148)) + list(range(159, 160)) + list(range(167, 170)) +
             list(range(174, 175)) + list(range(182, 183)) + list(range(184, 185)) +
             list(range(199, 200)) + list(range(208, 209)) + list(range(212, 213)) +
             list(range(213, 214)) + list(range(220, 221)) + list(range(235, 236)) +
             list(range(240, 241)) + list(range(242, 243)) + list(range(247, 248)) +
             list(range(250, 251)) + list(range(254, 255)) + list(range(259, 260)),
    'Staten Island': list(range(5, 6)) + list(range(6, 7)) + list(range(22, 23)) +
                     list(range(23, 24)) + list(range(24, 25)) + list(range(43, 44)) +
                     list(range(44, 45)) + list(range(45, 46)) + list(range(78, 79)) +
                     list(range(84, 85)) + list(range(109, 110)) + list(range(110, 111)) +
                     list(range(111, 112)) + list(range(115, 116)) + list(range(116, 117)) +
                     list(range(118, 119)) + list(range(156, 157)) + list(range(172, 173)) +
                     list(range(176, 177)) + list(range(187, 188)) + list(range(204, 206)) +
                     list(range(214, 215)) + list(range(245, 246)) + list(range(251, 252)),
}

# Create zone-to-borough mapping
zone_to_borough = {}
for borough, zones in BOROUGH_ZONES.items():
    for zone in zones:
        zone_to_borough[zone] = borough

# Map PULocationID to borough
demand['borough'] = demand['PULocationID'].map(zone_to_borough).fillna('Unknown')

# Merge transit features
demand = demand.merge(
    transit_features[['borough', 'transit_stop_count', 'transit_route_count', 
                       'transit_trip_count', 'transit_score']],
    on='borough', how='left'
)
# Fill missing transit data with 0
transit_cols = ['transit_stop_count', 'transit_route_count', 'transit_trip_count', 'transit_score']
demand[transit_cols] = demand[transit_cols].fillna(0)

print(f"✅ Transit features merged. {demand['borough'].value_counts().to_dict()}")

# %% [markdown]
# ## 6. Load & Process Events Data

# %%
events = pd.read_csv(EXT_DIR / "events.csv")
print(f"📊 Events data: {len(events):,} rows")
print(f"   Date range: {events['event_date'].min()} to {events['event_date'].max()}")
print(f"   Categories: {events['event_category'].unique()}")
print(f"   Boroughs: {events['borough'].unique()}")
events.head()

# %%
events['event_date'] = pd.to_datetime(events['event_date'])

# Aggregate events per date per borough
events_agg = events.groupby(['event_date', 'borough']).agg(
    event_count=('event_id', 'count'),
    total_attendance=('estimated_attendance', 'sum'),
    max_intensity=('event_intensity_score', 'max'),
    avg_intensity=('event_intensity_score', 'mean'),
    has_sports=('event_category', lambda x: int(any('Sports' in str(c) for c in x))),
    has_entertainment=('event_category', lambda x: int(any('Entertainment' in str(c) for c in x))),
    has_cultural=('event_category', lambda x: int(any('Cultural' in str(c) for c in x))),
    has_business=('event_category', lambda x: int(any('Business' in str(c) for c in x))),
).reset_index()

# Normalize attendance to a score
max_attend = events_agg['total_attendance'].max()
if max_attend > 0:
    events_agg['attendance_score'] = (events_agg['total_attendance'] / max_attend * 100).round(1)
else:
    events_agg['attendance_score'] = 0

print(f"\n📊 Events aggregated: {len(events_agg):,} rows")
print(events_agg.head())

# %%
# Merge events into demand
demand = demand.merge(
    events_agg,
    left_on=['pickup_date', 'borough'],
    right_on=['event_date', 'borough'],
    how='left'
)
demand.drop(columns=['event_date'], errors='ignore', inplace=True)

# Fill missing event data (days with no events)
event_cols = ['event_count', 'total_attendance', 'max_intensity', 'avg_intensity',
              'has_sports', 'has_entertainment', 'has_cultural', 'has_business', 'attendance_score']
demand[event_cols] = demand[event_cols].fillna(0)

print(f"✅ Events merged. Non-zero event days: {(demand['event_count'] > 0).sum():,} / {len(demand):,}")

# %% [markdown]
# ## 7. Fetch & Process Weather Data

# %%
# Fetch historical weather from Open-Meteo (free, no API key needed)
# NYC coordinates: 40.7128, -74.0060

def fetch_weather_data(start_date, end_date, lat=40.7128, lon=-74.0060):
    """Fetch hourly weather from Open-Meteo Historical API."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation,rain,windspeed_10m,weathercode",
        "timezone": "America/New_York"
    }
    
    print(f"Fetching weather: {start_date} to {end_date}...")
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    
    hourly = data['hourly']
    weather_df = pd.DataFrame({
        'datetime': pd.to_datetime(hourly['time']),
        'temperature': hourly['temperature_2m'],
        'humidity': hourly['relative_humidity_2m'],
        'precipitation': hourly['precipitation'],
        'rain': hourly['rain'],
        'windspeed': hourly['windspeed_10m'],
        'weathercode': hourly['weathercode'],
    })
    
    print(f"  Got {len(weather_df):,} hourly records")
    return weather_df

# Fetch in chunks to avoid API limits
weather_chunks = []
date_ranges = [
    ('2025-06-01', '2025-07-31'),
    ('2025-08-01', '2025-09-30'),
    ('2025-10-01', '2025-11-30'),
]

for start, end in date_ranges:
    try:
        chunk = fetch_weather_data(start, end)
        weather_chunks.append(chunk)
    except Exception as e:
        print(f"  ⚠️ Failed for {start}-{end}: {e}")
        print("  Generating synthetic weather as fallback...")
        # Fallback: generate realistic synthetic weather for NYC
        dates = pd.date_range(start, end, freq='h')
        np.random.seed(42)
        chunk = pd.DataFrame({
            'datetime': dates,
            'temperature': np.random.normal(25, 8, len(dates)).clip(-5, 40),
            'humidity': np.random.normal(65, 15, len(dates)).clip(20, 100),
            'precipitation': np.random.exponential(0.3, len(dates)).clip(0, 20),
            'rain': np.random.exponential(0.2, len(dates)).clip(0, 15),
            'windspeed': np.random.normal(12, 5, len(dates)).clip(0, 50),
            'weathercode': np.random.choice([0, 1, 2, 3, 51, 61, 63, 80], len(dates), 
                                             p=[0.35, 0.2, 0.15, 0.1, 0.05, 0.05, 0.05, 0.05]),
        })
        weather_chunks.append(chunk)

weather = pd.concat(weather_chunks, ignore_index=True)
weather['weather_date'] = weather['datetime'].dt.date
weather['weather_hour'] = weather['datetime'].dt.hour

# Weather condition categories from WMO codes
def categorize_weather(code):
    if code <= 3:
        return 'clear'
    elif code <= 49:
        return 'foggy'
    elif code <= 59:
        return 'drizzle'
    elif code <= 69:
        return 'rain'
    elif code <= 79:
        return 'snow'
    elif code <= 82:
        return 'showers'
    elif code <= 86:
        return 'snow_showers'
    else:
        return 'thunderstorm'

weather['weather_category'] = weather['weathercode'].apply(categorize_weather)

# Binary flags
weather['is_rainy'] = (weather['precipitation'] > 0.5).astype(int)
weather['is_hot'] = (weather['temperature'] > 30).astype(int)
weather['is_cold'] = (weather['temperature'] < 5).astype(int)
weather['is_windy'] = (weather['windspeed'] > 25).astype(int)

print(f"\n📊 Weather data: {len(weather):,} hours")
print(f"   Date range: {weather['datetime'].min()} to {weather['datetime'].max()}")
print(f"   Temperature: {weather['temperature'].min():.1f}°C to {weather['temperature'].max():.1f}°C")
print(f"   Weather categories: {weather['weather_category'].value_counts().to_dict()}")

# %%
# Merge weather into demand
demand['pickup_date_dt'] = pd.to_datetime(demand['pickup_date'])
weather['weather_date'] = pd.to_datetime(weather['weather_date'])

demand = demand.merge(
    weather[['weather_date', 'weather_hour', 'temperature', 'humidity', 
             'precipitation', 'windspeed', 'weathercode',
             'is_rainy', 'is_hot', 'is_cold', 'is_windy']],
    left_on=['pickup_date_dt', 'pickup_hour'],
    right_on=['weather_date', 'weather_hour'],
    how='left'
)
demand.drop(columns=['weather_date', 'weather_hour', 'pickup_date_dt'], errors='ignore', inplace=True)

# Fill missing weather with medians
weather_cols = ['temperature', 'humidity', 'precipitation', 'windspeed', 'weathercode',
                'is_rainy', 'is_hot', 'is_cold', 'is_windy']
for col in weather_cols:
    if col in demand.columns:
        demand[col] = demand[col].fillna(demand[col].median())

print(f"✅ Weather merged. Null weather rows: {demand['temperature'].isna().sum()}")

# %% [markdown]
# ## 8. Lag Features & Final Feature Engineering

# %%
# Sort for proper lag computation
demand = demand.sort_values(['PULocationID', 'pickup_date', 'pickup_hour']).reset_index(drop=True)

# Create lag features per zone
demand['demand_lag_1h'] = demand.groupby('PULocationID')['trip_count'].shift(1)
demand['demand_lag_2h'] = demand.groupby('PULocationID')['trip_count'].shift(2)
demand['demand_lag_24h'] = demand.groupby('PULocationID')['trip_count'].shift(24)

# Rolling features per zone
demand['demand_rolling_4h_mean'] = demand.groupby('PULocationID')['trip_count'].transform(
    lambda x: x.rolling(4, min_periods=1).mean()
)
demand['demand_rolling_24h_mean'] = demand.groupby('PULocationID')['trip_count'].transform(
    lambda x: x.rolling(24, min_periods=1).mean()
)
demand['demand_rolling_7d_mean'] = demand.groupby('PULocationID')['trip_count'].transform(
    lambda x: x.rolling(24*7, min_periods=1).mean()
)

# Fill NaN lags with column mean  
lag_cols = ['demand_lag_1h', 'demand_lag_2h', 'demand_lag_24h',
            'demand_rolling_4h_mean', 'demand_rolling_24h_mean', 'demand_rolling_7d_mean']
for col in lag_cols:
    demand[col] = demand[col].fillna(demand[col].mean())

print(f"✅ Lag features added")

# %%
# Final feature selection
feature_cols = [
    # Temporal
    'pickup_hour', 'day_of_week', 'month', 'is_weekend', 'week_of_year',
    'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
    'is_morning_rush', 'is_evening_rush', 'is_rush_hour', 'is_night',
    # Spatial
    'PULocationID',
    # Transit
    'transit_stop_count', 'transit_route_count', 'transit_trip_count', 'transit_score',
    # Events
    'event_count', 'total_attendance', 'max_intensity', 'avg_intensity',
    'has_sports', 'has_entertainment', 'has_cultural', 'has_business', 'attendance_score',
    # Weather
    'temperature', 'humidity', 'precipitation', 'windspeed', 'weathercode',
    'is_rainy', 'is_hot', 'is_cold', 'is_windy',
    # Lag/Rolling
    'demand_lag_1h', 'demand_lag_2h', 'demand_lag_24h',
    'demand_rolling_4h_mean', 'demand_rolling_24h_mean', 'demand_rolling_7d_mean',
]

# Keep only features that exist
feature_cols = [c for c in feature_cols if c in demand.columns]

target_col = 'trip_count'

# Build final dataset
features_df = demand[['pickup_date', 'pickup_hour', 'PULocationID', 'borough'] + feature_cols + [target_col]].copy()

# Drop any remaining NaN rows
before = len(features_df)
features_df = features_df.dropna(subset=feature_cols + [target_col])
print(f"Dropped {before - len(features_df)} NaN rows")

print(f"\n📊 Final dataset: {len(features_df):,} rows, {len(feature_cols)} features")
print(f"   Features: {feature_cols}")
print(f"   Target: {target_col}")
print(f"\n   Target stats:")
print(features_df[target_col].describe())

# %% [markdown]
# ## 9. Exploratory Visualizations

# %%
# Correlation heatmap for numerical features
fig, ax = plt.subplots(figsize=(20, 16))
numeric_cols = features_df[feature_cols].select_dtypes(include=[np.number]).columns.tolist()
corr_with_target = features_df[numeric_cols + [target_col]].corr()[target_col].drop(target_col).sort_values()

colors = ['#FF6B6B' if v < 0 else '#4ECDC4' for v in corr_with_target.values]
corr_with_target.plot(kind='barh', ax=ax, color=colors, edgecolor='white')
ax.set_title('Feature Correlation with Trip Count', fontsize=16, fontweight='bold')
ax.set_xlabel('Pearson Correlation')
ax.axvline(x=0, color='gray', linestyle='--', alpha=0.5)
plt.tight_layout()
plt.savefig(str(FIG_DIR / 'feature_correlations.png'), dpi=150, bbox_inches='tight')
plt.show()

# %%
# Weather impact on demand
fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# Temperature vs demand
axes[0].scatter(features_df['temperature'], features_df['trip_count'], alpha=0.05, s=1, color='#FF6B6B')
axes[0].set_title('Temperature vs Demand', fontsize=14, fontweight='bold')
axes[0].set_xlabel('Temperature (°C)')
axes[0].set_ylabel('Trip Count')

# Rain impact
rain_groups = features_df.groupby('is_rainy')['trip_count'].mean()
axes[1].bar(['No Rain', 'Rainy'], rain_groups.values, color=['#4ECDC4', '#45B7D1'], edgecolor='white')
axes[1].set_title('Rain Impact on Demand', fontsize=14, fontweight='bold')
axes[1].set_ylabel('Avg Trip Count')

# Event impact
event_groups = features_df.groupby(features_df['event_count'] > 0)['trip_count'].mean()
axes[2].bar(['No Events', 'Event Day'], event_groups.values, color=['#FFE66D', '#FF6B6B'], edgecolor='white')
axes[2].set_title('Event Impact on Demand', fontsize=14, fontweight='bold')
axes[2].set_ylabel('Avg Trip Count')

plt.tight_layout()
plt.savefig(str(FIG_DIR / 'external_factors_impact.png'), dpi=150, bbox_inches='tight')
plt.show()

# %% [markdown]
# ## 10. Save Processed Data

# %%
# Save the features dataset
features_df.to_parquet(PROC_DIR / 'features_for_training.parquet', index=False)

# Also save feature names for model serving
with open(str(BASE_DIR / 'models' / 'feature_names.txt'), 'w') as f:
    f.write('\n'.join(feature_cols))

print(f"✅ Saved features_for_training.parquet ({len(features_df):,} rows)")
print(f"✅ Saved feature_names.txt ({len(feature_cols)} features)")
print(f"\n🎉 Step 1 COMPLETE — Data pipeline ready for model training!")
