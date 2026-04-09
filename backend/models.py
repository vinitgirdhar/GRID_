from sqlalchemy import Column, DateTime, Float, Integer, String, func
from geoalchemy2 import Geometry

from .database import Base


class SpatialZone(Base):
    __tablename__ = "spatial_zones"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    borough = Column(String(128), nullable=True)
    centroid = Column(Geometry("POINT", srid=4326), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DemandSnapshot(Base):
    __tablename__ = "demand_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(32), nullable=False, index=True)
    observed_at = Column(DateTime(timezone=True), nullable=False, index=True)
    predicted_demand = Column(Float, nullable=False)
    demand_level = Column(String(32), nullable=False)
    data_source = Column(String(64), default="xgboost", nullable=False)


class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(String(64), unique=True, nullable=False, index=True)
    zone_id = Column(String(32), nullable=False, index=True)
    prediction_time = Column(DateTime(timezone=True), nullable=False)
    predicted_demand = Column(Float, nullable=False)
    prediction_type = Column(String(16), nullable=False)  # high / medium / low
    suggested_action = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DriverEvent(Base):
    __tablename__ = "driver_events"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(String(64), nullable=False, index=True)
    prediction_id = Column(String(64), nullable=False, index=True)
    zone_id = Column(String(32), nullable=False)
    # event_type: viewed | accepted | moved_to_zone | moved_out_of_zone | feedback_yes | feedback_no
    event_type = Column(String(32), nullable=False)
    event_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ValidationRecord(Base):
    __tablename__ = "validation_records"

    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(String(64), unique=True, nullable=False, index=True)
    actual_demand = Column(Float, nullable=True)
    driver_got_ride = Column(Integer, nullable=False, default=0)  # 0/1 boolean
    pickup_time_minutes = Column(Float, nullable=True)
    # validation_source: feedback | movement | simulation
    validation_source = Column(String(32), nullable=False, default="simulation")
    validated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
