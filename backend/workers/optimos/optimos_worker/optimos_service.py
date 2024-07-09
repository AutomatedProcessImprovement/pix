import asyncio
import json
import uuid
import logging
import shutil
import subprocess
import traceback
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, Union
from uuid import UUID
import zipfile

import tempfile
import os
import time

import yaml
from pix_portal_lib.kafka_clients.email_producer import EmailNotificationProducer, EmailNotificationRequest
from pix_portal_lib.service_clients.asset import Asset, AssetServiceClient, AssetType, File_
from pix_portal_lib.service_clients.file import FileType
from pix_portal_lib.service_clients.processing_request import (
    ProcessingRequest,
    ProcessingRequestServiceClient,
    ProcessingRequestStatus,
)
from pix_portal_lib.service_clients.project import ProjectServiceClient
from pix_portal_lib.service_clients.user import UserServiceClient


from pareto_algorithms_and_metrics.main import run_optimization
from pareto_algorithms_and_metrics.iterations_handler import IterationInfo
from pareto_algorithms_and_metrics.pareto_metrics import AlgorithmResults
from data_structures.iteration_info import IterationNextType
from data_structures.solution_json_output import FullOutputJson, SolutionJson
from data_structures.simulation_info import SimulationInfo
from support_modules.plot_statistics_handler import (
    save_allocation_statistics_into_SolutionObject,
    return_api_solution_statistics,
)
from support_modules.constraints_generator import generate_constraint_file
from support_modules.file_manager import get_stats_without_writing, load_timetable_for_key, load_constraints_for_key

from optimos_worker.settings import settings


class InputAssetMissing(Exception):
    def __init__(self, message: Optional[str] = None):
        if message is not None:
            super().__init__(message)
        else:
            super().__init__("Input asset not found.")


logger = logging.getLogger()


