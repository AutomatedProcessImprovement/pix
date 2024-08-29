from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Union
from urllib.parse import urljoin
from uuid import UUID

import httpx
from pix_portal_lib.utils import get_env

from .self_authenticating_client import SelfAuthenticatingClient

file_service_url = get_env("FILE_SERVICE_URL")
blobs_base_public_url = get_env("BLOBS_BASE_PUBLIC_URL")
blobs_base_internal_url = get_env("BLOBS_BASE_INTERNAL_URL")


class FileType(str, Enum):
    EVENT_LOG_CSV = "event_log_csv"
    EVENT_LOG_CSV_GZ = "event_log_csv_gz"
    EVENT_LOG_COLUMN_MAPPING_JSON = "event_log_column_mapping_json"
    PROCESS_MODEL_BPMN = "process_model_bpmn"
    CONFIGURATION_SIMOD_YAML = "configuration_simod_yaml"
    SIMULATION_MODEL_PROSIMOS_JSON = "simulation_model_prosimos_json"
    STATISTICS_PROSIMOS_CSV = "statistics_prosimos_csv"
    CONSTRAINTS_MODEL_OPTIMOS_JSON = "constraints_model_optimos_json"
    CONFIGURATION_OPTIMOS_YAML = "configuration_optimos_yaml"
    WAITING_TIME_ANALYSIS_REPORT_KRONOS_JSON = "waiting_time_analysis_report_kronos_json"
    WAITING_TIME_ANALYSIS_REPORT_KRONOS_CSV = "waiting_time_analysis_report_kronos_csv"
    OPTIMIZATION_REPORT_OPTIMOS_JSON = "optimization_report_optimos_json"


@dataclass
class File:
    id: UUID
    url: str
    content_hash: str
    type: str
    name: str
    users_ids: list[UUID]
    creation_time: datetime
    deletion_time: Optional[datetime] = None

    def is_deleted(self) -> bool:
        return self.deletion_time is not None


# some of the services that use this class could have access to an expired token,
# in that case, the service has to be able to authenticate itself, SelfAuthenticatingClient provides
# the self.token property that calls the auth service to get a new token if the current one is None
class FileServiceClient(SelfAuthenticatingClient):
    def __init__(self):
        super().__init__()
        self._client = httpx.AsyncClient(timeout=30.0)
        self._base_url = file_service_url
        self._blobs_base_public_url = blobs_base_public_url
        self._blobs_base_internal_url = blobs_base_internal_url

    async def get_file(self, file_id: Union[str, UUID], token: Optional[str] = None) -> File:
        """
        Fetches a file using the file service.
        """
        url = self._file_resource_url(file_id)
        response = await self._client.get(url, headers=await self.request_headers(token))
        response.raise_for_status()

        return File(**response.json())

    async def delete_file(self, file_id: UUID, token: Optional[str] = None) -> bool:
        """
        Deletes a file using the file service.
        Returns True if the file was deleted successfully.
        """
        url = self._file_resource_url(file_id)
        response = await self._client.delete(url, headers=await self.request_headers(token))

        if response.status_code == 204:
            return True

        return False

    def get_absolute_url(self, relative_url: str, is_internal: bool) -> str:
        base = self._blobs_base_internal_url if is_internal else self._blobs_base_public_url
        relative_url = relative_url.removeprefix("/blobs/")
        return urljoin(base, relative_url)

    async def upload_file(
        self, name: str, path: Path, type: FileType, users_ids: list[UUID], token: Optional[str] = None
    ) -> str:
        """
        Uploads a file to the file service and returns the file ID.
        If token is not provided, the service will authenticate itself as a SYSTEM user.
        """
        content = path.read_bytes()
        t = token or await self.token
        params = {
            "name": name,
            "type": type.value,
            "users_ids": ",".join([str(user_id) for user_id in users_ids]),
        }
        response = await self._client.post(
            self._base_url,
            params=params,
            headers={
                "Authorization": f"Bearer {t}",
                "Content-Type": "application/octet-stream",
            },
            content=content,
        )
        response.raise_for_status()
        return response.json()["id"]

    async def is_deleted(self, file_id: UUID, token: str) -> bool:
        file = await self.get_file(file_id, token)
        return file.is_deleted()

    def _file_resource_url(self, file_id: Union[UUID, str]) -> str:
        return urljoin(self._base_url, f"{file_id}")
