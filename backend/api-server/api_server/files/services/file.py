import hashlib
import uuid
from pathlib import Path
from typing import AsyncGenerator, Sequence
from urllib.parse import urljoin

from fastapi import Depends

from api_server.files.persistence.model import File, FileType
from api_server.files.persistence.repository import FileRepository, get_file_repository
from api_server.settings import settings


class FileExists(Exception):
    def __init__(self, file: File) -> None:
        super().__init__(f"File with hash {file.content_hash} already exists: {file.id}")
        self.file = file


class FileService:
    def __init__(self, file_repository: FileRepository) -> None:
        self.base_dir = settings.base_dir
        self.file_repository = file_repository
        self._blobs_base_public_url = settings.blobs_base_public_url.unicode_string()

        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save_file(self, name: str, file_type: FileType, file_bytes: bytes, users_ids: list[uuid.UUID]) -> File:
        hash = self._compute_sha256(file_bytes)

        if self._hash_exists_on_disk(hash):
            try:
                file = await self.file_repository.get_file_by_hash(hash)

                # add users if they don't have access to the file yet
                if not await self.users_have_access_to_file(users_ids, file.id):
                    await self.file_repository.add_users_to_file_if_needed(file.id, users_ids)

                raise FileExists(file)
            except FileNotFoundError:
                # File exists on disk but not in database, continue creating the database record
                pass
        else:
            file_path = self.base_dir / hash
            with file_path.open("wb") as file:
                file.write(file_bytes)

        url = self._generate_url(hash)

        return await self.file_repository.create_file(
            name=name,
            content_hash=hash,
            url=url,
            file_type=file_type,
            users_ids=users_ids,
        )

    async def get_files(self) -> Sequence[File]:
        return await self.file_repository.get_files()

    async def get_file(self, file_id: uuid.UUID) -> File:
        return await self.file_repository.get_file(file_id)

    async def get_file_by_hash(self, hash: str) -> File:
        return await self.file_repository.get_file_by_hash(hash)

    async def delete_file(self, file_id: uuid.UUID) -> None:
        content_hash = await self.file_repository.get_file_hash(file_id)
        await self.file_repository.delete_file(file_id)
        self._remove_file_from_disk(content_hash)

    async def get_file_path(self, file_id: uuid.UUID) -> Path:
        file = await self.get_file(file_id)
        return self._file_path(file.content_hash)

    async def get_file_url(self, file_id: uuid.UUID) -> str:
        file = await self.get_file(file_id)
        return file.url

    async def get_file_location(self, file_id: uuid.UUID) -> str:
        file = await self.get_file(file_id)
        relative_url = file.url.removeprefix("/blobs/")
        return urljoin(self._blobs_base_public_url, relative_url)

    async def user_has_access_to_file(self, user_id: uuid.UUID, file_id: uuid.UUID) -> bool:
        file = await self.get_file(file_id)
        user_id = str(user_id)
        users_ids = [str(user_id) for user_id in file.users_ids]
        return user_id in users_ids

    async def users_have_access_to_file(self, users_ids: list[uuid.UUID], file_id: uuid.UUID) -> bool:
        file = await self.get_file(file_id)
        users_ids = [str(user_id) for user_id in users_ids]
        files_users_ids = [str(user_id) for user_id in file.users_ids]
        return all(user_id in files_users_ids for user_id in users_ids)

    @staticmethod
    def _compute_sha256(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    def _file_path(self, hash: str) -> Path:
        return self.base_dir / hash

    def _hash_exists_on_disk(self, hash: str) -> bool:
        file_path = self._file_path(hash)
        return file_path.exists()

    @staticmethod
    def _generate_url(hash: str) -> str:
        return f"/blobs/{hash}"

    def _remove_file_from_disk(self, hash: str) -> None:
        file_path = self._file_path(hash)
        file_path.unlink()


async def get_file_service(
    file_repository: FileRepository = Depends(get_file_repository),
) -> AsyncGenerator[FileService, None]:
    yield FileService(file_repository)