class OptimosService:
    def __init__(self):
        self._assets_base_dir = settings.asset_base_dir / str(time.time())
        self._optimos_results_base_dir = settings.optimos_results_base_dir / str(time.time())
        self._asset_service_client = AssetServiceClient()
        self._processing_request_service_client = ProcessingRequestServiceClient()
        self._project_service_client = ProjectServiceClient()
        self._user_service_client = UserServiceClient()

        self._assets_base_dir.mkdir(parents=True, exist_ok=True)
        self._optimos_results_base_dir.mkdir(parents=True, exist_ok=True)
        self._initial_solution: Optional[SolutionJson] = None

    async def process(self, processing_request: ProcessingRequest):
        """
        Downloads the input assets, runs Optimos, and uploads the output assets
        while updating all the dependent services if new assets have been produced.
        """

        # Optimos discovery stdout and stderr
        result_stdout = ""
        result_stderr = ""
        files_to_delete = []
        dirs_to_delete = []

        try:
            # update processing request status
            await self._processing_request_service_client.update_request(
                processing_request_id=processing_request.processing_request_id,
                status=ProcessingRequestStatus.RUNNING,
                start_time=datetime.utcnow(),
            )

            # download assets
            assets = [
                await self._asset_service_client.download_asset(asset_id, self._assets_base_dir, is_internal=True)
                for asset_id in processing_request.input_assets_ids
            ]
            for asset in assets:
                if asset.files is not None:
                    files_to_delete.extend(asset.files)

            # update optimos configuration to include the correct event log path, process model
            self.update_configuration(assets, processing_request)

            print(processing_request.input_assets_ids)
            output_asset_id = await self.create_empty_asset(processing_request)
            # update project assets
            # NOTE: assets must be added to the project first before adding them to the processing request,
            #   because the processing request service checks if the assets belong to the project
            await self._project_service_client.add_asset_to_project(
                project_id=processing_request.project_id,
                asset_id=output_asset_id,
            )
            # update output assets in the processing request
            await self._processing_request_service_client.add_output_asset_to_processing_request(
                processing_request_id=processing_request.processing_request_id,
                asset_id=output_asset_id,
            )

            # run optimos, it can take hours
            stats_file = await self.optimization_task(processing_request, assets, output_asset_id)
            dirs_to_delete.append(stats_file)

            # upload results and create corresponding assets
            await self.upload_results(stats_file, output_asset_id)

            # update processing request status

            await self._processing_request_service_client.update_request(
                processing_request_id=processing_request.processing_request_id,
                status=(
                    ProcessingRequestStatus.CANCELLED
                    if processing_request.should_be_cancelled
                    else ProcessingRequestStatus.FINISHED
                ),
                end_time=datetime.utcnow(),
            )

        except Exception as e:
            trace = traceback.format_exc()
            logger.error(
                f"Optimos discovery failed: {e}, "
                f"processing_request_id={processing_request.processing_request_id}, "
                f"stdout={result_stdout}, "
                f"stderr={result_stderr}, "
                f"trace={trace}"
            )

            # update processing request status
            await self._processing_request_service_client.update_request(
                processing_request_id=processing_request.processing_request_id,
                status=ProcessingRequestStatus.FAILED,
                end_time=datetime.utcnow(),
                message=f"Processing Failed. If you are sure that your input files are correct, please try again (Error: {e})",
            )

        finally:
            # remove downloaded files
            for file in files_to_delete:
                if file.path.exists():
                    logger.info(f"Deleting file: {file.path}")
                    file.path.unlink()
            # remove results
            for dir in dirs_to_delete:
                logger.info(f"Deleting directory: {dir}")
                shutil.rmtree(dir, ignore_errors=True)

        # set token to None to force re-authentication, because the token might have expired
        self._asset_service_client.nullify_token()
        self._asset_service_client._file_client.nullify_token()
        self._project_service_client.nullify_token()
        self._processing_request_service_client.nullify_token()

    async def optimization_task(self, processing_request: ProcessingRequest, assets: list[Asset], output_asset_id: str):
        config = self._get_config(assets)
        model_filename = config["model_filename"]
        sim_params_file = config["sim_params_file"]
        cons_params_file = config["cons_params_file"]
        num_instances = config["num_instances"]
        algorithm = config["algorithm"]
        approach = config["approach"]
        log_name = str(uuid.uuid4())

        logger.info(f"Model file: {model_filename}")
        logger.info(f"Sim params file: {sim_params_file}")
        logger.info(f"Cons params file: {cons_params_file}")
        logger.info(f"Num of instances: {num_instances}")
        logger.info(f"Algorithm: {algorithm}")
        logger.info(f"Approach: {approach}")

        data_path = os.path.abspath(f"/var/tmp/optimos/{log_name}")
        os.makedirs(data_path, exist_ok=True)

        model_path = os.path.abspath(os.path.join(data_path, model_filename))
        sim_param_path = os.path.abspath(os.path.join(data_path, sim_params_file))
        constraints_path = os.path.abspath(os.path.join(data_path, cons_params_file))

        # create result file for saving report
        stats_file = tempfile.NamedTemporaryFile(
            mode="w+", suffix=".json", prefix="stats_", delete=False, dir=data_path
        )
        stats_filename = stats_file.name.rsplit(os.sep, 1)[-1]

        # # create result file for saving logs
        # logs_file = tempfile.NamedTemporaryFile(mode="w+", suffix=".csv", prefix="logs_", delete=False,
        #                                         dir=celery_data_path)
        # logs_filename = logs_file.name.rsplit(os.sep, 1)[-1]

        # update processing request status
        await self._processing_request_service_client.update_request(
            processing_request_id=processing_request.processing_request_id,
            status=ProcessingRequestStatus.RUNNING,
            start_time=datetime.utcnow(),
        )

        output = run_optimization(
            model_path,
            sim_param_path,
            constraints_path,
            num_instances,
            algorithm,
            approach,
            stats_file.name,
            log_name,
            self.get_iteration_callback(output_asset_id),
            processing_request,  # type: ignore
        )

        jsonContent = json.dumps(output, default=lambda o: o.to_json())
        with open("output.json", "w") as f:
            f.write(jsonContent)

        # Zip the stats_file, and return it's path
        with zipfile.ZipFile(f"{stats_file.name}.zip", "w", compression=zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(stats_file.name, stats_filename)

        return Path(f"{stats_file.name}.zip")

    @staticmethod
    def _find_file_by_type(files: list[File_], type: FileType) -> Optional[File_]:
        for file in files:
            if file.type == type:
                return file
        return None

    @staticmethod
    def _validate_input_files(files: list[Union[File_, None]]):
        for f in files:
            if f is None or f.path is None or not Path(f.path).exists():
                raise InputAssetMissing(message=f"Input asset not found: {f}")

    def _extract_input_files(
        self, assets: list[Asset]
    ) -> tuple[Optional[File_], Optional[File_], Optional[File_], Optional[File_]]:
        files: list[File_] = []
        for asset in assets:
            if asset.files is not None:
                files.extend(asset.files)

        config_file = self._find_file_by_type(files, FileType.CONFIGURATION_OPTIMOS_YAML)
        sim_params_file = self._find_file_by_type(files, FileType.SIMULATION_MODEL_PROSIMOS_JSON)
        cons_params_file = self._find_file_by_type(files, FileType.CONSTRAINTS_MODEL_OPTIMOS_JSON)
        process_model_file = self._find_file_by_type(files, FileType.PROCESS_MODEL_BPMN)

        return config_file, sim_params_file, cons_params_file, process_model_file

    def update_configuration(self, assets: list[Asset], processing_request: ProcessingRequest):
        """
        Updates the Optimos configuration file to include the correct event log path, process model.
        """
        config_file, sim_params_file, cons_params_file, process_model_file = self._extract_input_files(assets)
        print(config_file, sim_params_file, cons_params_file, process_model_file)
        self._validate_input_files(
            [config_file, sim_params_file, cons_params_file, process_model_file]
        )  # only event log is required, other files are optional

        config_file_path = Path(config_file.path)  # type: ignore
        sim_params_file_path = Path(sim_params_file.path)  # type: ignore
        cons_params_file = Path(cons_params_file.path)  # type: ignore
        process_model_path = Path(process_model_file.path)  # type: ignore

        self._update_configuration_file(config_file_path, sim_params_file_path, process_model_path, cons_params_file)

    @staticmethod
    def _update_configuration_file(
        config_path: Path, sim_params_file: Path, model_filename: Path, cons_params_file: Path
    ):
        content = config_path.read_bytes()
        config = yaml.safe_load(content)

        config["model_filename"] = str(model_filename.absolute())
        config["sim_params_file"] = str(sim_params_file.absolute())
        config["cons_params_file"] = str(cons_params_file.absolute())

        content = yaml.dump(config)

        config_path.write_bytes(content.encode("utf-8"))

    def _get_config(self, assets: list[Asset]):
        files: list[File_] = []
        for asset in assets:
            if asset.files is not None:
                files.extend(asset.files)
        config_file = self._find_file_by_type(files, FileType.CONFIGURATION_OPTIMOS_YAML)
        assert config_file is not None
        config_file_path = Path(config_file.path)
        content = config_file_path.read_bytes()
        config = yaml.safe_load(content)
        return config

    async def upload_results(self, result_file: Path, asset_id: str):
        report_json = File_(name=result_file.name, type=FileType.OPTIMIZATION_REPORT_OPTIMOS_JSON, path=result_file)

        await self._asset_service_client.replace_assets_files(
            asset_id=asset_id,
            files=[report_json],
        )

    async def create_empty_asset(self, processing_request: ProcessingRequest):
        optimos_report_asset_id = await self._asset_service_client.create_asset(
            files=[],
            project_id=processing_request.project_id,
            asset_name="optimos_report",
            asset_type=AssetType.OPTIMOS_REPORT,
            users_ids=[UUID(processing_request.user_id)],
        )

        return optimos_report_asset_id

    def get_iteration_callback(self, output_asset_id: str):
        print("Iteration callback called (sync)")
        return lambda iteration_info, approach, iteration: asyncio.run(
            self.async_iteration_callback(iteration_info, approach, output_asset_id, iteration)
        )

    async def async_iteration_callback(
        self, iteration_info: IterationNextType, approach: str, output_asset_id: str, iteration: int
    ):
        print(f"Iteration callback called (async) for iteration {iteration}")
        (pool_info, simulation_info, non_optimal_distance) = iteration_info
        if pool_info is None or simulation_info is None:
            return

        key = pool_info.id
        sim_params = load_timetable_for_key(key)
        cons_params = load_constraints_for_key(key)
        if sim_params is None or cons_params is None:
            return
        solution_json = SolutionJson(
            solution_info=simulation_info,
            sim_params=sim_params,
            cons_params=cons_params,
            name=approach,
            iteration=iteration,
        )

        if iteration == 1:
            self._initial_solution = solution_json

        output = FullOutputJson(
            name=approach + "-" + pool_info.id,
            initial_solution=self._initial_solution,
            final_solutions=None,
            current_solution=solution_json,
            final_solution_metrics=None,
        )

        jsonContent = json.dumps(output, default=lambda o: o.to_json())
        with open("output.json", "w") as f:
            f.write(jsonContent)

        await self.upload_results(Path("output.json"), output_asset_id)
        print("Iteration callback finished")
