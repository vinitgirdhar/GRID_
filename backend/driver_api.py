from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Iterable

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, engine, get_db
from .models import Driver, DriverSession, DrowsinessEvent, LocationPoint, Notification, Trip, TripOffer
from .schemas import (
    AuthLoginRequest,
    AuthRefreshRequest,
    AuthTokensResponse,
    DriverProfile,
    DriverTripStateResponse,
    DrowsinessTelemetryRequest,
    DrowsinessTelemetryResponse,
    NotificationItem,
    NotificationListResponse,
    PresenceUpdateRequest,
    PresenceUpdateResponse,
    TripItem,
    TripOfferItem,
    TripOfferListResponse,
)
from .security import create_jwt_token, decode_jwt_token, generate_jti, hash_password, verify_password


settings = get_settings()
router = APIRouter(prefix=settings.api_prefix)


DEMO_DRIVER = {
    "email": "driver@grid.local",
    "password": "grid-driver-123",
    "full_name": "GRID Demo Driver",
    "phone": "+91 90000 00000",
    "vehicle_number": "GRID-101",
}


def _to_driver_profile(driver: Driver) -> DriverProfile:
    return DriverProfile(
        id=driver.id,
        email=driver.email,
        full_name=driver.full_name,
        phone=driver.phone,
        vehicle_number=driver.vehicle_number,
        is_admin=driver.is_admin,
        is_active=driver.is_active,
    )


def _to_offer_item(offer: TripOffer) -> TripOfferItem:
    return TripOfferItem(
        id=offer.id,
        status=offer.status,
        pickup_label=offer.pickup_label,
        dropoff_label=offer.dropoff_label,
        pickup_lat=offer.pickup_lat,
        pickup_lng=offer.pickup_lng,
        dropoff_lat=offer.dropoff_lat,
        dropoff_lng=offer.dropoff_lng,
        distance_km=offer.distance_km,
        estimated_fare=float(offer.estimated_fare),
        zone_id=offer.zone_id,
        borough=offer.borough,
        expires_at=offer.expires_at,
        created_at=offer.created_at,
    )


def _to_trip_item(trip: Trip) -> TripItem:
    return TripItem(
        id=trip.id,
        offer_id=trip.offer_id,
        status=trip.status,
        pickup_label=trip.pickup_label,
        dropoff_label=trip.dropoff_label,
        pickup_lat=trip.pickup_lat,
        pickup_lng=trip.pickup_lng,
        dropoff_lat=trip.dropoff_lat,
        dropoff_lng=trip.dropoff_lng,
        estimated_fare=float(trip.estimated_fare),
        accepted_at=trip.accepted_at,
        started_at=trip.started_at,
        completed_at=trip.completed_at,
    )


def _issue_tokens(driver: Driver, session: DriverSession) -> AuthTokensResponse:
    access_jti = generate_jti()
    access_token, _ = create_jwt_token(
        subject=driver.id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_exp_minutes),
        sid=session.id,
        jti=access_jti,
        extra_claims={"email": driver.email, "is_admin": driver.is_admin},
    )
    refresh_token, _ = create_jwt_token(
        subject=driver.id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_exp_days),
        sid=session.id,
        jti=session.refresh_token_jti,
    )
    return AuthTokensResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_exp_minutes * 60,
        driver=_to_driver_profile(driver),
    )


def _read_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token.")
    return token


