"""
Commonly used authentication service for user authentication and authorization.
"""

import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import httpx
from pydantic import BaseModel

from pix_portal_lib.utils import get_env

logger = logging.getLogger()

auth_service_url = get_env("AUTH_SERVICE_URL")
system_email_file = get_env("SYSTEM_EMAIL_FILE")
system_password_file = get_env("SYSTEM_PASSWORD_FILE")
system_username = Path(system_email_file).read_text().strip()
system_password = Path(system_password_file).read_text().strip()


class TokenVerificationResponse(BaseModel):
    status: bool
    user: dict


class AuthServiceClient:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        self._base_url = auth_service_url

        if self._base_url is None:
            raise ValueError("AUTH_SERVICE_URL must be set in the environment")

    async def verify_token(self, token: str, is_superuser: bool = False) -> tuple[bool, Optional[dict]]:
        """
        Verifies a JWT token and returns a tuple of (status, user).
        """
        url = urljoin(self._base_url, "jwt/verify-token")
        params = {"is_superuser": is_superuser}
        response = await self._client.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            follow_redirects=True,
        )

        if response.status_code != 200:
            return False, None

        response_data = TokenVerificationResponse(**response.json())
        return response_data.status, response_data.user

    async def get_system_jwt_token(self) -> str:
        """
        Get a JWT token for the system user. Used by other services to authenticate themselves.
        """
        if system_username is None or system_password is None:
            raise ValueError("SYSTEM_EMAIL_FILE and SYSTEM_PASSWORD_FILE must be set in the environment")

        url = urljoin(self._base_url, "jwt/login")
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        request_payload = {"username": system_username, "password": system_password}
        try:
            response = await self._client.post(
                url,
                headers=headers,
                data=request_payload,
            )
            response.raise_for_status()

            logger.info(f"SYSTEM user logged in, status_code={response.status_code}, data={response.text}, url={url}")
            data = response.json()
            return data["access_token"]
        except Exception as e:
            logger.error(f"SYSTEM user login failed, error={e}, url={url}, request_payload={request_payload}")
            raise e
