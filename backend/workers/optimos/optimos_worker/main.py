import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import logging
import uuid
import signal

import pix_portal_lib.open_telemetry_utils as open_telemetry_utils
from kafka import KafkaConsumer
from pix_portal_lib.service_clients.processing_request import ProcessingRequest

from optimos_worker.optimos_service import OptimosService
from optimos_worker.settings import settings
import nest_asyncio

nest_asyncio.apply()

logger = logging.getLogger()

open_telemetry_utils.instrument_worker(service_name="optimos", httpx=True)

consumer_id = f"optimos-consumer-{uuid.uuid4()}"
# group_id should be the same for all parallel consumers that process the same topic
group_id = settings.kafka_consumer_group_id

consumer = KafkaConsumer(
    settings.kafka_topic_requests,
    settings.kafka_topic_cancellations,
    client_id=consumer_id,
    group_id=group_id,
    bootstrap_servers=settings.kafka_bootstrap_servers,
    auto_offset_reset="earliest",
    value_deserializer=lambda x: json.loads(x.decode("utf-8")),
    session_timeout_ms=30 * 60 * 1000,
    request_timeout_ms=40 * 60 * 1000,
    connections_max_idle_ms=50 * 60 * 1000,
    max_poll_records=1,
    max_poll_interval_ms=30 * 60 * 1000,
)

logger.info(
    f"Kafka consumer connected: "
    f"consumer_id={consumer_id}, "
    f"group_id={group_id}, "
    f"bootstrap_connected={consumer.bootstrap_connected()}"
)


# Initialize thread pool executor
executor = ThreadPoolExecutor(max_workers=5)

# Dictionary to store task_id and corresponding future
running_requests = {}


# Signal handler to gracefully stop the consumer
def signal_handler(sig, frame):
    consumer.close()
    print("Consumer stopped.")
    exit(0)


# Register signal handler
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


async def process_message(message):
    logger.info(f"Kafka consumer {consumer_id} received a message from Kafka: {message}")
    if message.topic == settings.kafka_topic_cancellations:
        processing_request_id = message.value["processing_request_id"]
        # Cancel task if it exists
        if processing_request_id in running_requests:
            request = running_requests.pop(processing_request_id)
            request.should_be_cancelled = True
            logger.info(f"Kafka consumer {consumer_id} cancelled processing the message: {message}")
        else:
            logger.warning(
                f"Kafka consumer {consumer_id} received a cancellation message for a non-existing task: {message}, {running_requests}"
            )

    else:
        request = ProcessingRequest(**message.value)
        task_id = request.processing_request_id
        try:
            running_requests[task_id] = request
            executor.submit(asyncio.run, process_request(request))

            logger.info(f"Kafka consumer {consumer_id} finished processing the message: {message}")
        except Exception as e:
            logger.info(f"Kafka consumer {consumer_id} failed to process the message: {message} because of {e}")
            del running_requests[task_id]


async def process_request(request: ProcessingRequest):
    await OptimosService().process(request)


async def main():
    for message in consumer:
        try:
            if not asyncio.get_event_loop() or asyncio.get_event_loop().is_closed():
                asyncio.set_event_loop(asyncio.new_event_loop())
            await process_message(message)
        except Exception as e:
            logger.exception(f"Kafka consumer {consumer_id} failed to process the message: {message}, error: {e}")


asyncio.run(main())
