import asyncio
import logging
import uuid
from collections import namedtuple
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Union
from urllib.parse import urljoin, urlparse

from uuid import UUID

import httpx

from pix_portal_lib.utils import get_env

from .file import File, FileServiceClient, FileType
from .self_authenticating_client import SelfAuthenticatingClient

logger = logging.getLogger()


asset_service_url = get_env("ASSET_SERVICE_URL")


class AssetType(str, Enum):
    EVENT_LOG = "event_log"
    PROCESS_MODEL = "process_model"
    SIMULATION_MODEL = "simulation_model"
    SIMOD_CONFIGURATION = "simod_configuration"
    OPTIMOS_CONFIGURATION = "optimos_configuration"
    KRONOS_REPORT = "kronos_report"
    OPTIMOS_REPORT = "optimos_report"


# File is a type alias for a file with fewer fields.
File_ = namedtuple("File", ["name", "type", "path"])


@dataclass
class Asset:
    id: str
    creation_time: str
    modification_time: str
    deletion_time: str
    name: str
    description: str
    type: AssetType
    project_id: str
    files_ids: list[str]
    users_ids: list[str]
    processing_requests_ids: list[str]
    url: Optional[str] = None
    files: Optional[list[File_]] = None

    def is_deleted(self) -> bool:
        return self.deletion_time is not None


@dataclass
class AssetLocationResponse:
    location: str


