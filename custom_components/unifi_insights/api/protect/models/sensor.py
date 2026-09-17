"""UniFi Protect Sensor model."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SensorType(str, Enum):
    """Types of UniFi sensors."""

    DOOR = "door"
    WINDOW = "window"
    MOTION = "motion"
    WATER = "water"
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    LIGHT = "light"
    UNKNOWN = "unknown"


class BatteryStatus(BaseModel):
    """Battery status for Protect sensors."""

    percentage: int | None = None
    is_low: bool = Field(default=False, alias="isLow")

    model_config = {"populate_by_name": True, "extra": "allow"}


class Sensor(BaseModel):
    """
    UniFi Protect Sensor device.

    Represents Protect UP-Sense sensors.
    """

    id: str
    name: str | None = None
    mac: str
    model_key: str = Field(default="sensor", alias="modelKey")
    type: str | None = None
    model: str | None = None
    state: str | None = None
    firmware_version: str | None = Field(default=None, alias="firmwareVersion")
    hardware_revision: str | None = Field(default=None, alias="hardwareRevision")
    uptime: int | None = None
    last_seen: datetime | None = Field(default=None, alias="lastSeen")
    connected_since: datetime | None = Field(default=None, alias="connectedSince")
    is_connected: bool = Field(default=False, alias="isConnected")
    battery_status: BatteryStatus | None = Field(default=None, alias="batteryStatus")
    battery_level: int | None = Field(default=None, alias="batteryLevel")
    is_opened: bool | None = Field(default=None, alias="isOpened")
    is_motion_detected: bool | None = Field(default=None, alias="isMotionDetected")
    is_alarm_detected: bool | None = Field(default=None, alias="isAlarmDetected")
    temperature: float | None = None
    humidity: float | None = None
    light_value: float | None = Field(default=None, alias="lightValue")
    motion_sensitivity: int | None = Field(default=None, alias="motionSensitivity")
    open_status_led_enabled: bool = Field(default=True, alias="openStatusLedEnabled")
    alarm_settings: dict[str, Any] | None = Field(default=None, alias="alarmSettings")
    mount_type: str | None = Field(default=None, alias="mountType")

    model_config = {"populate_by_name": True, "extra": "allow"}

    @property
    def display_name(self) -> str:
        """Get the display name for the sensor."""
        return self.name or self.mac
