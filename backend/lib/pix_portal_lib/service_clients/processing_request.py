import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional
from urllib.parse import urljoin

import httpx

from pix_portal_lib.utils import get_env

from .self_authenticating_client import SelfAuthenticatingClient

processing_request_service_url = get_env("PROCESSING_REQUEST_SERVICE_URL")

logger = logging.getLogger()


class Cancelable:
    should_be_cancelled: bool = False

    def cancel(self):
        self.should_be_cancelled = True


@dataclass
class ProcessingRequest(Cancelable):
    """
    A data processing request that is received from the Kafka topic.
    """

    processing_request_id: str
    user_id: str
    project_id: str
    input_assets_ids: list[str]
    output_assets_ids: list[str]
    should_notify: bool


class ProcessingRequestStatus(str, Enum):
    """
    Status of the data processing activity.
    """

    CREATED = "created"
    RUNNING = "running"
    FINISHED = "finished"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ProcessingRequestServiceClient(SelfAuthenticatingClient):
    def __init__(self):
        super().__init__()
        self._client = httpx.AsyncClient(timeout=30.0)
        self._base_url = processing_request_service_url
        if self._base_url is None:
            raise ValueError("PROCESSING_REQUEST_SERVICE_URL environment variable is not set")

    async def add_output_asset_to_processing_request(
        self, processing_request_id: str, asset_id: str, token: Optional[str] = None
    ) -> dict:
        url = urljoin(self._base_url, f"{processing_request_id}/output-assets")
        response = await self._client.post(url, headers=await self.request_headers(token), json={"asset_id": asset_id})
        response.raise_for_status()
        return response.json()

    async def update_status(
        self,
        processing_request_id: str,
        status: ProcessingRequestStatus,
        message: Optional[str] = None,
        token: Optional[str] = None,
    ) -> dict:
        url = urljoin(self._base_url, f"{processing_request_id}")
        headers = await self.request_headers(token)
        response = await self._client.patch(url, headers=headers, json={"status": status, "message": message})
        response.raise_for_status()
        return response.json()

    async def update_request(
        self,
        processing_request_id: str,
        status: Optional[ProcessingRequestStatus] = None,
        message: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        token: Optional[str] = None,
    ) -> dict:
        url = urljoin(self._base_url, f"{processing_request_id}")
        headers = await self.request_headers(token)

        payload = {}
        if status is not None:
            payload["status"] = status
        if message is not None:
            payload["message"] = message
        if start_time is not None:
            payload["start_time"] = str(start_time)
        if end_time is not None:
            payload["end_time"] = str(end_time)

        response = await self._client.patch(
            url,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        return response.json()