def get_current_driver(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Driver:
    token = _read_bearer_token(authorization)
    try:
        payload = decode_jwt_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token required.")

    driver = db.query(Driver).filter(Driver.id == payload["sub"], Driver.is_active.is_(True)).first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Driver not found.")

    session = db.query(DriverSession).filter(DriverSession.id == payload["sid"]).first()
    if not session or session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer active.")

    session.last_seen_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    return driver


def _seed_trip_offers(db: Session, driver_id: str | None = None) -> None:
    active_offer_count = (
        db.query(TripOffer)
        .filter(TripOffer.status == "offered", TripOffer.expires_at > datetime.now(timezone.utc))
        .count()
    )
    if active_offer_count >= 4:
        return

    seed_offers = [
        {
            "pickup_label": "Times Square",
            "dropoff_label": "JFK Airport",
            "pickup_lat": 40.7580,
            "pickup_lng": -73.9855,
            "dropoff_lat": 40.6413,
            "dropoff_lng": -73.7781,
            "distance_km": 24.6,
            "estimated_fare": Decimal("28.50"),
            "zone_id": "132",
            "borough": "Manhattan",
        },
        {
            "pickup_label": "Penn Station",
            "dropoff_label": "Downtown Brooklyn",
            "pickup_lat": 40.7505,
            "pickup_lng": -73.9934,
            "dropoff_lat": 40.6925,
            "dropoff_lng": -73.9903,
            "distance_km": 11.3,
            "estimated_fare": Decimal("18.25"),
            "zone_id": "186",
            "borough": "Manhattan",
        },
        {
            "pickup_label": "Bryant Park",
            "dropoff_label": "LaGuardia Airport",
            "pickup_lat": 40.7536,
            "pickup_lng": -73.9832,
            "dropoff_lat": 40.7769,
            "dropoff_lng": -73.8740,
            "distance_km": 14.8,
            "estimated_fare": Decimal("22.10"),
            "zone_id": "138",
            "borough": "Queens",
        },
        {
            "pickup_label": "Union Square",
            "dropoff_label": "Wall Street",
            "pickup_lat": 40.7359,
            "pickup_lng": -73.9911,
            "dropoff_lat": 40.7060,
            "dropoff_lng": -74.0087,
            "distance_km": 5.1,
            "estimated_fare": Decimal("13.80"),
            "zone_id": "162",
            "borough": "Manhattan",
        },
    ]

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=8)
    for payload in seed_offers:
        db.add(
            TripOffer(
                driver_id=driver_id,
                expires_at=expires_at,
                **payload,
            )
        )
    db.commit()


def bootstrap_mobile_data() -> None:
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        driver = db.query(Driver).filter(Driver.email == DEMO_DRIVER["email"]).first()
        if driver is None:
            driver = Driver(
                email=DEMO_DRIVER["email"],
                full_name=DEMO_DRIVER["full_name"],
                phone=DEMO_DRIVER["phone"],
                vehicle_number=DEMO_DRIVER["vehicle_number"],
                password_hash=hash_password(DEMO_DRIVER["password"]),
            )
            db.add(driver)
            db.commit()
            db.refresh(driver)

        _seed_trip_offers(db)
    finally:
        db.close()


