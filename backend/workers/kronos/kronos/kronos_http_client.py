from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union
from urllib.parse import urljoin

import httpx

from kronos.settings import settings


@dataclass
class KronosHTTPResponse:
    message: Optional[str] = None
    error: Optional[str] = None
    table_name: Optional[str] = None


class KronosHTTPClient:
    def __init__(self):
        self._http_client = httpx.AsyncClient(timeout=30.0)
        self._base_url = settings.kronos_service_url.unicode_string()

        # NOTE: Methods below expect the base URL to end with a slash to compose other URLs correctly.
        if not self._base_url.endswith("/"):
            self._base_url += "/"

    async def create_table(self, processing_request_id: str, wta_report_csv: Union[bytes, str]) -> KronosHTTPResponse:
        url = urljoin(self._base_url, f"create_table/{processing_request_id}")
        response = await self._http_client.post(url, content=wta_report_csv)

        try:
            if response.status_code == 200:
                response_data = response.json()
                return KronosHTTPResponse(message=response_data["message"], table_name=response_data["table_name"])
            else:
                return KronosHTTPResponse(error=response.text)
        except Exception as e:
            return KronosHTTPResponse(error=str(e))

    async def create_table_from_path(self, processing_request_id: str, wta_report_csv_path: Path) -> KronosHTTPResponse:
        wta_report_csv = wta_report_csv_path.read_bytes()
        return await self.create_table(processing_request_id, wta_report_csv)