class AssetServiceClient(SelfAuthenticatingClient):
    def __init__(self):
        super().__init__()
        self._base_url = asset_service_url
        self._http_client = httpx.AsyncClient()
        self._file_client = FileServiceClient()

    async def download_asset(
        self, asset_id: str, output_dir: Path, is_internal: bool, token: Optional[str] = None
    ) -> Asset:
        """
        Download asset files to disk and returns the asset with files field filled with File objects.
        """
        asset = await self.get_asset(asset_id, token=token)

        files: list[File_] = []
        for file_id in asset.files_ids:
            file = await self._file_client.get_file(file_id, token=token)
            file_path = await self._compose_file_path(file, output_dir)
            await self._download_file_to_disk(asset_id, file_id, file_path, is_internal, token)
            files.append(File_(name=file.name, type=file.type, path=file_path))

        asset.files = files

        return asset

    @staticmethod
    async def _compose_file_path(file: File, output_dir: Path):
        local_disk_path = output_dir / Path(str(file.id))
        file_type_lowered = file.type.lower()
        if file_type_lowered.endswith("_csv"):
            local_disk_path = local_disk_path.with_suffix(".csv")
        elif file_type_lowered.endswith("_csv_gz"):
            local_disk_path = local_disk_path.with_suffix(".csv.gz")
        elif file_type_lowered.endswith("_json"):
            local_disk_path = local_disk_path.with_suffix(".json")
        elif file_type_lowered.endswith("_yaml"):
            local_disk_path = local_disk_path.with_suffix(".yaml")
        elif file_type_lowered.endswith("_bpmn"):
            local_disk_path = local_disk_path.with_suffix(".bpmn")
        return local_disk_path

    async def _download_file_to_disk(
        self, asset_id: str, file_id: str, file_path: Path, is_internal: bool, token: Optional[str] = None
    ):
        file_url = await self.get_file_location(
            asset_id=asset_id, file_id=file_id, is_internal=is_internal, token=token
        )
        response = await self._http_client.get(file_url, headers=await self.request_headers(token))
        response.raise_for_status()
        with open(file_path, "wb") as f:
            f.write(response.content)

    async def get_asset(self, asset_id: Union[str, UUID], token: Optional[str] = None) -> Asset:
        url = urljoin(self._base_url, f"{asset_id}")
        response = await self._http_client.get(url, headers=await self.request_headers(token))
        response.raise_for_status()
        return Asset(**response.json())

    async def get_assets_by_ids(self, assets_ids: list[UUID], token: str) -> list[Asset]:
        return [await self.get_asset(asset_id, token) for asset_id in assets_ids]

    async def get_assets_by_project_id(self, project_id: UUID, token: str) -> list[Asset]:
        response = await self._http_client.get(
            self._base_url,
            params={"project_id": str(project_id)},
            headers={"Authorization": f"Bearer {token}"},
        )
        return [Asset(**asset) for asset in response.json()]

    async def does_asset_exist(self, asset_id: UUID, token: str) -> bool:
        url = urljoin(self._base_url, str(asset_id))

        response = await self._http_client.get(url, headers=await self.request_headers(token))

        if response.status_code != 200:
            return False

        asset = Asset(**response.json())

        if asset.is_deleted():
            return False

        return response.status_code == 200

    async def get_file_location(
        self,
        asset_id: Union[str, UUID],
        file_id: Union[str, UUID],
        is_internal: bool = True,
        token: Optional[str] = None,
    ) -> str:
        url = urljoin(self._base_url, f"{asset_id}/files/{file_id}/location")
        response = await self._http_client.get(
            url, headers=await self.request_headers(token), params={"is_internal": is_internal}
        )
        response.raise_for_status()
        location = AssetLocationResponse(**response.json()).location
        # Change the host, back to _base_url
        return urlparse(location)._replace(netloc=urlparse(self._base_url).netloc).geturl()

    async def create_asset(
        self,
        files: list[File_],
        asset_name: str,
        asset_type: AssetType,
        project_id: str,
        users_ids: list[uuid.UUID],
        token: Optional[str] = None,
    ) -> str:
        await self._validate_files(asset_type, files)

        files_ids = await asyncio.gather(
            *[
                self._file_client.upload_file(
                    name=file.name, path=file.path, type=file.type, users_ids=users_ids, token=token
                )
                for file in files
            ]
        )

        response = await self._http_client.post(
            self._base_url,
            headers=await self.request_headers(token),
            json={
                "name": asset_name,
                "type": asset_type,
                "project_id": project_id,
                "files_ids": self._uuid_list_to_str_list(files_ids),
                "users_ids": self._uuid_list_to_str_list(users_ids),
            },
        )
        response.raise_for_status()

        logger.info(f"Created asset status_code={response.status_code}, response={response.text}")
        data = response.json()

        return data["id"]

    async def replace_assets_files(
        self,
        files: list[File_],
        asset_id: str,
        token: Optional[str] = None,
    ) -> bool:
        asset = await self.get_asset(asset_id, token)
        await self._validate_files(asset.type, files)

        files_ids = await asyncio.gather(
            *[
                self._file_client.upload_file(
                    name=file.name,
                    path=file.path,
                    type=file.type,
                    users_ids=self._str_list_to_uuid_list(asset.users_ids),
                    token=token,
                )
                for file in files
            ]
        )

        response = await self._http_client.patch(
            urljoin(self._base_url, asset_id),
            headers=await self.request_headers(token),
            json={"files_ids": self._uuid_list_to_str_list(files_ids)},
        )
        response.raise_for_status()
        return True

    async def _validate_files(self, asset_type: AssetType, files: list[File_]):
        if asset_type == AssetType.EVENT_LOG:
            self._files_must_have_at_least_length(files, 2)
            self._valid_file_types_for_event_log(files)
        elif asset_type == AssetType.PROCESS_MODEL:
            self._files_must_have_length(files, 1)
            self._files_must_have_types(files, [FileType.PROCESS_MODEL_BPMN])
        elif asset_type == AssetType.SIMULATION_MODEL:
            self._files_must_have_length(files, 2)
            self._files_must_have_types(files, [FileType.SIMULATION_MODEL_PROSIMOS_JSON, FileType.PROCESS_MODEL_BPMN])
        elif asset_type == AssetType.SIMOD_CONFIGURATION:
            self._files_must_have_length(files, 1)
            self._files_must_have_types(files, [FileType.CONFIGURATION_SIMOD_YAML])
        elif asset_type == AssetType.OPTIMOS_CONFIGURATION:
            self._files_must_have_length(files, 2)
            self._files_must_have_types(
                files, [FileType.CONSTRAINTS_MODEL_OPTIMOS_JSON, FileType.CONFIGURATION_OPTIMOS_YAML]
            )

    @staticmethod
    def _files_must_have_length(files: list[File_], length: int):
        if len(files) != length:
            raise ValueError(f"Asset must have exactly {length} files")

    @staticmethod
    def _files_must_have_at_least_length(files: list[File_], length: int):
        if len(files) < length:
            raise ValueError(f"Asset must have at least {length} files")

    @staticmethod
    def _files_must_have_types(files: list[File_], types: list[FileType]):
        files_types = [str(file.type) for file in files]
        for t in types:
            if str(t) not in files_types:
                raise ValueError(f"Asset must have a file of type {t}")

    @staticmethod
    def _valid_file_types_for_event_log(files: list[File_]) -> bool:
        files_types = [str(file.type) for file in files]
        event_log_valid = str(FileType.EVENT_LOG_CSV) in files_types or str(FileType.EVENT_LOG_CSV_GZ) in files_types
        return event_log_valid and str(FileType.EVENT_LOG_COLUMN_MAPPING_JSON) in files_types

    @staticmethod
    def _uuid_list_to_str_list(uuid_list: Union[list[uuid.UUID], tuple[Any], list[Any]]) -> list[str]:
        return [str(v) for v in uuid_list]

    def _str_list_to_uuid_list(self, str_list: list[str]) -> list[uuid.UUID]:
        return [uuid.UUID(v) for v in str_list]

    async def delete_asset(self, asset_id: UUID, token: str) -> bool:
        url = urljoin(self._base_url, str(asset_id))
        response = await self._http_client.delete(url, headers={"Authorization": f"Bearer {token}"})
        if response.status_code == 204:
            return True
        raise Exception(response.text)

    async def delete_assets_by_project_id(self, project_id: UUID, token: str) -> bool:
        assets = await self.get_assets_by_project_id(project_id, token)
        for asset in assets:
            await self.delete_asset(uuid.UUID(asset.id), token)
        return True
