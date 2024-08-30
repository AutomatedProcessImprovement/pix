import logging
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional, Sequence, Union

from fastapi import Depends
from fastapi_users.exceptions import UserNotExists
from kafka.errors import KafkaTimeoutError

from api_server.assets.service import AssetService, get_asset_service
from api_server.processing_requests.kafka_producer import KafkaProducerService, get_kafka_service
from api_server.processing_requests.model import ProcessingRequest, ProcessingRequestStatus, ProcessingRequestType
from api_server.processing_requests.repository import ProcessingRequestRepository, get_processing_request_repository
from api_server.projects.service import ProjectService, get_project_service
from api_server.users.users import UserManager, get_user_manager

logger = logging.getLogger()


class UserNotFound(Exception):
    pass


class ProjectNotFound(Exception):
    pass


class AssetNotFound(Exception):
    def __init__(self, asset_id: uuid.UUID) -> None:
        super().__init__(f"Asset not found: {asset_id}")
        self.asset_id = asset_id


class AssetDoesNotBelongToProject(Exception):
    def __init__(self, asset_id: Union[uuid.UUID, str, None] = None) -> None:
        if asset_id:
            super().__init__(f"Asset does not belong to project: {asset_id}")
        else:
            super().__init__(f"Asset does not belong to project")
        self.asset_id = asset_id


class AssetAlreadyExists(Exception):
    pass


class AssetAlreadyInInputAssets(Exception):
    pass


class AssetAlreadyInOutputAssets(Exception):
    pass


class AssetDeletionFailed(Exception):
    pass


class LastUserInProject(Exception):
    pass


class ProjectHasNoUsers(Exception):
    pass


class NotEnoughPermissions(Exception):
    pass


class QueueNotAvailable(Exception):
    pass


