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