@router.post("/auth/login", response_model=AuthTokensResponse)
def login(request: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthTokensResponse:
    driver = db.query(Driver).filter(Driver.email == request.email.strip().lower()).first()
    if not driver or not verify_password(request.password, driver.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")
    if not driver.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver is inactive.")

    session = DriverSession(
        driver_id=driver.id,
        refresh_token_jti=generate_jti(),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_exp_days),
        last_seen_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    _seed_trip_offers(db, driver_id=driver.id)
    return _issue_tokens(driver, session)


@router.post("/auth/refresh", response_model=AuthTokensResponse)
def refresh_session(request: AuthRefreshRequest, db: Session = Depends(get_db)) -> AuthTokensResponse:
    try:
        payload = decode_jwt_token(request.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required.")

    session = db.query(DriverSession).filter(DriverSession.id == payload["sid"]).first()
    if not session or session.revoked_at is not None or session.refresh_token_jti != payload.get("jti"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is invalid.")

    driver = db.query(Driver).filter(Driver.id == payload["sub"], Driver.is_active.is_(True)).first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Driver not found.")

    session.refresh_token_jti = generate_jti()
    session.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_exp_days)
    session.last_seen_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    db.refresh(session)
    return _issue_tokens(driver, session)


@router.post("/auth/logout")
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    token = _read_bearer_token(authorization)
    try:
        payload = decode_jwt_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    session = db.query(DriverSession).filter(DriverSession.id == payload.get("sid")).first()
    if session:
        session.revoked_at = datetime.now(timezone.utc)
        session.status = "revoked"
        db.add(session)
        db.commit()
    return {"status": "ok"}


@router.get("/auth/me", response_model=DriverProfile)
def me(driver: Driver = Depends(get_current_driver)) -> DriverProfile:
    return _to_driver_profile(driver)


@router.get("/trips/offers", response_model=TripOfferListResponse)
def list_trip_offers(driver: Driver = Depends(get_current_driver), db: Session = Depends(get_db)) -> TripOfferListResponse:
    _seed_trip_offers(db, driver.id)
    offers = (
        db.query(TripOffer)
        .filter(
            TripOffer.status == "offered",
            TripOffer.expires_at > datetime.now(timezone.utc),
            (TripOffer.driver_id == None) | (TripOffer.driver_id == driver.id),  # noqa: E711
        )
        .order_by(TripOffer.created_at.desc())
        .limit(8)
        .all()
    )
    return TripOfferListResponse(offers=[_to_offer_item(offer) for offer in offers])


@router.get("/trips/active", response_model=DriverTripStateResponse)
def active_trip_state(driver: Driver = Depends(get_current_driver), db: Session = Depends(get_db)) -> DriverTripStateResponse:
    active_trip = (
        db.query(Trip)
        .filter(Trip.driver_id == driver.id, Trip.status.in_(["accepted", "started"]))
        .order_by(Trip.accepted_at.desc())
        .first()
    )
    recent_trips = (
        db.query(Trip)
        .filter(Trip.driver_id == driver.id)
        .order_by(Trip.accepted_at.desc())
        .limit(10)
        .all()
    )
    return DriverTripStateResponse(
        active_trip=_to_trip_item(active_trip) if active_trip else None,
        recent_trips=[_to_trip_item(trip) for trip in recent_trips],
    )


@router.post("/trips/{offer_id}/accept", response_model=TripItem)
def accept_trip(offer_id: str, driver: Driver = Depends(get_current_driver), db: Session = Depends(get_db)) -> TripItem:
    offer = db.query(TripOffer).filter(TripOffer.id == offer_id).first()
    if not offer or offer.status != "offered":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip offer is unavailable.")
    if offer.driver_id and offer.driver_id != driver.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Trip offer belongs to another driver.")

    active_trip = (
        db.query(Trip)
        .filter(Trip.driver_id == driver.id, Trip.status.in_(["accepted", "started"]))
        .first()
    )
    if active_trip:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete the current trip before accepting another.")

    accepted_at = datetime.now(timezone.utc)
    offer.status = "accepted"
    offer.driver_id = driver.id
    offer.accepted_at = accepted_at
    trip = Trip(
        driver_id=driver.id,
        offer_id=offer.id,
        status="accepted",
        pickup_label=offer.pickup_label,
        dropoff_label=offer.dropoff_label,
        pickup_lat=offer.pickup_lat,
        pickup_lng=offer.pickup_lng,
        dropoff_lat=offer.dropoff_lat,
        dropoff_lng=offer.dropoff_lng,
        estimated_fare=offer.estimated_fare,
        accepted_at=accepted_at,
    )
    db.add_all([offer, trip])
    db.commit()
    db.refresh(trip)
    db.add(
        Notification(
            driver_id=driver.id,
            title="Trip accepted",
            body=f"{offer.pickup_label} to {offer.dropoff_label}",
            kind="trip",
        )
    )
    db.commit()
    return _to_trip_item(trip)


def _get_driver_trip(db: Session, trip_id: str, driver_id: str) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.driver_id == driver_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found.")
    return trip


@router.post("/trips/{trip_id}/start", response_model=TripItem)
def start_trip(trip_id: str, driver: Driver = Depends(get_current_driver), db: Session = Depends(get_db)) -> TripItem:
    trip = _get_driver_trip(db, trip_id, driver.id)
    if trip.status != "accepted":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Trip cannot be started from its current state.")
    trip.status = "started"
    trip.started_at = datetime.now(timezone.utc)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return _to_trip_item(trip)


@router.post("/trips/{trip_id}/complete", response_model=TripItem)
def complete_trip(trip_id: str, driver: Driver = Depends(get_current_driver), db: Session = Depends(get_db)) -> TripItem:
    trip = _get_driver_trip(db, trip_id, driver.id)
    if trip.status not in {"accepted", "started"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Trip cannot be completed from its current state.")
    trip.status = "completed"
    if trip.started_at is None:
        trip.started_at = datetime.now(timezone.utc)
    trip.completed_at = datetime.now(timezone.utc)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return _to_trip_item(trip)


@router.post("/driver/presence", response_model=PresenceUpdateResponse)
def update_presence(
    payload: PresenceUpdateRequest,
    driver: Driver = Depends(get_current_driver),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> PresenceUpdateResponse:
    token = _read_bearer_token(authorization)
    claims = decode_jwt_token(token)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)
    point = LocationPoint(
        driver_id=driver.id,
        session_id=claims.get("sid"),
        trip_id=payload.trip_id,
        status=payload.status,
        lat=payload.lat,
        lng=payload.lng,
        accuracy_m=payload.accuracy_m,
        speed_kph=payload.speed_kph,
        heading=payload.heading,
        battery_level=payload.battery_level,
        recorded_at=recorded_at,
    )
    db.add(point)
    db.commit()
    return PresenceUpdateResponse(status=payload.status, recorded_at=recorded_at, trip_id=payload.trip_id)


@router.post("/driver/telemetry/drowsiness", response_model=DrowsinessTelemetryResponse)
def log_drowsiness_event(
    payload: DrowsinessTelemetryRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
) -> DrowsinessTelemetryResponse:
    created_at = payload.updated_at or datetime.now(timezone.utc)
    event = DrowsinessEvent(
        driver_id=driver.id,
        trip_id=payload.trip_id,
        status=payload.status,
        severity=payload.severity,
        ear=payload.ear,
        threshold=payload.threshold,
        consecutive_closed_frames=payload.consecutive_closed_frames,
        eyes_closed_seconds=payload.eyes_closed_seconds,
        alarm_active=payload.alarm_active,
        source=payload.source,
        assistant_response=payload.assistant_response,
        created_at=created_at,
    )
    db.add(event)
    if payload.alarm_active or payload.severity == "critical":
        db.add(
            Notification(
                driver_id=driver.id,
                title="Safety alert",
                body=payload.assistant_response or payload.status,
                kind="safety",
            )
        )
    db.commit()
    db.refresh(event)
    return DrowsinessTelemetryResponse(
        id=event.id,
        trip_id=event.trip_id,
        status=event.status,
        severity=event.severity,
        ear=event.ear,
        threshold=event.threshold,
        consecutive_closed_frames=event.consecutive_closed_frames,
        eyes_closed_seconds=event.eyes_closed_seconds,
        alarm_active=event.alarm_active,
        assistant_response=event.assistant_response,
        source=event.source,
        updated_at=event.created_at,
    )


@router.get("/notifications", response_model=NotificationListResponse)
def get_notifications(driver: Driver = Depends(get_current_driver), db: Session = Depends(get_db)) -> NotificationListResponse:
    notifications = (
        db.query(Notification)
        .filter(Notification.driver_id == driver.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return NotificationListResponse(
        notifications=[
            NotificationItem(
                id=item.id,
                title=item.title,
                body=item.body,
                kind=item.kind,
                status=item.status,
                created_at=item.created_at,
                read_at=item.read_at,
            )
            for item in notifications
        ]
    )