class ProcessingRequestService:
    def __init__(
        self,
        processing_request_repository: ProcessingRequestRepository,
        asset_service: AssetService,
        user_service: UserManager,
        project_service: ProjectService,
        kafka_service: KafkaProducerService,
    ) -> None:
        self._processing_request_repository = processing_request_repository
        self._asset_service = asset_service
        self._user_service = user_service
        self._project_service = project_service
        self._kafka_service = kafka_service

    async def get_processing_requests(self) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests()

    async def get_processing_requests_by_user_id(self, user_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_user_id(user_id)

    async def get_processing_requests_by_project_id(
        self, project_id: uuid.UUID, current_user: dict
    ) -> Sequence[ProcessingRequest]:
        if not await self.does_user_have_access_to_project(current_user, project_id):
            raise NotEnoughPermissions()
        return await self._processing_request_repository.get_processing_requests_by_project_id(project_id)

    async def get_processing_requests_by_asset_id(self, asset_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_asset_id(asset_id)

    async def get_processing_requests_by_input_asset_id(self, asset_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_input_asset_id(asset_id)

    async def get_processing_requests_by_output_asset_id(self, asset_id: uuid.UUID) -> Sequence[ProcessingRequest]:
        return await self._processing_request_repository.get_processing_requests_by_output_asset_id(asset_id)

    async def does_user_have_access_to_project(self, user: dict, project_id: uuid.UUID) -> bool:
        if user["is_superuser"]:
            return True
        return await self._project_service.does_user_have_access_to_project(user["id"], project_id)

    async def create_processing_request(
        self,
        type: ProcessingRequestType,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        input_assets_ids: list[uuid.UUID],
        should_notify: bool,
        current_user: dict,
    ) -> ProcessingRequest:
        try:
            _ = await self._user_service.get(user_id)
        except UserNotExists:
            raise UserNotFound()

        project = await self._project_service.get_project(project_id)
        if not project:
            raise ProjectNotFound()

        for asset_id in input_assets_ids:
            ok = await self._asset_service.does_asset_exist(asset_id)
            if not ok:
                raise AssetNotFound(asset_id=asset_id)

        if not await self.does_user_have_access_to_project(current_user, project_id):
            raise NotEnoughPermissions()

        await self._raise_for_assets_not_in_project(project_id, input_assets_ids)

        processing_request = await self._processing_request_repository.create_processing_request(
            type,
            user_id,
            project_id,
            input_assets_ids,
            should_notify,
        )

        try:
            self._kafka_service.send_message(
                type,
                {
                    "processing_request_id": str(processing_request.id),
                    "user_id": str(user_id),
                    "project_id": str(project_id),
                    "input_assets_ids": [str(aid) for aid in input_assets_ids],
                    "output_assets_ids": [],
                    "should_notify": should_notify,
                },
            )
        except KafkaTimeoutError as e:
            logger.error(
                f"Failed to send a message to Kafka. "
                f"Details: "
                f"type={type}, "
                f"user_id={user_id}, "
                f"project_id={project_id}, "
                f"input_assets_ids={input_assets_ids}, "
                f"output_assets_ids={[]}, "
                f"should_notify={should_notify}, "
                f"error: {e}"
            )
            raise QueueNotAvailable()

        return processing_request

    async def get_processing_request(self, processing_request_id: uuid.UUID) -> ProcessingRequest:
        return await self._processing_request_repository.get_processing_request(processing_request_id)

    async def delete_or_cancel_request(self, processing_request_id: uuid.UUID, current_user: dict):
        processing_request = await self._processing_request_repository.get_processing_request(processing_request_id)
        if not await self.does_user_have_access_to_project(current_user, processing_request.project_id):
            raise NotEnoughPermissions()

        if processing_request.status in [ProcessingRequestStatus.FINISHED, ProcessingRequestStatus.FAILED]:
            await self._processing_request_repository.delete_processing_request(processing_request_id)

        if processing_request.status in [ProcessingRequestStatus.RUNNING, ProcessingRequestStatus.CREATED]:
            raise Exception("Cannot cancel a running or freshly created request")

        if processing_request.type != ProcessingRequestType.SIMULATION_MODEL_OPTIMIZATION_OPTIMOS:
            raise Exception("Cannot cancel a processing request of this type")

        try:
            self._kafka_service.send_message(
                ProcessingRequestType.SIMULATION_MODEL_OPTIMIZATION_OPTIMOS_CANCELLATION,
                {
                    "processing_request_id": str(processing_request_id),
                    "user_id": str(processing_request.user_id),
                    "project_id": str(processing_request.project_id),
                },
            )
        except KafkaTimeoutError as e:
            logger.error(f"Failed to send a message to Kafka. " f"Details: " f"type={type}, " f"error: {e}")
            raise QueueNotAvailable()

    async def update_processing_request(
        self,
        processing_request_id: uuid.UUID,
        status: Optional[ProcessingRequestStatus] = None,
        message: Optional[str] = None,
        should_notify: Optional[bool] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> ProcessingRequest:
        return await self._processing_request_repository.update_processing_request(
            processing_request_id=processing_request_id,
            status=status,
            message=message,
            should_notify=should_notify,
            start_time=start_time,
            end_time=end_time,
        )

    async def add_input_asset_to_processing_request(
        self, processing_request_id: uuid.UUID, asset_id: uuid.UUID
    ) -> ProcessingRequest:
        if not await self._asset_service.does_asset_exist(asset_id):
            raise AssetNotFound(asset_id=asset_id)

        if not await self.does_asset_belong_to_project(processing_request_id, asset_id):
            raise AssetDoesNotBelongToProject()

        processing_request = await self._processing_request_repository.get_processing_request(processing_request_id)
        processing_request_input_assets_ids = [str(aid) for aid in processing_request.input_assets_ids]
        if str(asset_id) in processing_request_input_assets_ids:
            raise AssetAlreadyExists()

        # An asset cannot be both input and output assets
        processing_request_output_assets_ids = [str(aid) for aid in processing_request.output_assets_ids]
        if str(asset_id) in processing_request_output_assets_ids:
            raise AssetAlreadyInInputAssets()

        return await self._processing_request_repository.add_input_asset_to_processing_request(
            processing_request_id, asset_id
        )

    async def add_output_asset_to_processing_request(
        self, processing_request_id: uuid.UUID, asset_id: uuid.UUID
    ) -> ProcessingRequest:
        if not await self._asset_service.does_asset_exist(asset_id):
            raise AssetNotFound(asset_id=asset_id)

        if not await self.does_asset_belong_to_project(processing_request_id, asset_id):
            raise AssetDoesNotBelongToProject()

        processing_request = await self._processing_request_repository.get_processing_request(processing_request_id)
        processing_request_output_assets_ids = [str(aid) for aid in processing_request.output_assets_ids]
        if str(asset_id) in processing_request_output_assets_ids:
            raise AssetAlreadyExists()

        # An asset cannot be both input and output assets
        processing_request_input_assets_ids = [str(aid) for aid in processing_request.input_assets_ids]
        if str(asset_id) in processing_request_input_assets_ids:
            raise AssetAlreadyInOutputAssets()

        return await self._processing_request_repository.add_output_asset_to_processing_request(
            processing_request_id, asset_id
        )

    async def does_asset_belong_to_project(self, processing_request_id: uuid.UUID, asset_id: uuid.UUID) -> bool:
        processing_request = await self._processing_request_repository.get_processing_request(processing_request_id)
        project = await self._project_service.get_project(processing_request.project_id)
        project_assets_ids = [str(pid) for pid in project.assets_ids]
        return str(asset_id) in project_assets_ids

    async def _raise_for_assets_not_in_project(self, project_id: uuid.UUID, assets_ids: list[uuid.UUID]) -> None:
        """
        Check if all assets belong to the project.
        """
        project = await self._project_service.get_project(project_id)
        project_assets_ids = [str(pid) for pid in project.assets_ids]
        for asset_id in assets_ids:
            if str(asset_id) not in project_assets_ids:
                raise AssetDoesNotBelongToProject(asset_id=asset_id)


async def get_processing_request_service(
    processing_request_repository: ProcessingRequestRepository = Depends(get_processing_request_repository),
    asset_service: AssetService = Depends(get_asset_service),
    user_service: UserManager = Depends(get_user_manager),
    project_service: ProjectService = Depends(get_project_service),
    kafka_service: KafkaProducerService = Depends(get_kafka_service),
) -> AsyncGenerator[ProcessingRequestService, None]:
    yield ProcessingRequestService(
        processing_request_repository, asset_service, user_service, project_service, kafka_service
    )
