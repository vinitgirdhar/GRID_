import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import relationship

try:
    from geoalchemy2 import Geometry
except Exception:  # pragma: no cover - local sqlite fallback
    Geometry = None

from .database import ACTIVE_DATABASE_URL, Base


USE_GEOMETRY = Geometry is not None and not ACTIVE_DATABASE_URL.startswith("sqlite")


class SpatialZone(Base):
    __tablename__ = "spatial_zones"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    borough = Column(String(128), nullable=True)
    centroid = Column(Geometry("POINT", srid=4326), nullable=True) if USE_GEOMETRY else Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DemandSnapshot(Base):
    __tablename__ = "demand_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(32), nullable=False, index=True)
    observed_at = Column(DateTime(timezone=True), nullable=False, index=True)
    predicted_demand = Column(Float, nullable=False)
    demand_level = Column(String(32), nullable=False)
    data_source = Column(String(64), default="xgboost", nullable=False)


def _uuid() -> str:
    return str(uuid.uuid4())


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=True)
    vehicle_number = Column(String(64), nullable=True)
    password_hash = Column(Text, nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    sessions = relationship("DriverSession", back_populates="driver")
    trip_offers = relationship("TripOffer", back_populates="driver")
    trips = relationship("Trip", back_populates="driver")
    notifications = relationship("Notification", back_populates="driver")


class DriverSession(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=_uuid)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    refresh_token_jti = Column(String(64), nullable=False, unique=True, index=True)
    status = Column(String(32), nullable=False, default="active")
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    driver = relationship("Driver", back_populates="sessions")
    location_points = relationship("LocationPoint", back_populates="session")


class TripOffer(Base):
    __tablename__ = "trip_offers"

    id = Column(String(36), primary_key=True, default=_uuid)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    status = Column(String(32), nullable=False, default="offered")
    pickup_label = Column(String(255), nullable=False)
    dropoff_label = Column(String(255), nullable=False)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    dropoff_lat = Column(Float, nullable=False)
    dropoff_lng = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)
    estimated_fare = Column(Numeric(10, 2), nullable=False)
    zone_id = Column(String(32), nullable=True)
    borough = Column(String(128), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    driver = relationship("Driver", back_populates="trip_offers")
    trip = relationship("Trip", back_populates="offer", uselist=False)


class Trip(Base):
    __tablename__ = "trips"

    id = Column(String(36), primary_key=True, default=_uuid)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    offer_id = Column(String(36), ForeignKey("trip_offers.id"), nullable=False, unique=True, index=True)
    status = Column(String(32), nullable=False, default="accepted")
    pickup_label = Column(String(255), nullable=False)
    dropoff_label = Column(String(255), nullable=False)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    dropoff_lat = Column(Float, nullable=False)
    dropoff_lng = Column(Float, nullable=False)
    estimated_fare = Column(Numeric(10, 2), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    driver = relationship("Driver", back_populates="trips")
    offer = relationship("TripOffer", back_populates="trip")
    location_points = relationship("LocationPoint", back_populates="trip")
    drowsiness_events = relationship("DrowsinessEvent", back_populates="trip")


class LocationPoint(Base):
    __tablename__ = "location_points"

    id = Column(String(36), primary_key=True, default=_uuid)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True, index=True)
    trip_id = Column(String(36), ForeignKey("trips.id"), nullable=True, index=True)
    status = Column(String(64), nullable=False, default="available")
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accuracy_m = Column(Float, nullable=True)
    speed_kph = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    battery_level = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("DriverSession", back_populates="location_points")
    trip = relationship("Trip", back_populates="location_points")


class DrowsinessEvent(Base):
    __tablename__ = "drowsiness_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    trip_id = Column(String(36), ForeignKey("trips.id"), nullable=True, index=True)
    status = Column(String(255), nullable=False)
    severity = Column(String(32), nullable=False)
    ear = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)
    consecutive_closed_frames = Column(Integer, nullable=False, default=0)
    eyes_closed_seconds = Column(Float, nullable=False, default=0.0)
    alarm_active = Column(Boolean, nullable=False, default=False)
    source = Column(String(64), nullable=False, default="webcam")
    assistant_response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)

    trip = relationship("Trip", back_populates="drowsiness_events")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=_uuid)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    kind = Column(String(64), nullable=False, default="system")
    status = Column(String(32), nullable=False, default="unread")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    driver = relationship("Driver", back_populates="notifications")
