from typing import Optional
from urllib.parse import urljoin
from uuid import UUID

import httpx

from pix_portal_lib.utils import get_env

from .self_authenticating_client import SelfAuthenticatingClient

project_service_url = get_env("PROJECT_SERVICE_URL")


class ProjectNotFound(Exception):
    pass


class ProjectServiceClient(SelfAuthenticatingClient):
    def __init__(self):
        super().__init__()
        self._client = httpx.AsyncClient(timeout=30.0)
        self._base_url = project_service_url

    async def add_asset_to_project(self, project_id: str, asset_id: str, token: Optional[str] = None) -> dict:
        url = urljoin(self._base_url, f"{project_id}/assets")
        response = await self._client.post(url, headers=await self.request_headers(token), json={"asset_id": asset_id})
        response.raise_for_status()
        return response.json()

    async def get_project(self, project_id: UUID, token: str) -> dict:
        url = urljoin(self._base_url, str(project_id))
        response = await self._client.get(url, headers={"Authorization": f"Bearer {token}"})
        if response.status_code != 200:
            raise ProjectNotFound()
        return response.json()

    async def does_project_exist(self, project_id: UUID, token: str) -> bool:
        project = await self.get_project(project_id, token)
        return project is not None

    async def does_user_have_access_to_project(self, user_id: UUID, project_id: UUID, token: str) -> bool:
        project = await self.get_project(project_id, token)
        current_user_id = str(user_id)
        project_user_id = [str(user_id) for user_id in project["users_ids"]]
        return current_user_id in project_user_id
