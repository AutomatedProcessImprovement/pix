from typing import Optional
from urllib.parse import urljoin
from uuid import UUID

import httpx
from pix_portal_lib.utils import get_env

from .self_authenticating_client import SelfAuthenticatingClient

user_service_url = get_env("USER_SERVICE_URL")


class UserServiceClient(SelfAuthenticatingClient):
    def __init__(self):
        super().__init__()
        self._client = httpx.AsyncClient(timeout=30.0)
        self._base_url = user_service_url

    async def does_user_exist(self, user_id: UUID, token: Optional[str] = None) -> bool:
        url = urljoin(self._base_url, str(user_id))
        headers = await self.request_headers(token)
        response = await self._client.get(url, headers=headers)
        return response.status_code == 200

    async def get_user(self, user_id: UUID, token: Optional[str] = None) -> dict:
        url = urljoin(self._base_url, str(user_id))
        headers = await self.request_headers(token)
        response = await self._client.get(url, headers=headers)
        return response.json()

    async def get_users_by_ids(self, users_ids: list[UUID], token: str) -> list[dict]:
        return [await self.get_user(user_id, token) for user_id in users_ids]
